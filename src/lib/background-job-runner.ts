import prisma from "@/lib/prisma";
import {
  claimNextBackgroundJobs,
  completeBackgroundJob,
  enqueueBackgroundJob,
  failBackgroundJob,
} from "@/lib/background-jobs";
import {
  completeImportBatch,
  failImportBatch,
  rebuildStatements,
} from "@/lib/statement-snapshots";

type ClaimedBackgroundJob = Awaited<ReturnType<typeof claimNextBackgroundJobs>>[number];

type BackgroundJobResult = {
  id: string;
  type: string;
  status: "done" | "failed";
  error?: string;
};

function getStatementType(payload: unknown) {
  const statementType =
    payload && typeof payload === "object" && "statementType" in payload
      ? payload.statementType
      : null;

  return statementType === "dre" ||
    statementType === "patrimonial" ||
    statementType === "dfc" ||
    statementType === "all"
    ? statementType
    : "all";
}

async function processRebuildJob(job: ClaimedBackgroundJob) {
  const statementType = getStatementType(job.payload_json);

  if (!job.client_id || !job.year) {
    throw new Error("Job de rebuild sem client_id ou year");
  }

  await rebuildStatements({
    accountingId: job.accounting_id,
    clientId: job.client_id,
    year: job.year,
    statementType,
  });
}

async function processRefreshChartOfAccountsJob() {
  return;
}

async function processSyncMappingJob(job: ClaimedBackgroundJob) {
  const targets = await prisma.monthlyMovement.groupBy({
    by: ["client_id", "year"],
    where: {
      accounting_id: job.accounting_id,
      deleted_at: null,
      ...(job.client_id ? { client_id: job.client_id } : {}),
    },
    orderBy: [{ year: "desc" }, { client_id: "asc" }],
    take: 50,
  });

  for (const target of targets) {
    await enqueueBackgroundJob({
      type: "rebuild_statements",
      accountingId: job.accounting_id,
      clientId: target.client_id,
      year: target.year,
      payload: {
          statementType: "all",
          source: "sync_mapping",
        },
    });
  }
}

export async function runClaimedBackgroundJob(
  job: ClaimedBackgroundJob
): Promise<BackgroundJobResult> {
  try {
    if (job.type === "rebuild_statements") {
      await processRebuildJob(job);
    } else if (job.type === "refresh_chart_of_accounts") {
      await processRefreshChartOfAccountsJob();
    } else if (job.type === "sync_mapping") {
      await processSyncMappingJob(job);
    } else {
      throw new Error(`Tipo de job nao suportado: ${job.type}`);
    }

    await completeBackgroundJob(job.id);

    if (job.importBatchId) {
      await completeImportBatch({ batchId: job.importBatchId });
    }

    return {
      id: job.id,
      type: job.type,
      status: "done",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao processar job";

    await failBackgroundJob({
      jobId: job.id,
      errorMessage: message,
    });

    if (job.importBatchId) {
      await failImportBatch({
        batchId: job.importBatchId,
        errorMessage: message,
      });
    }

    return {
      id: job.id,
      type: job.type,
      status: "failed",
      error: message,
    };
  }
}

export async function runAvailableBackgroundJobs(limit = 2) {
  const jobs = await claimNextBackgroundJobs(limit);
  const results: BackgroundJobResult[] = [];

  for (const job of jobs) {
    results.push(await runClaimedBackgroundJob(job));
  }

  return results;
}

export async function runQueuedBackgroundJobNow(jobId: string) {
  const now = new Date();
  const claimed = await prisma.backgroundJob.updateMany({
    where: {
      id: jobId,
      status: "queued",
      available_at: {
        lte: now,
      },
    },
    data: {
      status: "processing",
      started_at: now,
      attempts: {
        increment: 1,
      },
    },
  });

  if (claimed.count !== 1) {
    return null;
  }

  const [job, importBatch] = await Promise.all([
    prisma.backgroundJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        type: true,
        accounting_id: true,
        client_id: true,
        year: true,
        payload_json: true,
        status: true,
        attempts: true,
        available_at: true,
        started_at: true,
        finished_at: true,
        error_message: true,
        created_at: true,
        updated_at: true,
      },
    }),
    prisma.importBatch.findFirst({
      where: { background_job_id: jobId },
      select: { id: true },
    }),
  ]);

  if (!job) {
    return null;
  }

  return runClaimedBackgroundJob({
    ...job,
    importBatchId: importBatch?.id ?? null,
  });
}
