import { readFile } from "fs/promises";
import { isAbsolute, resolve } from "path";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  buildDreStatement,
  emptyDreStatement,
  isLikelyCumulativeDreSummary,
  type DreChartAccountLike,
  type DreMappingLike,
  type DreMovementLike,
  type DreStatementResult,
} from "@/lib/dre-statement";
import {
  buildPatrimonialStatement,
  emptyPatrimonialStatement,
  type PatrimonialChartAccountLike,
  type PatrimonialMappingLike,
  type PatrimonialMovementLike,
  type PatrimonialStatementResult,
} from "@/lib/patrimonial-statement";
import {
  buildDfcStatement,
  emptyDfcStatement,
  type DfcMonthlyBalanceteLike,
  type DfcMappingLike,
  type DfcMovementLike,
  type DfcStatementResult,
} from "@/lib/dfc-statement";
import { getCanonicalDfcLineKey } from "@/lib/dfc-lines";
import { parseMonthlyBalanceteDetailedFile } from "@/lib/movement-import";

export type StatementType = "dre" | "patrimonial" | "dfc";
export type SnapshotStatus = "ready" | "partial" | "failed";

type SnapshotEnvelope<T> = {
  payload: T;
  stale: boolean;
  snapshotStatus: string;
  mappingVersion: number;
  computedAt: string;
};

type SnapshotRowLike = {
  key?: string;
  label: string;
  section?: string | null;
  kind?: string | null;
  monthly?: number[];
};

type SnapshotSummaryWithRows = {
  rows?: SnapshotRowLike[];
};

type MetricItem = {
  label: string;
  value: number;
  format: "ratio" | "percent" | "currency" | "days";
};

const DFC_RESULTADO_OPERACIONAL_SOURCE_KEYS = [
  "lucroAjustado",
  "contasReceber",
  "adiantamentos",
  "impostosCompensar",
  "estoques",
  "despesasAntecipadas",
  "outrasContasReceber",
  "fornecedores",
  "obrigacoesTrabalhistas",
  "obrigacoesTributarias",
  "outrasObrigacoes",
  "parcelamentos",
] as const;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toTyped<T>(value: Prisma.JsonValue): T {
  return value as T;
}

function parseRequestedMonth(requestedMonth?: number) {
  if (typeof requestedMonth !== "number" || requestedMonth < 0) {
    return undefined;
  }
  return Math.min(requestedMonth, 11);
}

function isLikelyOutdatedDfcSummary(summary: DfcStatementResult) {
  const hasRemovedRows = summary.rows.some(
    (row) => String(row.key) === "variacaoAtivo" || String(row.key) === "variacaoPassivo"
  );
  if (hasRemovedRows) {
    return true;
  }

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const expected = DFC_RESULTADO_OPERACIONAL_SOURCE_KEYS.reduce(
      (total, key) => total + (summary.lines[key]?.[monthIndex] ?? 0),
      0
    );
    const actual = summary.lines.resultadoOperacional?.[monthIndex] ?? 0;

    if (Math.abs(actual - expected) > 0.005) {
      return true;
    }
  }

  return false;
}

export async function getAccountingMappingVersion(accountingId: string): Promise<number> {
  const accounting = await prisma.accounting.findUnique({
    where: { id: accountingId },
    select: { mapping_version: true },
  });

  return accounting?.mapping_version ?? 1;
}

export async function bumpAccountingMappingVersion(accountingId: string): Promise<number> {
  const accounting = await prisma.accounting.update({
    where: { id: accountingId },
    data: {
      mapping_version: {
        increment: 1,
      },
    },
    select: {
      mapping_version: true,
    },
  });

  return accounting.mapping_version;
}

async function findCurrentSnapshot(params: {
  clientId: string;
  year: number;
  statementType: StatementType;
  mappingVersion: number;
}) {
  return prisma.statementSnapshot.findUnique({
    where: {
      client_id_year_statement_type_mapping_version: {
        client_id: params.clientId,
        year: params.year,
        statement_type: params.statementType,
        mapping_version: params.mappingVersion,
      },
    },
  });
}

async function findLatestSnapshot(params: {
  clientId: string;
  year: number;
  statementType: StatementType;
}) {
  return prisma.statementSnapshot.findFirst({
    where: {
      client_id: params.clientId,
      year: params.year,
      statement_type: params.statementType,
    },
    orderBy: [{ mapping_version: "desc" }, { computed_at: "desc" }],
  });
}

async function persistSnapshot(params: {
  accountingId: string;
  clientId: string;
  year: number;
  statementType: StatementType;
  mappingVersion: number;
  status: SnapshotStatus;
  summary: unknown;
  metrics?: unknown;
  lines: Array<{
    line_key: string;
    label: string;
    section?: string | null;
    kind?: string | null;
    sort_order: number;
    values_json: unknown;
  }>;
}) {
  const snapshot = await prisma.statementSnapshot.upsert({
    where: {
      client_id_year_statement_type_mapping_version: {
        client_id: params.clientId,
        year: params.year,
        statement_type: params.statementType,
        mapping_version: params.mappingVersion,
      },
    },
    update: {
      status: params.status,
      summary_json: toJsonValue(params.summary),
      metrics_json: params.metrics === undefined ? Prisma.JsonNull : toJsonValue(params.metrics),
      computed_at: new Date(),
    },
    create: {
      accounting_id: params.accountingId,
      client_id: params.clientId,
      year: params.year,
      statement_type: params.statementType,
      mapping_version: params.mappingVersion,
      status: params.status,
      summary_json: toJsonValue(params.summary),
      metrics_json: params.metrics === undefined ? Prisma.JsonNull : toJsonValue(params.metrics),
    },
    select: {
      id: true,
      computed_at: true,
      status: true,
    },
  });

  await prisma.statementLineSnapshot.deleteMany({
    where: {
      snapshot_id: snapshot.id,
    },
  });

  if (params.lines.length > 0) {
    await prisma.statementLineSnapshot.createMany({
      data: params.lines.map((line) => ({
        snapshot_id: snapshot.id,
        line_key: line.line_key,
        label: line.label,
        section: line.section ?? null,
        kind: line.kind ?? null,
        sort_order: line.sort_order,
        values_json: toJsonValue(line.values_json),
      })),
    });
  }

  return snapshot;
}

function buildDreCards(lines: DreStatementResult["lines"], activeMonthIndex: number) {
  return {
    receitaBruta: lines.receitaBruta[activeMonthIndex] ?? 0,
    custosDespesas: Math.abs(
      (lines.custosVendas[activeMonthIndex] ?? 0) +
        (lines.custosServicos[activeMonthIndex] ?? 0) +
        (lines.despesasAdministrativas[activeMonthIndex] ?? 0) +
        (lines.despesasComerciais[activeMonthIndex] ?? 0) +
        (lines.despesasTributarias[activeMonthIndex] ?? 0) +
        (lines.outrasDespesas[activeMonthIndex] ?? 0) +
        (lines.despesasFinanceiras[activeMonthIndex] ?? 0)
    ),
    resultadoLiquido: lines.lucroLiquido[activeMonthIndex] ?? 0,
    irpjCsll: Math.abs(lines.irpjCsll[activeMonthIndex] ?? 0),
  };
}

function buildDreChart(lines: DreStatementResult["lines"], activeMonthIndex: number) {
  return {
    custoVenda: Math.abs(lines.custosVendas[activeMonthIndex] ?? 0),
    impostos: Math.abs((lines.deducoes[activeMonthIndex] ?? 0) + (lines.irpjCsll[activeMonthIndex] ?? 0)),
    despesas: Math.abs(
      (lines.despesasAdministrativas[activeMonthIndex] ?? 0) +
        (lines.despesasComerciais[activeMonthIndex] ?? 0) +
        (lines.despesasTributarias[activeMonthIndex] ?? 0) +
        (lines.outrasDespesas[activeMonthIndex] ?? 0) +
        (lines.despesasFinanceiras[activeMonthIndex] ?? 0)
    ),
    lucro: Math.max(lines.lucroLiquido[activeMonthIndex] ?? 0, 0),
  };
}

function applyActiveMonthToDre(statement: DreStatementResult, requestedMonth?: number): DreStatementResult {
  const activeMonthIndex = parseRequestedMonth(requestedMonth) ?? statement.activeMonthIndex;
  const cards = buildDreCards(statement.lines, activeMonthIndex);
  const chart = buildDreChart(statement.lines, activeMonthIndex);
  const summaryRows = statement.summaryRows.map((row) => {
    const matching = statement.rows.find((item) => item.label === row.label);
    const value = matching?.monthly[activeMonthIndex] ?? 0;
    return {
      label: row.label,
      value,
      percent: cards.receitaBruta === 0 ? 0 : (Math.abs(value) / Math.abs(cards.receitaBruta)) * 100,
    };
  });

  return {
    ...statement,
    activeMonthIndex,
    cards,
    chart,
    summaryRows,
  };
}

function buildPatrimonialMetrics(input: {
  patrimonial: PatrimonialStatementResult;
  dre: DreStatementResult;
  activeMonthIndex: number;
}): {
  liquidity: MetricItem[];
  profitability: MetricItem[];
  activity: MetricItem[];
} {
  const monthIndex = input.activeMonthIndex;
  const totals = input.patrimonial.totals;
  const categorySeries = input.patrimonial.categorySeries;
  const dre = input.dre.lines;

  const ativoCirculante = totals.ativoCirculante[monthIndex] ?? 0;
  const ativoNaoCirculante = totals.ativoNaoCirculante[monthIndex] ?? 0;
  const passivoCirculante = totals.passivoCirculante[monthIndex] ?? 0;
  const passivoNaoCirculante = totals.passivoNaoCirculante[monthIndex] ?? 0;
  const patrimonioLiquido = totals.patrimonioLiquido[monthIndex] ?? 0;
  const totalAtivo = totals.totalAtivo[monthIndex] ?? 0;
  const receitaBruta = dre.receitaBruta[monthIndex] ?? 0;
  const receitaLiquida = dre.receitaLiquida[monthIndex] ?? 0;
  const lair = dre.lair[monthIndex] ?? 0;
  const lucroLiquido = dre.lucroLiquido[monthIndex] ?? 0;
  const custos = Math.abs(dre.custosVendas[monthIndex] ?? 0) + Math.abs(dre.custosServicos[monthIndex] ?? 0);
  const estoque = categorySeries.estoques[monthIndex] ?? 0;
  const clientes = categorySeries.clientes[monthIndex] ?? 0;
  const fornecedores = categorySeries.fornecedores[monthIndex] ?? 0;

  const safeDivide = (numerator: number, denominator: number) => {
    if (!denominator) return 0;
    return numerator / denominator;
  };

  const liquidityCorrente = safeDivide(ativoCirculante, Math.abs(passivoCirculante));
  const liquidityImediata = safeDivide(categorySeries.disponivel[monthIndex] ?? 0, Math.abs(passivoCirculante));
  const liquiditySeca = safeDivide(ativoCirculante - Math.abs(estoque), Math.abs(passivoCirculante));
  const liquidityGeral = safeDivide(
    ativoCirculante + ativoNaoCirculante,
    Math.abs(passivoCirculante) + Math.abs(passivoNaoCirculante)
  );
  const participacaoTerceiros = safeDivide(
    Math.abs(passivoCirculante) + Math.abs(passivoNaoCirculante),
    Math.abs(totalAtivo)
  );

  const roe = safeDivide(lucroLiquido, Math.abs(patrimonioLiquido));
  const roa = safeDivide(lucroLiquido, Math.abs(totalAtivo));
  const margemLiquida = safeDivide(lucroLiquido, Math.abs(receitaBruta));
  const giroAtivo = safeDivide(receitaLiquida, Math.abs(totalAtivo));
  const roic = safeDivide(lair, Math.abs(totalAtivo));

  const rotacaoEstoques = safeDivide(Math.abs(custos), Math.abs(estoque));
  const prazoMedioEstoque = rotacaoEstoques === 0 ? 0 : 360 / rotacaoEstoques;
  const pmc = safeDivide(Math.abs(clientes), Math.abs(receitaLiquida)) * 360;
  const pmp = safeDivide(Math.abs(fornecedores), Math.abs(custos)) * 360;
  const cicloFinanceiro = pmc - pmp;

  return {
    liquidity: [
      { label: "Liquidez Corrente", value: liquidityCorrente, format: "ratio" },
      { label: "Liquidez Imediata", value: liquidityImediata, format: "ratio" },
      { label: "Liquidez Seca", value: liquiditySeca, format: "ratio" },
      { label: "Liquidez Geral", value: liquidityGeral, format: "ratio" },
      { label: "Participacao de Terceiros", value: participacaoTerceiros, format: "percent" },
    ],
    profitability: [
      { label: "Margem Liquida (ML)", value: margemLiquida, format: "percent" },
      { label: "ROE", value: roe, format: "percent" },
      { label: "ROA", value: roa, format: "percent" },
      { label: "ROIC", value: roic, format: "percent" },
      { label: "Giro do Ativo (GA)", value: giroAtivo, format: "ratio" },
      { label: "EBITDA", value: dre.ebitda[monthIndex] ?? 0, format: "currency" },
    ],
    activity: [
      { label: "Rotacao Estoques (RE)", value: rotacaoEstoques, format: "ratio" },
      { label: "Prazo Medio Estoque", value: prazoMedioEstoque, format: "days" },
      { label: "PMC (Dias)", value: pmc, format: "days" },
      { label: "PMP (Dias)", value: pmp, format: "days" },
      { label: "Ciclo Financeiro", value: cicloFinanceiro, format: "days" },
    ],
  };
}

function applyActiveMonthToPatrimonial(statement: PatrimonialStatementResult, requestedMonth?: number) {
  const activeMonthIndex = parseRequestedMonth(requestedMonth) ?? statement.activeMonthIndex;

  return {
    ...statement,
    activeMonthIndex,
    closedRows: [
      { label: "Total do Ativo", value: statement.totals.totalAtivo[activeMonthIndex] ?? 0 },
      { label: "Patrimonio Liquido", value: statement.totals.patrimonioLiquido[activeMonthIndex] ?? 0 },
      { label: "Total do Passivo", value: statement.totals.totalPassivo[activeMonthIndex] ?? 0 },
    ],
    graphCards: statement.graphCards.map((card) => ({
      ...card,
      value: card.series[activeMonthIndex] ?? 0,
    })),
  };
}

function applyActiveMonthToDfc(statement: DfcStatementResult, requestedMonth?: number) {
  const activeMonthIndex = parseRequestedMonth(requestedMonth) ?? statement.activeMonthIndex;

  return {
    ...statement,
    activeMonthIndex,
    cards: statement.cards.map((card) => {
      const line = statement.rows.find((row) => row.label === card.label);
      return {
        label: card.label,
        value: line?.monthly[activeMonthIndex] ?? card.value,
      };
    }),
    closedRows: statement.closedRows.map((row) => {
      const line = statement.rows.find((item) => item.label === row.label);
      return {
        label: row.label,
        value: line?.monthly[activeMonthIndex] ?? row.value,
      };
    }),
  };
}

async function loadChartAccounts(accountingId: string, clientId: string) {
  const [globalAccounts, clientAccounts] = await Promise.all([
    prisma.chartOfAccounts.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
      },
      orderBy: [{ level: "asc" }, { code: "asc" }],
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
    prisma.chartOfAccounts.findMany({
      where: {
        accounting_id: accountingId,
        client_id: clientId,
      },
      orderBy: [{ level: "asc" }, { code: "asc" }],
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
  ]);

  return [...globalAccounts, ...clientAccounts];
}

async function loadDreMappings(accountingId: string, clientId: string) {
  const [globalMappings, clientMappings] = await Promise.all([
    prisma.dREMapping.findMany({
      where: {
        accounting_id: accountingId,
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
        accounting_id: accountingId,
        client_id: clientId,
      },
      select: {
        account_code: true,
        category: true,
        client_id: true,
      },
    }),
  ]);

  return [...globalMappings, ...clientMappings];
}

async function loadPatrimonialMappings(accountingId: string, clientId: string) {
  const [globalMappings, clientMappings] = await Promise.all([
    prisma.patrimonialMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
      },
      select: {
        account_code: true,
        category: true,
        client_id: true,
      },
    }),
    prisma.patrimonialMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: clientId,
      },
      select: {
        account_code: true,
        category: true,
        client_id: true,
      },
    }),
  ]);

  return [...globalMappings, ...clientMappings];
}

async function loadDfcMappings(accountingId: string, clientId: string) {
  const [globalMappings, clientMappings] = await Promise.all([
    prisma.dFCLineMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: null,
      },
      select: {
        line_key: true,
        account_code_snapshot: true,
        reduced_code_snapshot: true,
        source_type: true,
        multiplier: true,
        include_children: true,
      },
    }),
    prisma.dFCLineMapping.findMany({
      where: {
        accounting_id: accountingId,
        client_id: clientId,
      },
      select: {
        line_key: true,
        account_code_snapshot: true,
        reduced_code_snapshot: true,
        source_type: true,
        multiplier: true,
        include_children: true,
      },
    }),
  ]);

  return Array.from(
    new Map(
      [...globalMappings, ...clientMappings].map((mapping) => {
        const normalized = {
          ...mapping,
          line_key: getCanonicalDfcLineKey(mapping.line_key),
        };

        return [
          [
            normalized.line_key,
            normalized.account_code_snapshot,
            normalized.reduced_code_snapshot ?? "",
            normalized.source_type,
            normalized.multiplier,
            normalized.include_children ? "1" : "0",
          ].join("::"),
          normalized,
        ];
      })
    ).values()
  );
}

async function loadMovements(clientId: string, year: number, type: "dre" | "patrimonial") {
  const movements = await prisma.monthlyMovement.findMany({
    where: {
      client_id: clientId,
      year,
      deleted_at: null,
      type,
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
  });

  return movements.map((movement) => ({
    ...movement,
    type: movement.type as "dre" | "patrimonial",
  }));
}

async function loadDfcBalanceteRowsByMonth(clientId: string, year: number) {
  const documents = await prisma.clientDocument.findMany({
    where: {
      client_id: clientId,
      period_year: year,
      document_type: "dfc_balancete_import",
      deleted_at: null,
    },
    select: {
      period_month: true,
      storage_path: true,
      content: true,
      updated_at: true,
    },
    orderBy: [{ period_month: "asc" }, { updated_at: "desc" }],
  });

  const latestByMonth = new Map<number, (typeof documents)[number]>();
  for (const document of documents) {
    const month = document.period_month;
    if (!month || latestByMonth.has(month)) {
      continue;
    }
    latestByMonth.set(month, document);
  }

  const monthlyRowsByMonth = Array.from({ length: 12 }, () => undefined as DfcMonthlyBalanceteLike[] | undefined);

  for (const [month, document] of latestByMonth.entries()) {
    let bytes = document.content ? Buffer.from(document.content) : null;

    if (!bytes && document.storage_path) {
      const filePath = isAbsolute(document.storage_path)
        ? document.storage_path
        : resolve(process.cwd(), document.storage_path);

      try {
        bytes = await readFile(filePath);
      } catch {
        bytes = null;
      }
    }

    if (!bytes) {
      continue;
    }

    const rows = parseMonthlyBalanceteDetailedFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    );

    monthlyRowsByMonth[month - 1] = rows;
  }

  return monthlyRowsByMonth;
}

async function computeDrePayload(params: {
  accountingId: string;
  clientId: string;
  year: number;
}) {
  const [movements, chartAccounts, mappings] = await Promise.all([
    loadMovements(params.clientId, params.year, "dre"),
    loadChartAccounts(params.accountingId, params.clientId),
    loadDreMappings(params.accountingId, params.clientId),
  ]);

  if (movements.length === 0) {
    return emptyDreStatement(params.year);
  }

  return buildDreStatement({
    year: params.year,
    movements: movements as DreMovementLike[],
    chartAccounts: chartAccounts as DreChartAccountLike[],
    mappings: mappings as DreMappingLike[],
  });
}

async function computePatrimonialPayload(params: {
  accountingId: string;
  clientId: string;
  year: number;
}) {
  const [movements, dreMovements, chartAccounts, mappings] = await Promise.all([
    loadMovements(params.clientId, params.year, "patrimonial"),
    loadMovements(params.clientId, params.year, "dre"),
    loadChartAccounts(params.accountingId, params.clientId),
    loadPatrimonialMappings(params.accountingId, params.clientId),
  ]);

  if (movements.length === 0) {
    return emptyPatrimonialStatement(params.year);
  }

  return buildPatrimonialStatement({
    year: params.year,
    movements: movements as PatrimonialMovementLike[],
    dreMovements: dreMovements as PatrimonialMovementLike[],
    chartAccounts: chartAccounts as PatrimonialChartAccountLike[],
    mappings: mappings as PatrimonialMappingLike[],
  });
}

async function computeDfcPayload(params: {
  accountingId: string;
  clientId: string;
  year: number;
  dre?: DreStatementResult;
}) {
  const [
    dre,
    dreMovements,
    currentPatrimonialMovements,
    previousPatrimonialMovements,
    mappings,
    monthlyBalanceteRowsByMonth,
  ] =
    await Promise.all([
      params.dre ? Promise.resolve(params.dre) : computeDrePayload(params),
      loadMovements(params.clientId, params.year, "dre"),
      loadMovements(params.clientId, params.year, "patrimonial"),
      loadMovements(params.clientId, params.year - 1, "patrimonial"),
      loadDfcMappings(params.accountingId, params.clientId),
      loadDfcBalanceteRowsByMonth(params.clientId, params.year),
    ]);

  const hasMonthlyBalanceteBase =
    monthlyBalanceteRowsByMonth.some((rows) => (rows?.length ?? 0) > 0);

  if (!hasMonthlyBalanceteBase && mappings.length === 0) {
    return emptyDfcStatement(params.year, "partial");
  }

  return buildDfcStatement({
    year: params.year,
    dre,
    currentPatrimonialMovements: currentPatrimonialMovements as DfcMovementLike[],
    previousYearPatrimonialMovements: previousPatrimonialMovements as DfcMovementLike[],
    dreMovements: dreMovements as DfcMovementLike[],
    mappings: mappings as DfcMappingLike[],
    monthlyBalanceteRowsByMonth,
  });
}

export async function rebuildDreSnapshot(params: {
  accountingId: string;
  clientId: string;
  year: number;
}) {
  const mappingVersion = await getAccountingMappingVersion(params.accountingId);
  const summary = await computeDrePayload(params);
  const snapshot = await persistSnapshot({
    accountingId: params.accountingId,
    clientId: params.clientId,
    year: params.year,
    statementType: "dre",
    mappingVersion,
    status: "ready",
    summary,
    lines: summary.rows.map((row, index) => ({
      line_key: row.key,
      label: row.label,
      section: "dre",
      kind: "row",
      sort_order: index,
      values_json: row.monthly,
    })),
  });

  return {
    snapshot,
    summary,
    mappingVersion,
  };
}

export async function rebuildPatrimonialSnapshot(params: {
  accountingId: string;
  clientId: string;
  year: number;
  dre?: DreStatementResult;
}) {
  const mappingVersion = await getAccountingMappingVersion(params.accountingId);
  const [summary, dre] = await Promise.all([
    computePatrimonialPayload(params),
    params.dre ? Promise.resolve(params.dre) : computeDrePayload(params),
  ]);
  const metrics = buildPatrimonialMetrics({
    patrimonial: summary,
    dre,
    activeMonthIndex: summary.activeMonthIndex,
  });

  const snapshot = await persistSnapshot({
    accountingId: params.accountingId,
    clientId: params.clientId,
    year: params.year,
    statementType: "patrimonial",
    mappingVersion,
    status: "ready",
    summary,
    metrics,
    lines: summary.rows.map((row, index) => ({
      line_key: row.key,
      label: row.label,
      section: row.level === 0 ? row.label : null,
      kind: "row",
      sort_order: index,
      values_json: row.monthly,
    })),
  });

  return {
    snapshot,
    summary,
    metrics,
    mappingVersion,
  };
}

export async function rebuildDfcSnapshot(params: {
  accountingId: string;
  clientId: string;
  year: number;
  dre?: DreStatementResult;
}) {
  const mappingVersion = await getAccountingMappingVersion(params.accountingId);
  const summary = await computeDfcPayload(params);
  const snapshot = await persistSnapshot({
    accountingId: params.accountingId,
    clientId: params.clientId,
    year: params.year,
    statementType: "dfc",
    mappingVersion,
    status: summary.status,
    summary,
    lines: summary.rows.map((row, index) => ({
      line_key: row.key,
      label: row.label,
      section: row.section,
      kind: row.kind,
      sort_order: index,
      values_json: row.monthly,
    })),
  });

  return {
    snapshot,
    summary,
    mappingVersion,
  };
}

export async function rebuildStatements(params: {
  accountingId: string;
  clientId: string;
  year: number;
  statementType?: StatementType | "all";
}) {
  const type = params.statementType ?? "all";

  if (type === "dre") {
    const dre = await rebuildDreSnapshot(params);
    return { dre: dre.summary };
  }

  if (type === "patrimonial") {
    const [dre, patrimonial] = await Promise.all([
      computeDrePayload(params),
      rebuildPatrimonialSnapshot(params),
    ]);
    return { dre, patrimonial: patrimonial.summary };
  }

  if (type === "dfc") {
    const dre = await computeDrePayload(params);
    const dfc = await rebuildDfcSnapshot({ ...params, dre });
    return { dre, dfc: dfc.summary };
  }

  const dre = await rebuildDreSnapshot(params);
  const patrimonial = await rebuildPatrimonialSnapshot({ ...params, dre: dre.summary });
  const dfc = await rebuildDfcSnapshot({ ...params, dre: dre.summary });

  return {
    dre: dre.summary,
    patrimonial: patrimonial.summary,
    dfc: dfc.summary,
  };
}

async function getSnapshotEnvelope<T>(params: {
  accountingId: string;
  clientId: string;
  year: number;
  statementType: StatementType;
  build: () => Promise<{ summary: T; metrics?: unknown; status?: SnapshotStatus }>;
  requestedMonth?: number;
  applyMonth?: (payload: T, requestedMonth?: number) => T;
  shouldRebuildSnapshot?: (payload: T) => boolean;
}) {
  const mappingVersion = await getAccountingMappingVersion(params.accountingId);
  const currentSnapshot = await findCurrentSnapshot({
    clientId: params.clientId,
    year: params.year,
    statementType: params.statementType,
    mappingVersion,
  });

  if (currentSnapshot) {
    const payload = toTyped<T>(currentSnapshot.summary_json);
    if (!params.shouldRebuildSnapshot || !params.shouldRebuildSnapshot(payload)) {
      return {
        payload: params.applyMonth ? params.applyMonth(payload, params.requestedMonth) : payload,
        stale: false,
        snapshotStatus: currentSnapshot.status,
        mappingVersion: currentSnapshot.mapping_version,
        computedAt: currentSnapshot.computed_at.toISOString(),
      } satisfies SnapshotEnvelope<T>;
    }
  }

  const latestSnapshot = await findLatestSnapshot({
    clientId: params.clientId,
    year: params.year,
    statementType: params.statementType,
  });

  if (latestSnapshot) {
    const payload = toTyped<T>(latestSnapshot.summary_json);
    if (!params.shouldRebuildSnapshot || !params.shouldRebuildSnapshot(payload)) {
      return {
        payload: params.applyMonth ? params.applyMonth(payload, params.requestedMonth) : payload,
        stale: true,
        snapshotStatus: latestSnapshot.status,
        mappingVersion: latestSnapshot.mapping_version,
        computedAt: latestSnapshot.computed_at.toISOString(),
      } satisfies SnapshotEnvelope<T>;
    }
  }

  const built = await params.build();
  const rows = (built.summary as SnapshotSummaryWithRows).rows ?? [];
  const persisted = await persistSnapshot({
    accountingId: params.accountingId,
    clientId: params.clientId,
    year: params.year,
    statementType: params.statementType,
    mappingVersion,
    status: built.status ?? "ready",
    summary: built.summary,
    metrics: built.metrics,
    lines: rows.map((row, index) => ({
      line_key: row.key ?? row.label,
      label: row.label,
      section: row.section ?? null,
      kind: row.kind ?? "row",
      sort_order: index,
      values_json: row.monthly ?? [],
    })),
  });

  return {
    payload: params.applyMonth ? params.applyMonth(built.summary, params.requestedMonth) : built.summary,
    stale: false,
    snapshotStatus: persisted.status,
    mappingVersion,
    computedAt: persisted.computed_at.toISOString(),
  } satisfies SnapshotEnvelope<T>;
}

export async function getDreSnapshotEnvelope(params: {
  accountingId: string;
  clientId: string;
  year: number;
  requestedMonth?: number;
}) {
  return getSnapshotEnvelope<DreStatementResult>({
    ...params,
    statementType: "dre",
    applyMonth: applyActiveMonthToDre,
    shouldRebuildSnapshot: isLikelyCumulativeDreSummary,
    build: async () => ({
      summary: await computeDrePayload(params),
      status: "ready",
    }),
  });
}

export async function getPatrimonialSnapshotEnvelope(params: {
  accountingId: string;
  clientId: string;
  year: number;
  requestedMonth?: number;
}) {
  const dreEnvelope = await getDreSnapshotEnvelope(params);
  const patrimonialEnvelope = await getSnapshotEnvelope<PatrimonialStatementResult>({
    ...params,
    statementType: "patrimonial",
    applyMonth: applyActiveMonthToPatrimonial,
    build: async () => {
      const summary = await computePatrimonialPayload(params);
      const dreSummary = dreEnvelope.payload;
      return {
        summary,
        metrics: buildPatrimonialMetrics({
          patrimonial: summary,
          dre: dreSummary,
          activeMonthIndex: summary.activeMonthIndex,
        }),
        status: "ready",
      };
    },
  });

  const patrimonial = patrimonialEnvelope.payload;
  const activeMonthIndex = patrimonial.activeMonthIndex;

  return {
    ...patrimonialEnvelope,
    payload: {
      year: patrimonial.year,
      monthLabels: patrimonial.monthLabels,
      activeMonthIndex,
      activeMonthLabel: patrimonial.monthLabels[activeMonthIndex] ?? "Jan",
      closedRows: patrimonial.closedRows,
      graphCards: patrimonial.graphCards,
      rows: patrimonial.rows,
      totals: patrimonial.totals,
      metrics: buildPatrimonialMetrics({
        patrimonial,
        dre: dreEnvelope.payload,
        activeMonthIndex,
      }),
    },
  };
}

export async function getDfcSnapshotEnvelope(params: {
  accountingId: string;
  clientId: string;
  year: number;
  requestedMonth?: number;
}) {
  const dreEnvelope = await getDreSnapshotEnvelope(params);
  return getSnapshotEnvelope<DfcStatementResult>({
    ...params,
    statementType: "dfc",
    applyMonth: applyActiveMonthToDfc,
    shouldRebuildSnapshot: isLikelyOutdatedDfcSummary,
    build: async () => {
      const summary = await computeDfcPayload({
        ...params,
        dre: dreEnvelope.payload,
      });
      return {
        summary,
        status: summary.status,
      };
    },
  });
}

export async function openImportBatch(params: {
  accountingId: string;
  clientId?: string;
  year?: number;
  kind: string;
  fileName?: string;
  batchIndex: number;
}) {
  if (params.batchIndex === 0) {
    const existing = await prisma.importBatch.findFirst({
      where: {
        accounting_id: params.accountingId,
        client_id: params.clientId ?? null,
        year: params.year ?? null,
        kind: params.kind,
        status: "processing",
      },
      orderBy: {
        started_at: "desc",
      },
    });

    if (existing) {
      throw new Error("Ja existe uma importacao em processamento para este cliente/ano.");
    }

    return prisma.importBatch.create({
      data: {
        accounting_id: params.accountingId,
        client_id: params.clientId ?? null,
        year: params.year ?? null,
        kind: params.kind,
        file_name: params.fileName,
        status: "processing",
      },
    });
  }

  const existing = await prisma.importBatch.findFirst({
    where: {
      accounting_id: params.accountingId,
      client_id: params.clientId ?? null,
      year: params.year ?? null,
      kind: params.kind,
      status: "processing",
    },
    orderBy: {
      started_at: "desc",
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.importBatch.create({
    data: {
      accounting_id: params.accountingId,
      client_id: params.clientId ?? null,
      year: params.year ?? null,
      kind: params.kind,
      file_name: params.fileName,
      status: "processing",
    },
  });
}

export async function updateImportBatchProgress(params: {
  batchId: string;
  processedRows: number;
  errorCount?: number;
}) {
  return prisma.importBatch.update({
    where: { id: params.batchId },
    data: {
      row_count: {
        increment: params.processedRows,
      },
      error_count: {
        increment: params.errorCount ?? 0,
      },
    },
  });
}

export async function completeImportBatch(params: {
  batchId: string;
  status?: "ready" | "failed";
  errorMessage?: string;
}) {
  return prisma.importBatch.update({
    where: { id: params.batchId },
    data: {
      status: params.status ?? "ready",
      error_message: params.errorMessage ?? null,
      finished_at: new Date(),
    },
  });
}

export async function failImportBatch(params: {
  batchId?: string;
  errorMessage: string;
}) {
  if (!params.batchId) return null;

  return prisma.importBatch.update({
    where: { id: params.batchId },
    data: {
      status: "failed",
      error_message: params.errorMessage,
      finished_at: new Date(),
    },
  });
}
