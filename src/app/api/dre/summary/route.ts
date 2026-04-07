import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireClient } from "@/lib/auth-guard";
import { success, handleError } from "@/lib/api-response";
import { getDreSnapshotEnvelope } from "@/lib/statement-snapshots";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

const SUMMARY_CACHE_CONTROL = "private, max-age=15, stale-while-revalidate=120";

function parseYear(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2100) {
    return null;
  }
  return parsed;
}

function parseMonth(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 12) {
    return null;
  }
  return parsed - 1;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireClient();
    const { searchParams } = new URL(request.url);
    const requestedYear = parseYear(searchParams.get("year"));
    const requestedMonth = parseMonth(searchParams.get("month"));

    const client = await prisma.client.findFirst({
      where: {
        id: auth.clientId ?? undefined,
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!client) {
      return success({ error: "Cliente não encontrado" }, 404);
    }

    const latestMovement = requestedYear
      ? null
      : await prisma.monthlyMovement.findFirst({
          where: {
            client_id: client.id,
            deleted_at: null,
            type: "dre",
          },
          orderBy: [{ year: "desc" }, { updated_at: "desc" }],
          select: { year: true },
        });

    const year = requestedYear ?? latestMovement?.year ?? new Date().getFullYear();

    const envelope = await getDreSnapshotEnvelope({
      accountingId: auth.accountingId,
      clientId: client.id,
      year,
      requestedMonth: requestedMonth ?? undefined,
    });

    const response = success({
      ...envelope.payload,
      stale: envelope.stale,
      snapshotStatus: envelope.snapshotStatus,
      mappingVersion: envelope.mappingVersion,
      computedAt: envelope.computedAt,
    });
    response.headers.set("Cache-Control", SUMMARY_CACHE_CONTROL);
    return response;
  } catch (err) {
    return handleError(err);
  }
}
