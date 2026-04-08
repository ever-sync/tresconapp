import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

export const MAX_BACKGROUND_JOB_ATTEMPTS = 3;
const RETRY_DELAY_MS = 30_000;
const BACKGROUND_RUNNER_TRIGGER_TIMEOUT_MS = 1_200;
const STALE_BACKGROUND_JOB_PROCESSING_MS = 15 * 60 * 1000;

export type BackgroundJobType =
  | "rebuild_statements"
  | "sync_mapping"
  | "refresh_chart_of_accounts";

type JsonPayload = Record<string, unknown>;

export async function enqueueBackgroundJob(params: {
  type: BackgroundJobType;
  accountingId: string;
  clientId?: string | null;
  year?: number | null;
  payload?: JsonPayload;
  importBatchId?: string;
  dedupe?: boolean;
}) {
  if (params.dedupe !== false) {
    const existing = await prisma.backgroundJob.findFirst({
      where: {
        type: params.type,
        accounting_id: params.accountingId,
        client_id: params.clientId ?? null,
        year: params.year ?? null,
        status: {
          in: ["queued", "processing"],
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (existing) {
      if (params.importBatchId) {
        await prisma.importBatch.update({
          where: { id: params.importBatchId },
          data: {
            background_job_id: existing.id,
          },
        });
      }

      return existing;
    }
  }

  const job = await prisma.backgroundJob.create({
    data: {
      type: params.type,
      accounting_id: params.accountingId,
      client_id: params.clientId ?? null,
      year: params.year ?? null,
      payload_json: (params.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      status: "queued",
    },
  });

  if (params.importBatchId) {
    await prisma.importBatch.update({
      where: { id: params.importBatchId },
      data: {
        background_job_id: job.id,
      },
    });
  }

  return job;
}

export async function triggerBackgroundJobRunner(params: {
  origin: string;
  limit?: number;
}) {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  const origin = params.origin.trim();
  const internalSecret = process.env.INTERNAL_JOBS_SECRET?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!origin || (!internalSecret && !cronSecret)) {
    return false;
  }

  const url = new URL("/api/internal/jobs/run", origin);
  const limit = Number.isFinite(params.limit) ? Math.trunc(params.limit ?? 1) : 1;
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 10)));

  const headers: HeadersInit = cronSecret
    ? { Authorization: `Bearer ${cronSecret}` }
    : { "x-internal-jobs-secret": internalSecret! };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKGROUND_RUNNER_TRIGGER_TIMEOUT_MS);

  try {
    await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function claimNextBackgroundJobs(limit = 3) {
  const now = new Date();
  const candidates = await prisma.backgroundJob.findMany({
    where: {
      status: "queued",
      available_at: {
        lte: now,
      },
    },
    orderBy: [{ available_at: "asc" }, { created_at: "asc" }],
    take: limit,
  });

  const candidateIds = candidates.map((candidate) => candidate.id);
  const linkedBatches =
    candidateIds.length > 0
      ? await prisma.importBatch.findMany({
          where: {
            background_job_id: {
              in: candidateIds,
            },
          },
          select: {
            id: true,
            background_job_id: true,
          },
        })
      : [];
  const batchIdByJobId = new Map(
    linkedBatches.map((batch) => [batch.background_job_id, batch.id])
  );

  const claimed: Array<(typeof candidates)[number] & { importBatchId: string | null }> = [];

  for (const candidate of candidates) {
    const result = await prisma.backgroundJob.updateMany({
      where: {
        id: candidate.id,
        status: "queued",
      },
      data: {
        status: "processing",
        started_at: now,
        attempts: {
          increment: 1,
        },
      },
    });

    if (result.count === 1) {
      claimed.push({
        ...candidate,
        status: "processing",
        started_at: now,
        attempts: candidate.attempts + 1,
        importBatchId: batchIdByJobId.get(candidate.id) ?? null,
      });
    }
  }

  return claimed;
}

export async function completeBackgroundJob(jobId: string) {
  return prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "done",
      finished_at: new Date(),
      error_message: null,
    },
  });
}

export async function recoverStaleBackgroundJob(jobId: string) {
  const current = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      type: true,
      status: true,
      attempts: true,
      available_at: true,
      started_at: true,
      finished_at: true,
      error_message: true,
    },
  });

  if (!current) {
    return null;
  }

  if (
    current.status !== "processing" ||
    !current.started_at ||
    Date.now() - current.started_at.getTime() < STALE_BACKGROUND_JOB_PROCESSING_MS
  ) {
    return current;
  }

  const shouldRetry = current.attempts < MAX_BACKGROUND_JOB_ATTEMPTS;

  if (shouldRetry) {
    return prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "queued",
        available_at: new Date(),
        started_at: null,
        error_message: "Job retomado automaticamente apos ficar travado em processamento.",
      },
      select: {
        id: true,
        type: true,
        status: true,
        attempts: true,
        available_at: true,
        started_at: true,
        finished_at: true,
        error_message: true,
      },
    });
  }

  return prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "failed",
      finished_at: new Date(),
      error_message: "Job encerrado automaticamente apos exceder o tempo limite de processamento.",
    },
    select: {
      id: true,
      type: true,
      status: true,
      attempts: true,
      available_at: true,
      started_at: true,
      finished_at: true,
      error_message: true,
    },
  });
}

export async function failBackgroundJob(params: {
  jobId: string;
  errorMessage: string;
  retryable?: boolean;
}) {
  const current = await prisma.backgroundJob.findUnique({
    where: { id: params.jobId },
    select: {
      attempts: true,
    },
  });

  const shouldRetry =
    params.retryable !== false &&
    (current?.attempts ?? 0) < MAX_BACKGROUND_JOB_ATTEMPTS;

  if (shouldRetry) {
    return prisma.backgroundJob.update({
      where: { id: params.jobId },
      data: {
        status: "queued",
        available_at: new Date(Date.now() + RETRY_DELAY_MS),
        error_message: params.errorMessage,
      },
    });
  }

  return prisma.backgroundJob.update({
    where: { id: params.jobId },
    data: {
      status: "failed",
      finished_at: new Date(),
      error_message: params.errorMessage,
    },
  });
}

export async function getBackgroundJob(jobId: string) {
  const job = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return null;
  }

  const importBatch = await prisma.importBatch.findFirst({
    where: {
      background_job_id: job.id,
    },
    select: {
      id: true,
      status: true,
      kind: true,
      row_count: true,
      error_count: true,
      started_at: true,
      finished_at: true,
      error_message: true,
    },
  });

  return {
    ...job,
    importBatch,
  };
}
