import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireClient } from "@/lib/auth-guard";
import { buildDreStatement, emptyDreStatement } from "@/lib/dre-statement";
import {
  buildPatrimonialStatement,
  emptyPatrimonialStatement,
} from "@/lib/patrimonial-statement";
import { success, handleError } from "@/lib/api-response";

type MetricItem = {
  label: string;
  value: number;
  format: "ratio" | "percent" | "currency" | "days";
};

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

function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

function buildMetrics(input: {
  patrimonial: ReturnType<typeof buildPatrimonialStatement>;
  dre: ReturnType<typeof buildDreStatement>;
  activeMonthIndex: number;
}): {
  liquidity: MetricItem[];
  profitability: MetricItem[];
  activity: MetricItem[];
} {
  const monthIndex = input.activeMonthIndex;
  const totals = input.patrimonial.totals;
  const sectionSeries = input.patrimonial.sectionSeries;
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
  const custos =
    Math.abs(dre.custosVendas[monthIndex] ?? 0) +
    Math.abs(dre.custosServicos[monthIndex] ?? 0);
  const despesas =
    Math.abs(dre.despesasAdministrativas[monthIndex] ?? 0) +
    Math.abs(dre.despesasComerciais[monthIndex] ?? 0) +
    Math.abs(dre.despesasTributarias[monthIndex] ?? 0) +
    Math.abs(dre.despesasFinanceiras[monthIndex] ?? 0);
  const estoque = categorySeries.estoques[monthIndex] ?? 0;
  const clientes = categorySeries.clientes[monthIndex] ?? 0;
  const fornecedores = categorySeries.fornecedores[monthIndex] ?? 0;

  const liquidityCorrente = safeDivide(ativoCirculante, Math.abs(passivoCirculante));
  const liquidityImediata = safeDivide(
    categorySeries.disponivel[monthIndex] ?? 0,
    Math.abs(passivoCirculante)
  );
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

    const [latestPatrimonialMovement, latestDreMovement] = requestedYear
      ? [null, null]
      : await Promise.all([
          prisma.monthlyMovement.findFirst({
            where: {
              client_id: client.id,
              deleted_at: null,
              type: "patrimonial",
            },
            orderBy: [{ year: "desc" }, { updated_at: "desc" }],
            select: { year: true },
          }),
          prisma.monthlyMovement.findFirst({
            where: {
              client_id: client.id,
              deleted_at: null,
              type: "dre",
            },
            orderBy: [{ year: "desc" }, { updated_at: "desc" }],
            select: { year: true },
          }),
        ]);

    const year =
      requestedYear ?? latestPatrimonialMovement?.year ?? latestDreMovement?.year ?? new Date().getFullYear();
    const activeMonthIndex = requestedMonth ?? undefined;

    const [
      patrimonialMovements,
      dreMovements,
      globalAccounts,
      clientAccounts,
      globalDreMappings,
      clientDreMappings,
      globalPatrimonialMappings,
      clientPatrimonialMappings,
    ] = await Promise.all([
      prisma.monthlyMovement.findMany({
        where: {
          client_id: client.id,
          year,
          deleted_at: null,
          type: "patrimonial",
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
      prisma.patrimonialMapping.findMany({
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
      prisma.patrimonialMapping.findMany({
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

    const typedPatrimonialMovements = patrimonialMovements.map((movement) => ({
      ...movement,
      type: movement.type as "dre" | "patrimonial",
    }));

    const typedDreMovements = dreMovements.map((movement) => ({
      ...movement,
      type: movement.type as "dre" | "patrimonial",
    }));

    const patrimonialStatement =
      typedPatrimonialMovements.length === 0
        ? emptyPatrimonialStatement(year)
        : buildPatrimonialStatement({
            year,
            movements: typedPatrimonialMovements,
            chartAccounts: [...globalAccounts, ...clientAccounts],
            mappings: [...globalPatrimonialMappings, ...clientPatrimonialMappings],
            activeMonthIndex,
          });

    const dreStatement =
      typedDreMovements.length === 0
        ? emptyDreStatement(year)
        : buildDreStatement({
            year,
            movements: typedDreMovements,
            chartAccounts: [...globalAccounts, ...clientAccounts],
            mappings: [...globalDreMappings, ...clientDreMappings],
            activeMonthIndex,
          });

    const metrics = buildMetrics({
      patrimonial: patrimonialStatement,
      dre: dreStatement,
      activeMonthIndex: patrimonialStatement.activeMonthIndex,
    });

    return success({
      year,
      monthLabels: patrimonialStatement.monthLabels,
      activeMonthIndex: patrimonialStatement.activeMonthIndex,
      activeMonthLabel: patrimonialStatement.monthLabels[patrimonialStatement.activeMonthIndex] ?? "Jan",
      closedRows: patrimonialStatement.closedRows,
      graphCards: patrimonialStatement.graphCards,
      rows: patrimonialStatement.rows,
      totals: patrimonialStatement.totals,
      metrics,
    });
  } catch (err) {
    return handleError(err);
  }
}
