import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";
import { getDfcLineKeyVariants } from "@/lib/dfc-lines";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

function normalizeKind(value: string | null) {
  if (value === "dre" || value === "patrimonial" || value === "dfc") {
    return value;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const kind = normalizeKind(request.nextUrl.searchParams.get("kind"));
    const target = request.nextUrl.searchParams.get("target")?.trim() ?? "";

    if (!kind || !target) {
      return error("Tipo e item sao obrigatorios", 400);
    }

    if (kind === "dfc") {
      const lineKeys = getDfcLineKeyVariants(target);
      const mappings = await prisma.dFCLineMapping.findMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: null,
          line_key: { in: lineKeys },
        },
        select: {
          chart_account_id: true,
          account_code_snapshot: true,
          reduced_code_snapshot: true,
        },
        orderBy: [{ account_code_snapshot: "asc" }],
      });

      const ids = mappings.map((mapping) => mapping.chart_account_id);
      const accounts =
        ids.length > 0
          ? await prisma.chartOfAccounts.findMany({
              where: {
                accounting_id: auth.accountingId,
                client_id: null,
                id: { in: ids },
              },
              select: {
                id: true,
                code: true,
                reduced_code: true,
                name: true,
              },
            })
          : [];

      const accountsById = new Map(accounts.map((account) => [account.id, account]));
      const dedupedAccounts = Array.from(
        new Map(
          mappings.map((mapping) => {
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

      return success({
        target,
        total: dedupedAccounts.length,
        accounts: dedupedAccounts,
      });
    }

    const mappings =
      kind === "dre"
        ? await prisma.dREMapping.findMany({
            where: {
              accounting_id: auth.accountingId,
              client_id: null,
              category: target,
            },
            select: {
              account_code: true,
              account_name: true,
            },
            orderBy: [{ account_code: "asc" }],
          })
        : await prisma.patrimonialMapping.findMany({
            where: {
              accounting_id: auth.accountingId,
              client_id: null,
              category: target,
            },
            select: {
              account_code: true,
              account_name: true,
            },
            orderBy: [{ account_code: "asc" }],
          });

    const codes = mappings.map((mapping) => mapping.account_code);
    const accounts =
      codes.length > 0
        ? await prisma.chartOfAccounts.findMany({
            where: {
              accounting_id: auth.accountingId,
              client_id: null,
              code: { in: codes },
            },
            select: {
              code: true,
              reduced_code: true,
              name: true,
            },
          })
        : [];

    const accountsByCode = new Map(accounts.map((account) => [account.code, account]));

    return success({
      target,
      total: mappings.length,
      accounts: mappings.map((mapping) => {
        const account = accountsByCode.get(mapping.account_code);
        return {
          code: mapping.account_code,
          reducedCode: account?.reduced_code ?? null,
          name: account?.name ?? mapping.account_name,
        };
      }),
    });
  } catch (err) {
    return handleError(err);
  }
}
