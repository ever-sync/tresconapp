import prisma from "@/lib/prisma";
import { resolveDreCategory } from "@/lib/dre-statement";
import { resolvePatrimonialCategory } from "@/lib/patrimonial-statement";

export type ParametrizationStatus = {
  drePending: number;
  patrimonialPending: number;
  dfcPending: number;
  totalPending: number;
};

type ChartAccountRow = {
  id: string;
  code: string;
  reduced_code: string | null;
  name: string;
  report_category: string | null;
  report_type: string | null;
  level: number;
};

function buildMovementLike(account: ChartAccountRow, type: "dre" | "patrimonial") {
  return {
    code: account.code,
    reduced_code: account.reduced_code,
    name: account.name,
    level: account.level,
    values: Array.from({ length: 12 }, () => 0),
    type,
    category: null,
  };
}

export async function getParametrizationStatus(accountingId: string): Promise<ParametrizationStatus> {
  const [chartAccounts, dreMappings, patrimonialMappings, dfcLineMappings] = await Promise.all([
    prisma.chartOfAccounts.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
      },
      select: {
        id: true,
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
        accounting_id: accountingId,
        client_id: null,
      },
      select: {
        account_code: true,
        category: true,
      },
    }),
    prisma.patrimonialMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
      },
      select: {
        account_code: true,
        category: true,
      },
    }),
    prisma.dFCLineMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
      },
      select: {
        chart_account_id: true,
      },
    }),
  ]);

  const dreByCode = new Map(dreMappings.map((mapping) => [mapping.account_code, mapping.category]));
  const patrimonialByCode = new Map(
    patrimonialMappings.map((mapping) => [mapping.account_code, mapping.category])
  );
  const dfcMappedAccountIds = new Set(dfcLineMappings.map((mapping) => mapping.chart_account_id));

  let drePending = 0;
  let patrimonialPending = 0;

  for (const account of chartAccounts) {
    const dreCategory = resolveDreCategory({
      movement: buildMovementLike(account, "dre"),
      chartAccount: account,
      mapping: {
        account_code: account.code,
        category: dreByCode.get(account.code) ?? "",
      },
    });

    if (!dreCategory) {
      drePending += 1;
    }

    const patrimonialCategory = resolvePatrimonialCategory({
      movement: buildMovementLike(account, "patrimonial"),
      chartAccount: account,
      mapping: {
        account_code: account.code,
        category: patrimonialByCode.get(account.code) ?? "",
      },
    });

    if (!patrimonialCategory) {
      patrimonialPending += 1;
    }
  }

  const dfcPending = chartAccounts.filter((account) => !dfcMappedAccountIds.has(account.id)).length;

  return {
    drePending,
    patrimonialPending,
    dfcPending,
    totalPending: drePending + patrimonialPending + dfcPending,
  };
}
