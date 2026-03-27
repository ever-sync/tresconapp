import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireClient } from "@/lib/auth-guard";
import { success, handleError } from "@/lib/api-response";
import { getDfcSnapshotEnvelope } from "@/lib/statement-snapshots";
import {
  DFC_BALANCETE_IMPORT_KIND_PREFIX,
  parseDfcBalanceteImportMonth,
} from "@/lib/dfc-balancete";
import {
  DFC_VISIBLE_DERIVED_TARGETS,
  getCanonicalDfcLineKey,
  getDfcDerivedTargetMembers,
  getDfcLabelFromLineKey,
  getDfcTargetLineKeyVariants,
} from "@/lib/dfc-lines";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

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

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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
      return success({ error: "Cliente nao encontrado" }, 404);
    }

    const latestMovement = requestedYear
      ? null
      : await prisma.monthlyMovement.findFirst({
          where: {
            client_id: client.id,
            deleted_at: null,
            type: "patrimonial",
          },
          orderBy: [{ year: "desc" }, { updated_at: "desc" }],
          select: { year: true },
        });

    const year = requestedYear ?? latestMovement?.year ?? new Date().getFullYear();

    const envelope = await getDfcSnapshotEnvelope({
      accountingId: auth.accountingId,
      clientId: client.id,
      year,
      requestedMonth: requestedMonth ?? undefined,
    });

    const derivedTargetLineKeys = Array.from(
      new Set(
        DFC_VISIBLE_DERIVED_TARGETS.flatMap((target) => getDfcTargetLineKeyVariants(target))
      )
    );

    const [balanceteImports, balanceteDocuments, dfcMappings] = await Promise.all([
      prisma.importBatch.findMany({
        where: {
          client_id: client.id,
          year,
          kind: {
            startsWith: DFC_BALANCETE_IMPORT_KIND_PREFIX,
          },
        },
        select: {
          kind: true,
          file_name: true,
          status: true,
          row_count: true,
          error_message: true,
          started_at: true,
          finished_at: true,
        },
        orderBy: [{ started_at: "desc" }],
      }),
      prisma.clientDocument.findMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: client.id,
          document_type: "dfc_balancete_import",
          period_year: year,
          deleted_at: null,
        },
        select: {
          id: true,
          period_month: true,
        },
      }),
      prisma.dFCLineMapping.findMany({
        where: {
          accounting_id: auth.accountingId,
          OR: [{ client_id: null }, { client_id: client.id }],
          line_key: { in: derivedTargetLineKeys },
        },
        select: {
          line_key: true,
          chart_account_id: true,
          account_code_snapshot: true,
          reduced_code_snapshot: true,
        },
        orderBy: [{ account_code_snapshot: "asc" }],
      }),
    ]);

    const chartAccountIds = Array.from(new Set(dfcMappings.map((mapping) => mapping.chart_account_id)));
    const chartAccounts =
      chartAccountIds.length > 0
        ? await prisma.chartOfAccounts.findMany({
            where: {
              accounting_id: auth.accountingId,
              id: { in: chartAccountIds },
            },
            select: {
              id: true,
              code: true,
              reduced_code: true,
              name: true,
            },
          })
        : [];

    const accountsById = new Map(chartAccounts.map((account) => [account.id, account]));
    const derivedTargetGroups = Object.fromEntries(
      DFC_VISIBLE_DERIVED_TARGETS.map((target) => {
        const groups = getDfcDerivedTargetMembers(target)
          .map((member) => {
            const memberCanonical = getCanonicalDfcLineKey(member);
            const memberMappings = dfcMappings.filter(
              (mapping) => getCanonicalDfcLineKey(mapping.line_key) === memberCanonical
            );

            const accounts = Array.from(
              new Map(
                memberMappings.map((mapping) => {
                  const account = accountsById.get(mapping.chart_account_id);
                  const item = {
                    code: account?.code ?? mapping.account_code_snapshot,
                    reducedCode: account?.reduced_code ?? mapping.reduced_code_snapshot,
                    name: account?.name ?? mapping.account_code_snapshot,
                  };
                  return [item.code, item];
                })
              ).values()
            );

            return {
              title: getDfcLabelFromLineKey(memberCanonical),
              total: accounts.length,
              accounts,
            };
          })
          .filter((group) => group.total > 0);

        return [target, groups];
      })
    );

    const latestImportByMonth = new Map<number, (typeof balanceteImports)[number]>();
    for (const item of balanceteImports) {
      const monthIndex = parseDfcBalanceteImportMonth(item.kind);
      if (monthIndex === null || latestImportByMonth.has(monthIndex)) {
        continue;
      }
      latestImportByMonth.set(monthIndex, item);
    }

    const previewDocumentIdByMonth = new Map<number, string>();
    for (const document of balanceteDocuments) {
      if (!document.period_month || previewDocumentIdByMonth.has(document.period_month - 1)) {
        continue;
      }
      previewDocumentIdByMonth.set(document.period_month - 1, document.id);
    }

    return success({
      ...envelope.payload,
      balanceteUploads: MONTH_LABELS.map((label, monthIndex) => {
        const upload = latestImportByMonth.get(monthIndex);
        const previewDocumentId = previewDocumentIdByMonth.get(monthIndex) ?? null;
        const canPreview =
          upload?.status === "ready" && (previewDocumentId !== null || (upload?.row_count ?? 0) > 0);

        return {
          month: monthIndex + 1,
          label,
          status: upload?.status ?? "empty",
          fileName: upload?.file_name ?? null,
          rowCount: upload?.row_count ?? 0,
          errorMessage: upload?.error_message ?? null,
          startedAt: upload?.started_at.toISOString() ?? null,
          finishedAt: upload?.finished_at?.toISOString() ?? null,
          previewDocumentId,
          canPreview,
        };
      }),
      stale: envelope.stale,
      snapshotStatus: envelope.snapshotStatus,
      mappingVersion: envelope.mappingVersion,
      computedAt: envelope.computedAt,
      derivedTargetGroups,
    });
  } catch (err) {
    return handleError(err);
  }
}
