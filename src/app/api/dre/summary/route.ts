import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireClient } from "@/lib/auth-guard";
import { buildDreStatement, emptyDreStatement } from "@/lib/dre-statement";
import { success, handleError } from "@/lib/api-response";

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

    const [movements, globalAccounts, clientAccounts, globalMappings, clientMappings] =
      await Promise.all([
        prisma.monthlyMovement.findMany({
          where: {
            client_id: client.id,
            year,
            deleted_at: null,
            type: "dre",
          },
          orderBy: [{ level: "asc" }, { code: "asc" }],
          select: {
            code: true,
            reduced_code: true,
            name: true,
            level: true,
            values: true,
            type: true,
            category: true,
          },
        }),
        prisma.chartOfAccounts.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
          orderBy: [{ level: "asc" }, { code: "asc" }],
          select: {
            code: true,
            reduced_code: true,
            name: true,
            report_category: true,
            report_type: true,
            level: true,
          },
        }),
        prisma.chartOfAccounts.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: client.id,
          },
          orderBy: [{ level: "asc" }, { code: "asc" }],
          select: {
            code: true,
            reduced_code: true,
            name: true,
            report_category: true,
            report_type: true,
            level: true,
          },
        }),
        prisma.dREMapping.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
          select: {
            account_code: true,
            category: true,
            client_id: true,
          },
        }),
        prisma.dREMapping.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: client.id,
          },
          select: {
            account_code: true,
            category: true,
            client_id: true,
          },
        }),
      ]);

    const typedMovements = movements.map((movement) => ({
      ...movement,
      type: movement.type as "dre" | "patrimonial",
    }));

    if (typedMovements.length === 0) {
      return success({
        ...emptyDreStatement(year),
        year,
        activeMonthIndex: requestedMonth ?? 0,
      });
    }

    const statement = buildDreStatement({
      year,
      movements: typedMovements,
      chartAccounts: [...globalAccounts, ...clientAccounts],
      mappings: [...globalMappings, ...clientMappings],
      activeMonthIndex: requestedMonth ?? undefined,
    });

    return success(statement);
  } catch (err) {
    return handleError(err);
  }
}
