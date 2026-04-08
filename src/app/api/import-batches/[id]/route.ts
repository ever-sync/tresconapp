import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { authenticateClient, authenticateStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";
import {
  recoverStaleBackgroundJob,
  triggerBackgroundJobRunner,
} from "@/lib/background-jobs";
import { completeImportBatch, failImportBatch } from "@/lib/statement-snapshots";

export const runtime = "nodejs";
export const preferredRegion = "iad1";
const STALE_IMPORT_BATCH_WITHOUT_JOB_MS = 5 * 60 * 1000;

async function resolveAccess() {
  const staff = await authenticateStaff();
  if (staff) {
    return { audience: "staff" as const, auth: staff };
  }

  const client = await authenticateClient();
  if (client) {
    return { audience: "client" as const, auth: client };
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await resolveAccess();
    if (!access) {
      return error("Nao autenticado", 401);
    }

    const { id } = await context.params;

    const batch = await prisma.importBatch.findFirst({
      where: {
        id,
        accounting_id: access.auth.accountingId,
        ...(access.audience === "client" ? { client_id: access.auth.clientId } : {}),
      },
    });

    if (!batch) {
      return error("Importacao nao encontrada", 404);
    }

    let backgroundJob = batch.background_job_id
      ? await prisma.backgroundJob.findUnique({
          where: {
            id: batch.background_job_id,
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
        })
      : null;

    if (batch.status === "processing") {
      if (backgroundJob?.status === "done") {
        await completeImportBatch({ batchId: batch.id });
      } else if (backgroundJob?.status === "failed") {
        await failImportBatch({
          batchId: batch.id,
          errorMessage: backgroundJob.error_message || "A importacao falhou durante o processamento.",
        });
      } else if (backgroundJob?.status === "processing") {
        backgroundJob = await recoverStaleBackgroundJob(backgroundJob.id);

        if (backgroundJob?.status === "failed") {
          await failImportBatch({
            batchId: batch.id,
            errorMessage:
              backgroundJob.error_message || "A importacao foi encerrada automaticamente.",
          });
        } else {
          await triggerBackgroundJobRunner({
            origin: new URL(request.url).origin,
            limit: 1,
          });
        }
      } else if (backgroundJob?.status === "queued") {
        await triggerBackgroundJobRunner({
          origin: new URL(request.url).origin,
          limit: 1,
        });
      } else if (
        !backgroundJob &&
        Date.now() - batch.started_at.getTime() > STALE_IMPORT_BATCH_WITHOUT_JOB_MS
      ) {
        await failImportBatch({
          batchId: batch.id,
          errorMessage:
            "A importacao ficou sem job vinculado e foi encerrada automaticamente. Tente novamente.",
        });
      }
    }

    const freshBatch = await prisma.importBatch.findFirst({
      where: {
        id,
        accounting_id: access.auth.accountingId,
        ...(access.audience === "client" ? { client_id: access.auth.clientId } : {}),
      },
    });

    if (!freshBatch) {
      return error("Importacao nao encontrada", 404);
    }

    const freshBackgroundJob = freshBatch.background_job_id
      ? await prisma.backgroundJob.findUnique({
          where: {
            id: freshBatch.background_job_id,
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
        })
      : null;

    return success({
      id: freshBatch.id,
      status: freshBatch.status,
      kind: freshBatch.kind,
      fileName: freshBatch.file_name,
      rowCount: freshBatch.row_count,
      errorCount: freshBatch.error_count,
      year: freshBatch.year,
      startedAt: freshBatch.started_at.toISOString(),
      finishedAt: freshBatch.finished_at?.toISOString() ?? null,
      errorMessage: freshBatch.error_message,
      job: freshBackgroundJob
        ? {
            id: freshBackgroundJob.id,
            type: freshBackgroundJob.type,
            status: freshBackgroundJob.status,
            attempts: freshBackgroundJob.attempts,
            availableAt: freshBackgroundJob.available_at.toISOString(),
            startedAt: freshBackgroundJob.started_at?.toISOString() ?? null,
            finishedAt: freshBackgroundJob.finished_at?.toISOString() ?? null,
            errorMessage: freshBackgroundJob.error_message,
          }
        : null,
    });
  } catch (err) {
    return handleError(err);
  }
}
