import type { DreStatementResult } from "@/lib/dre-statement";
import { getCanonicalDfcLineKey } from "@/lib/dfc-lines";

export type DfcSourceType = "dre" | "asset" | "liability" | "equity" | "cash" | "manual";

export type DfcLineKey =
  | "resultadoLiquidoExercicio"
  | "depreciacaoAmortizacao"
  | "resultadoVendaAtivoImobilizado"
  | "resultadoEquivalenciaPatrimonial"
  | "recebimentosLucrosDividendosSubsidiarias"
  | "contasReceber"
  | "adiantamentos"
  | "impostosCompensar"
  | "estoques"
  | "despesasAntecipadas"
  | "outrasContasReceber"
  | "fornecedores"
  | "obrigacoesTrabalhistas"
  | "obrigacoesTributarias"
  | "outrasObrigacoes"
  | "parcelamentos"
  | "recebimentosVendasAtivo"
  | "comprasImobilizado"
  | "aquisicoesInvestimentos"
  | "baixaAtivoImobilizado"
  | "integralizacaoAumentoCapitalSocial"
  | "pagamentoLucrosDividendos"
  | "variacaoEmprestimosFinanciamentos"
  | "dividendosProvisionadosPagar"
  | "variacaoEmprestimosPessoasLigadas"
  | "disponibilidadesBase"
  | "lucroAjustado"
  | "variacaoAtivo"
  | "variacaoPassivo"
  | "resultadoOperacional"
  | "resultadoInvestimento"
  | "resultadoFinanceiro"
  | "saldoInicialDisponivel"
  | "saldoFinalDisponivel"
  | "resultadoGeracaoCaixa";

export interface DfcMovementLike {
  code: string;
  name: string;
  values: number[];
}

export interface DfcMappingLike {
  line_key: string;
  account_code_snapshot: string;
  reduced_code_snapshot?: string | null;
  source_type: string;
  multiplier: number;
  include_children: boolean;
}

export interface DfcStatementRow {
  key: DfcLineKey;
  label: string;
  section: string;
  kind: "section" | "row" | "subtotal";
  level: number;
  monthly: number[];
  accumulated: number;
  percent: number | null;
}

export interface DfcStatementResult {
  year: number;
  monthLabels: string[];
  activeMonthIndex: number;
  status: "ready" | "partial";
  warnings: string[];
  lines: Record<DfcLineKey, number[]>;
  rows: DfcStatementRow[];
  closedRows: Array<{ label: string; value: number }>;
  cards: Array<{ label: string; value: number }>;
}

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const DFC_LINE_CONFIG: Array<{
  key: DfcLineKey;
  label: string;
  section: string;
  kind: "section" | "row" | "subtotal";
  level: number;
}> = [
  { key: "resultadoLiquidoExercicio", label: "Resultado Liquido do Exercicio", section: "resultado_contabil", kind: "row", level: 1 },
  { key: "depreciacaoAmortizacao", label: "Depreciacao e Amortizacao", section: "resultado_contabil", kind: "row", level: 1 },
  { key: "resultadoVendaAtivoImobilizado", label: "Resultado da Venda de Ativo Imobilizado", section: "resultado_contabil", kind: "row", level: 1 },
  { key: "resultadoEquivalenciaPatrimonial", label: "Resultado da Equivalencia Patrimonial", section: "resultado_contabil", kind: "row", level: 1 },
  { key: "recebimentosLucrosDividendosSubsidiarias", label: "Recebimentos de Lucros e Dividendos de Subsidiarias", section: "resultado_contabil", kind: "row", level: 1 },
  { key: "lucroAjustado", label: "Lucro Ajustado", section: "resultado_contabil", kind: "subtotal", level: 0 },
  { key: "contasReceber", label: "Contas a Receber", section: "operacional", kind: "row", level: 1 },
  { key: "adiantamentos", label: "Adiantamentos", section: "operacional", kind: "row", level: 1 },
  { key: "impostosCompensar", label: "Impostos a Compensar", section: "operacional", kind: "row", level: 1 },
  { key: "estoques", label: "Estoques", section: "operacional", kind: "row", level: 1 },
  { key: "despesasAntecipadas", label: "Despesas Antecipadas", section: "operacional", kind: "row", level: 1 },
  { key: "outrasContasReceber", label: "Outras Contas a Receber", section: "operacional", kind: "row", level: 1 },
  { key: "fornecedores", label: "Fornecedores", section: "operacional", kind: "row", level: 1 },
  { key: "obrigacoesTrabalhistas", label: "Obrigacoes Trabalhistas", section: "operacional", kind: "row", level: 1 },
  { key: "obrigacoesTributarias", label: "Obrigacoes Tributarias", section: "operacional", kind: "row", level: 1 },
  { key: "outrasObrigacoes", label: "Outras Obrigacoes", section: "operacional", kind: "row", level: 1 },
  { key: "parcelamentos", label: "Parcelamentos", section: "operacional", kind: "row", level: 1 },
  { key: "variacaoAtivo", label: "Variacao Ativo", section: "operacional", kind: "subtotal", level: 0 },
  { key: "variacaoPassivo", label: "Variacao Passivo", section: "operacional", kind: "subtotal", level: 0 },
  { key: "resultadoOperacional", label: "Resultado Operacional", section: "operacional", kind: "subtotal", level: 0 },
  { key: "recebimentosVendasAtivo", label: "Recebimentos por Vendas de Ativo", section: "investimento", kind: "row", level: 1 },
  { key: "comprasImobilizado", label: "Compras de Imobilizado", section: "investimento", kind: "row", level: 1 },
  { key: "aquisicoesInvestimentos", label: "Aquisicoes em Investimentos", section: "investimento", kind: "row", level: 1 },
  { key: "baixaAtivoImobilizado", label: "Baixa de Ativo Imobilizado", section: "investimento", kind: "row", level: 1 },
  { key: "resultadoInvestimento", label: "Resultado de Investimento", section: "investimento", kind: "subtotal", level: 0 },
  { key: "integralizacaoAumentoCapitalSocial", label: "Integralizacao ou Aumento de Capital Social", section: "financeiro", kind: "row", level: 1 },
  { key: "pagamentoLucrosDividendos", label: "Pagamento de Lucros e Dividendos", section: "financeiro", kind: "row", level: 1 },
  { key: "variacaoEmprestimosFinanciamentos", label: "Variacao em Emprestimos/Financiamentos", section: "financeiro", kind: "row", level: 1 },
  { key: "dividendosProvisionadosPagar", label: "Dividendos Provisionados a Pagar", section: "financeiro", kind: "row", level: 1 },
  { key: "variacaoEmprestimosPessoasLigadas", label: "Variacao Emprestimos Pessoas Ligadas PJ/PF", section: "financeiro", kind: "row", level: 1 },
  { key: "resultadoFinanceiro", label: "Resultado Financeiro", section: "financeiro", kind: "subtotal", level: 0 },
  { key: "saldoInicialDisponivel", label: "Saldo Inicial Disponivel", section: "caixa", kind: "row", level: 1 },
  { key: "saldoFinalDisponivel", label: "Saldo Final Disponivel", section: "caixa", kind: "row", level: 1 },
  { key: "resultadoGeracaoCaixa", label: "Resultado Geracao de Caixa", section: "caixa", kind: "subtotal", level: 0 },
];

const CONFIGURABLE_LINE_KEYS = new Set<DfcLineKey>([
  "resultadoLiquidoExercicio",
  "depreciacaoAmortizacao",
  "resultadoVendaAtivoImobilizado",
  "resultadoEquivalenciaPatrimonial",
  "recebimentosLucrosDividendosSubsidiarias",
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
  "recebimentosVendasAtivo",
  "comprasImobilizado",
  "aquisicoesInvestimentos",
  "baixaAtivoImobilizado",
  "integralizacaoAumentoCapitalSocial",
  "pagamentoLucrosDividendos",
  "variacaoEmprestimosFinanciamentos",
  "dividendosProvisionadosPagar",
  "variacaoEmprestimosPessoasLigadas",
  "disponibilidadesBase",
]);

function createZeroSeries(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

function sumValues(series: number[][]): number[] {
  const result = createZeroSeries();
  for (const values of series) {
    for (let index = 0; index < 12; index += 1) {
      result[index] += values[index] ?? 0;
    }
  }
  return result;
}

function multiplySeries(values: number[], factor: number): number[] {
  return values.map((value) => value * factor);
}

function addSeries(...series: number[][]): number[] {
  return sumValues(series);
}

function totalSeries(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function findLastActiveMonth(lines: Record<DfcLineKey, number[]>): number {
  for (let index = 11; index >= 0; index -= 1) {
    if (Object.values(lines).some((series) => Math.abs(series[index] ?? 0) > 0)) {
      return index;
    }
  }
  return 0;
}

function matchesCode(movementCode: string, mappingCode: string, includeChildren: boolean) {
  if (movementCode === mappingCode) return true;
  if (!includeChildren) return false;
  return (
    movementCode.startsWith(`${mappingCode}.`) ||
    movementCode.startsWith(`${mappingCode}-`) ||
    movementCode.startsWith(`${mappingCode}/`)
  );
}

function hasChildren(code: string, allCodes: string[]): boolean {
  return allCodes.some(
    (other) =>
      other !== code &&
      (other.startsWith(`${code}.`) || other.startsWith(`${code}-`) || other.startsWith(`${code}/`))
  );
}

function leafMovements(movements: DfcMovementLike[]): DfcMovementLike[] {
  const codes = movements.map((movement) => movement.code);
  return movements.filter((movement) => !hasChildren(movement.code, codes));
}

function aggregateDreSeries(
  movements: DfcMovementLike[],
  mappings: DfcMappingLike[]
): number[] {
  if (mappings.length === 0) return createZeroSeries();
  const leaves = leafMovements(movements);
  const collected: number[][] = [];

  for (const mapping of mappings) {
    const matched = leaves
      .filter((movement) =>
        matchesCode(movement.code, mapping.account_code_snapshot, mapping.include_children)
      )
      .map((movement) => multiplySeries(movement.values, mapping.multiplier));
    if (matched.length > 0) {
      collected.push(sumValues(matched));
    }
  }

  return sumValues(collected);
}

function aggregateBalanceSeries(
  currentMovements: DfcMovementLike[],
  previousDecemberByCode: Map<string, number>,
  mappings: DfcMappingLike[]
): number[] {
  if (mappings.length === 0) return createZeroSeries();
  const leaves = leafMovements(currentMovements);
  const collected: number[][] = [];

  for (const mapping of mappings) {
    const matched = leaves.filter((movement) =>
      matchesCode(movement.code, mapping.account_code_snapshot, mapping.include_children)
    );

    const currentSeries = matched.length > 0 ? sumValues(matched.map((movement) => movement.values)) : createZeroSeries();
    const previousDecember = matched.reduce((total, movement) => {
      return total + (previousDecemberByCode.get(movement.code) ?? 0);
    }, 0);

    const deltaSeries = currentSeries.map((value, index) => {
      const baseline = index === 0 ? previousDecember : currentSeries[index - 1] ?? 0;
      return (value - baseline) * mapping.multiplier;
    });

    collected.push(deltaSeries);
  }

  return sumValues(collected);
}

function buildPreviousDecemberLookup(movements: DfcMovementLike[]): Map<string, number> {
  return new Map(movements.map((movement) => [movement.code, movement.values[11] ?? 0]));
}

function buildEndingBalanceSeries(
  currentMovements: DfcMovementLike[],
  mappings: DfcMappingLike[]
): number[] {
  if (mappings.length === 0) return createZeroSeries();
  const leaves = leafMovements(currentMovements);
  const collected: number[][] = [];

  for (const mapping of mappings) {
    const matched = leaves
      .filter((movement) =>
        matchesCode(movement.code, mapping.account_code_snapshot, mapping.include_children)
      )
      .map((movement) => movement.values);

    if (matched.length > 0) {
      collected.push(sumValues(matched));
    }
  }

  return sumValues(collected);
}

function buildStartingBalanceSeries(endingSeries: number[], previousDecemberBalance: number): number[] {
  return endingSeries.map((_, index) => (index === 0 ? previousDecemberBalance : endingSeries[index - 1] ?? 0));
}

export function buildDfcStatement(input: {
  year: number;
  dre: DreStatementResult;
  currentPatrimonialMovements: DfcMovementLike[];
  previousYearPatrimonialMovements: DfcMovementLike[];
  dreMovements: DfcMovementLike[];
  mappings: DfcMappingLike[];
  activeMonthIndex?: number;
}): DfcStatementResult {
  const currentPatrimonialLeaves = leafMovements(input.currentPatrimonialMovements);
  const previousDecemberByCode = buildPreviousDecemberLookup(
    leafMovements(input.previousYearPatrimonialMovements)
  );

  const mappingsByLine = new Map<DfcLineKey, DfcMappingLike[]>();
  for (const mapping of input.mappings) {
    const lineKey = getCanonicalDfcLineKey(mapping.line_key) as DfcLineKey;
    if (!CONFIGURABLE_LINE_KEYS.has(lineKey)) continue;
    const current = mappingsByLine.get(lineKey) ?? [];
    current.push({
      ...mapping,
      line_key: lineKey,
    });
    mappingsByLine.set(lineKey, current);
  }

  const lines = Object.fromEntries(
    DFC_LINE_CONFIG.map((config) => [config.key, createZeroSeries()])
  ) as Record<DfcLineKey, number[]>;

  const previousPatrimonialMissing = input.previousYearPatrimonialMovements.length === 0;
  const warnings: string[] = [];
  if (previousPatrimonialMissing) {
    warnings.push("Base patrimonial de dezembro do ano anterior nao encontrada. O DFC foi marcado como parcial.");
  }

  for (const config of DFC_LINE_CONFIG) {
    if (!CONFIGURABLE_LINE_KEYS.has(config.key)) {
      continue;
    }

    const mappings = mappingsByLine.get(config.key) ?? [];
    if (mappings.length === 0) {
      continue;
    }

    const sourceType = mappings[0]?.source_type as DfcSourceType | undefined;
    const isDreSource = sourceType === "dre";

    lines[config.key] = isDreSource
      ? aggregateDreSeries(input.dreMovements, mappings)
      : aggregateBalanceSeries(currentPatrimonialLeaves, previousDecemberByCode, mappings);
  }

  if (totalSeries(lines.resultadoLiquidoExercicio) === 0) {
    lines.resultadoLiquidoExercicio = [...input.dre.lines.lucroLiquido];
  }
  if (totalSeries(lines.depreciacaoAmortizacao) === 0) {
    lines.depreciacaoAmortizacao = input.dre.lines.depreciacaoAmortizacao.map((value) => Math.abs(value));
  }

  lines.lucroAjustado = addSeries(
    lines.resultadoLiquidoExercicio,
    lines.depreciacaoAmortizacao,
    lines.resultadoVendaAtivoImobilizado,
    lines.resultadoEquivalenciaPatrimonial,
    lines.recebimentosLucrosDividendosSubsidiarias
  );

  lines.variacaoAtivo = addSeries(
    lines.contasReceber,
    lines.adiantamentos,
    lines.impostosCompensar,
    lines.estoques,
    lines.despesasAntecipadas,
    lines.outrasContasReceber
  );

  lines.variacaoPassivo = addSeries(
    lines.fornecedores,
    lines.obrigacoesTrabalhistas,
    lines.obrigacoesTributarias,
    lines.outrasObrigacoes,
    lines.parcelamentos
  );

  lines.resultadoOperacional = addSeries(
    lines.lucroAjustado,
    lines.variacaoAtivo,
    lines.variacaoPassivo
  );

  lines.resultadoInvestimento = addSeries(
    lines.recebimentosVendasAtivo,
    lines.comprasImobilizado,
    lines.aquisicoesInvestimentos,
    lines.baixaAtivoImobilizado
  );

  lines.resultadoFinanceiro = addSeries(
    lines.integralizacaoAumentoCapitalSocial,
    lines.pagamentoLucrosDividendos,
    lines.variacaoEmprestimosFinanciamentos,
    lines.dividendosProvisionadosPagar,
    lines.variacaoEmprestimosPessoasLigadas
  );

  const disponibilidadeMappings = mappingsByLine.get("disponibilidadesBase") ?? [];
  const saldoFinalDisponivel = buildEndingBalanceSeries(currentPatrimonialLeaves, disponibilidadeMappings);
  const previousDecemberDisponivel = leafMovements(input.previousYearPatrimonialMovements)
    .filter((movement) =>
      disponibilidadeMappings.some((mapping) =>
        matchesCode(movement.code, mapping.account_code_snapshot, mapping.include_children)
      )
    )
    .reduce((total, movement) => total + (movement.values[11] ?? 0), 0);

  lines.saldoFinalDisponivel = saldoFinalDisponivel;
  lines.saldoInicialDisponivel = buildStartingBalanceSeries(
    saldoFinalDisponivel,
    previousDecemberDisponivel
  );

  lines.resultadoGeracaoCaixa = addSeries(
    lines.resultadoOperacional,
    lines.resultadoInvestimento,
    lines.resultadoFinanceiro
  );

  const activeMonthIndex =
    typeof input.activeMonthIndex === "number" && input.activeMonthIndex >= 0
      ? Math.min(input.activeMonthIndex, 11)
      : findLastActiveMonth(lines);

  const rows = DFC_LINE_CONFIG.map((config) => {
    const monthly = lines[config.key];
    const accumulated = totalSeries(monthly);
    return {
      key: config.key,
      label: config.label,
      section: config.section,
      kind: config.kind,
      level: config.level,
      monthly,
      accumulated,
      percent: null,
    };
  });

  const cards = [
    { label: "Resultado Contabil", value: lines.resultadoLiquidoExercicio[activeMonthIndex] ?? 0 },
    { label: "Resultado Operacional", value: lines.resultadoOperacional[activeMonthIndex] ?? 0 },
    { label: "Resultado de Investimento", value: lines.resultadoInvestimento[activeMonthIndex] ?? 0 },
    { label: "Resultado Financeiro", value: lines.resultadoFinanceiro[activeMonthIndex] ?? 0 },
    { label: "Resultado Geracao de Caixa", value: lines.resultadoGeracaoCaixa[activeMonthIndex] ?? 0 },
    { label: "Saldo Final Disponivel", value: lines.saldoFinalDisponivel[activeMonthIndex] ?? 0 },
  ];

  const closedRows = [
    { label: "Resultado Contabil", value: lines.resultadoLiquidoExercicio[activeMonthIndex] ?? 0 },
    { label: "Lucro Ajustado", value: lines.lucroAjustado[activeMonthIndex] ?? 0 },
    { label: "Resultado Operacional", value: lines.resultadoOperacional[activeMonthIndex] ?? 0 },
    { label: "Resultado de Investimento", value: lines.resultadoInvestimento[activeMonthIndex] ?? 0 },
    { label: "Resultado Financeiro", value: lines.resultadoFinanceiro[activeMonthIndex] ?? 0 },
    { label: "Saldo Inicial Disponivel", value: lines.saldoInicialDisponivel[activeMonthIndex] ?? 0 },
    { label: "Saldo Final Disponivel", value: lines.saldoFinalDisponivel[activeMonthIndex] ?? 0 },
    { label: "Resultado Geracao de Caixa", value: lines.resultadoGeracaoCaixa[activeMonthIndex] ?? 0 },
  ];

  return {
    year: input.year,
    monthLabels: MONTH_LABELS,
    activeMonthIndex,
    status: previousPatrimonialMissing ? "partial" : "ready",
    warnings,
    lines,
    rows,
    closedRows,
    cards,
  };
}

export function emptyDfcStatement(year: number, status: "ready" | "partial" = "ready"): DfcStatementResult {
  const lines = Object.fromEntries(
    DFC_LINE_CONFIG.map((config) => [config.key, createZeroSeries()])
  ) as Record<DfcLineKey, number[]>;

  return {
    year,
    monthLabels: MONTH_LABELS,
    activeMonthIndex: 0,
    status,
    warnings: status === "partial" ? ["Base patrimonial anterior indisponivel."] : [],
    lines,
    rows: DFC_LINE_CONFIG.map((config) => ({
      key: config.key,
      label: config.label,
      section: config.section,
      kind: config.kind,
      level: config.level,
      monthly: createZeroSeries(),
      accumulated: 0,
      percent: null,
    })),
    closedRows: [
      { label: "Resultado Contabil", value: 0 },
      { label: "Lucro Ajustado", value: 0 },
      { label: "Resultado Operacional", value: 0 },
      { label: "Resultado de Investimento", value: 0 },
      { label: "Resultado Financeiro", value: 0 },
      { label: "Saldo Inicial Disponivel", value: 0 },
      { label: "Saldo Final Disponivel", value: 0 },
      { label: "Resultado Geracao de Caixa", value: 0 },
    ],
    cards: [
      { label: "Resultado Contabil", value: 0 },
      { label: "Resultado Operacional", value: 0 },
      { label: "Resultado de Investimento", value: 0 },
      { label: "Resultado Financeiro", value: 0 },
      { label: "Resultado Geracao de Caixa", value: 0 },
      { label: "Saldo Final Disponivel", value: 0 },
    ],
  };
}
