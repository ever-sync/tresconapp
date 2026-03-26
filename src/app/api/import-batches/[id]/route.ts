import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { authenticateClient, authenticateStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

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
  _request: NextRequest,
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

    const backgroundJob = batch.background_job_id
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

    return success({
      id: batch.id,
      status: batch.status,
      kind: batch.kind,
      fileName: batch.file_name,
      rowCount: batch.row_count,
      errorCount: batch.error_count,
      year: batch.year,
      startedAt: batch.started_at.toISOString(),
      finishedAt: batch.finished_at?.toISOString() ?? null,
      errorMessage: batch.error_message,
      job: backgroundJob
        ? {
            id: backgroundJob.id,
            type: backgroundJob.type,
            status: backgroundJob.status,
            attempts: backgroundJob.attempts,
            availableAt: backgroundJob.available_at.toISOString(),
            startedAt: backgroundJob.started_at?.toISOString() ?? null,
            finishedAt: backgroundJob.finished_at?.toISOString() ?? null,
            errorMessage: backgroundJob.error_message,
          }
        : null,
    });
  } catch (err) {
    return handleError(err);
  }
}
