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

    const job = await prisma.backgroundJob.findFirst({
      where: {
        id,
        accounting_id: access.auth.accountingId,
        ...(access.audience === "client" ? { client_id: access.auth.clientId } : {}),
      },
    });

    if (!job) {
      return error("Job nao encontrado", 404);
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

    return success({
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      availableAt: job.available_at.toISOString(),
      startedAt: job.started_at?.toISOString() ?? null,
      finishedAt: job.finished_at?.toISOString() ?? null,
      errorMessage: job.error_message,
      createdAt: job.created_at.toISOString(),
      updatedAt: job.updated_at.toISOString(),
      importBatch: importBatch
        ? {
            ...importBatch,
            startedAt: importBatch.started_at.toISOString(),
            finishedAt: importBatch.finished_at?.toISOString() ?? null,
          }
        : null,
    });
  } catch (err) {
    return handleError(err);
  }
}
