import { NextRequest } from "next/server";

import { error, handleError, success } from "@/lib/api-response";
import {
  claimNextBackgroundJobs,
  completeBackgroundJob,
  enqueueBackgroundJob,
  failBackgroundJob,
} from "@/lib/background-jobs";
import prisma from "@/lib/prisma";
import { completeImportBatch, failImportBatch, rebuildStatements } from "@/lib/statement-snapshots";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

const DEFAULT_JOB_LIMIT = 2;

function isAuthorized(request: NextRequest) {
  const internalSecret = process.env.INTERNAL_JOBS_SECRET?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!internalSecret && !cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerSecret = request.headers.get("x-internal-jobs-secret")?.trim();
  const bearerToken = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();

  return (
    (Boolean(internalSecret) &&
      (headerSecret === internalSecret || bearerToken === internalSecret)) ||
    (Boolean(cronSecret) && bearerToken === cronSecret)
  );
}

async function processRebuildJob(job: Awaited<ReturnType<typeof claimNextBackgroundJobs>>[number]) {
  const payload = (job.payload_json as Record<string, unknown> | null) ?? {};
  const statementType =
    payload.statementType === "dre" ||
    payload.statementType === "patrimonial" ||
    payload.statementType === "dfc" ||
    payload.statementType === "all"
      ? payload.statementType
      : "all";

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

async function processSyncMappingJob(job: Awaited<ReturnType<typeof claimNextBackgroundJobs>>[number]) {
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

async function handleRunJobs(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return error("Nao autorizado", 401);
    }

    const url = new URL(request.url);
    const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 10)
        : DEFAULT_JOB_LIMIT;

    const jobs = await claimNextBackgroundJobs(limit);
    const results: Array<{ id: string; type: string; status: string; error?: string }> = [];

    for (const job of jobs) {
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

        results.push({
          id: job.id,
          type: job.type,
          status: "done",
        });
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

        results.push({
          id: job.id,
          type: job.type,
          status: "failed",
          error: message,
        });
      }
    }

    return success({
      processed: results.length,
      results,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function GET(request: NextRequest) {
  return handleRunJobs(request);
}

export async function POST(request: NextRequest) {
  return handleRunJobs(request);
}
