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

export interface DfcMonthlyBalanceteLike {
  code: string;
  reduced_code?: string | null;
  name: string;
  saldoAnterior: number;
  debito: number;
  credito: number;
  saldoAtual: number;
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

const RESULTADO_OPERACIONAL_SOURCE_KEYS: DfcLineKey[] = [
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
];

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

function aggregateBalanceteMonth(
  rows: DfcMonthlyBalanceteLike[],
  mappings: DfcMappingLike[],
  selector: (row: DfcMonthlyBalanceteLike) => number
) {
  if (mappings.length === 0 || rows.length === 0) {
    return 0;
  }

  const leaves = leafMovements(
    rows.map((row) => ({
      code: row.code,
      name: row.name,
      values: Array.from({ length: 12 }, () => 0),
    }))
  ).map((row) => row.code);
  const leafSet = new Set(leaves);

  return mappings.reduce((total, mapping) => {
    const exactMatches = rows.filter(
      (row) =>
        row.code === mapping.account_code_snapshot ||
        (!!mapping.reduced_code_snapshot && row.reduced_code === mapping.reduced_code_snapshot)
    );
    const matched =
      exactMatches.length > 0
        ? exactMatches
        : rows.filter(
            (row) =>
              leafSet.has(row.code) &&
              (matchesCode(row.code, mapping.account_code_snapshot, mapping.include_children) ||
                (!!mapping.reduced_code_snapshot &&
                  row.reduced_code === mapping.reduced_code_snapshot))
          );

    const sum = matched.reduce((acc, row) => acc + selector(row), 0);
    return total + sum * mapping.multiplier;
  }, 0);
}

function absIfNegative(value: number) {
  return value < 0 ? Math.abs(value) : value;
}

function negativeIfPositive(value: number) {
  return value > 0 ? -value : value;
}

function absoluteBalance(value: number) {
  return Math.abs(value);
}

function computeMappedBalanceteSeries(
  lineKey: DfcLineKey,
  mappings: DfcMappingLike[],
  monthlyRowsByMonth: Array<DfcMonthlyBalanceteLike[] | undefined>
): number[] | null {
  const hasAnyRows = monthlyRowsByMonth.some((rows) => (rows?.length ?? 0) > 0);
  if (!hasAnyRows || mappings.length === 0) {
    return null;
  }

  const series = createZeroSeries();

  for (let index = 0; index < 12; index += 1) {
    const rows = monthlyRowsByMonth[index] ?? [];

    switch (lineKey) {
      case "contasReceber":
      case "adiantamentos":
      case "impostosCompensar":
      case "estoques":
      case "despesasAntecipadas":
      case "outrasContasReceber":
        series[index] = aggregateBalanceteMonth(
          rows,
          mappings,
          (row) => absoluteBalance(row.saldoAnterior) - absoluteBalance(row.saldoAtual)
        );
        break;
      case "fornecedores":
      case "obrigacoesTrabalhistas":
      case "obrigacoesTributarias":
      case "outrasObrigacoes":
      case "parcelamentos":
      case "variacaoEmprestimosFinanciamentos":
      case "dividendosProvisionadosPagar":
        series[index] = aggregateBalanceteMonth(
          rows,
          mappings,
          (row) => absoluteBalance(row.saldoAtual) - absoluteBalance(row.saldoAnterior)
        );
        break;
      case "variacaoEmprestimosPessoasLigadas": {
        const assetMappings = mappings.filter((mapping) => mapping.source_type === "asset");
        const nonAssetMappings = mappings.filter((mapping) => mapping.source_type !== "asset");
        const assetVariation = aggregateBalanceteMonth(
          rows,
          assetMappings,
          (row) => absoluteBalance(row.saldoAnterior) - absoluteBalance(row.saldoAtual)
        );
        const nonAssetVariation = aggregateBalanceteMonth(
          rows,
          nonAssetMappings,
          (row) => absoluteBalance(row.saldoAtual) - absoluteBalance(row.saldoAnterior)
        );

        series[index] = assetVariation + nonAssetVariation;
        break;
      }
      case "resultadoLiquidoExercicio": {
        const receitaMappings = mappings.filter(
          (mapping) =>
            mapping.account_code_snapshot === "03" || mapping.reduced_code_snapshot === "30000"
        );
        const despesaMappings = mappings.filter(
          (mapping) =>
            mapping.account_code_snapshot === "04" || mapping.reduced_code_snapshot === "40000"
        );
        const receitaFallback =
          receitaMappings.length > 0
            ? receitaMappings
            : mappings.filter(
                (mapping) =>
                  mapping.account_code_snapshot.startsWith("03") ||
                  mapping.reduced_code_snapshot?.startsWith("3")
              );
        const despesaFallback =
          despesaMappings.length > 0
            ? despesaMappings
            : mappings.filter(
                (mapping) =>
                  mapping.account_code_snapshot.startsWith("04") ||
                  mapping.reduced_code_snapshot?.startsWith("4")
              );

        const receitas = aggregateBalanceteMonth(
          rows,
          receitaFallback,
          (row) => absoluteBalance(row.saldoAtual)
        );
        const custosDespesas = aggregateBalanceteMonth(
          rows,
          despesaFallback,
          (row) => absoluteBalance(row.saldoAtual)
        );

        series[index] = receitas - custosDespesas;
        break;
      }
      case "resultadoVendaAtivoImobilizado":
      case "resultadoEquivalenciaPatrimonial":
      case "recebimentosLucrosDividendosSubsidiarias":
      case "recebimentosVendasAtivo":
        series[index] = -aggregateBalanceteMonth(rows, mappings, (row) => row.saldoAtual);
        break;
      case "depreciacaoAmortizacao":
        series[index] = absoluteBalance(aggregateBalanceteMonth(rows, mappings, (row) => row.saldoAtual));
        break;
      case "baixaAtivoImobilizado":
        series[index] = absoluteBalance(aggregateBalanceteMonth(rows, mappings, (row) => row.saldoAtual));
        break;
      case "comprasImobilizado":
      case "aquisicoesInvestimentos":
        series[index] = negativeIfPositive(
          aggregateBalanceteMonth(rows, mappings, (row) => absIfNegative(row.debito))
        );
        break;
      case "integralizacaoAumentoCapitalSocial":
        series[index] = aggregateBalanceteMonth(
          rows,
          mappings,
          (row) => absoluteBalance(row.credito) - absoluteBalance(row.debito)
        );
        break;
      case "pagamentoLucrosDividendos":
        series[index] = negativeIfPositive(
          absoluteBalance(aggregateBalanceteMonth(rows, mappings, (row) => row.saldoAtual))
        );
        break;
      case "disponibilidadesBase":
        series[index] = aggregateBalanceteMonth(rows, mappings, (row) => absoluteBalance(row.saldoAtual));
        break;
      default:
        return null;
    }
  }

  return series;
}

function buildStartingBalanceSeriesFromBalancete(
  monthlyRowsByMonth: Array<DfcMonthlyBalanceteLike[] | undefined>,
  mappings: DfcMappingLike[]
) {
  const series = createZeroSeries();

  for (let index = 0; index < 12; index += 1) {
    const rows = monthlyRowsByMonth[index] ?? [];
    series[index] = aggregateBalanceteMonth(rows, mappings, (row) => absoluteBalance(row.saldoAnterior));
  }

  return series;
}

export function buildDfcStatement(input: {
  year: number;
  dre: DreStatementResult;
  currentPatrimonialMovements: DfcMovementLike[];
  previousYearPatrimonialMovements: DfcMovementLike[];
  dreMovements: DfcMovementLike[];
  mappings: DfcMappingLike[];
  monthlyBalanceteRowsByMonth?: Array<DfcMonthlyBalanceteLike[] | undefined>;
  activeMonthIndex?: number;
}): DfcStatementResult {
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

  const hasMonthlyBalanceteBase =
    input.monthlyBalanceteRowsByMonth?.some((rows) => (rows?.length ?? 0) > 0) ?? false;
  const warnings: string[] = [];
  if (!hasMonthlyBalanceteBase) {
    warnings.push("Nenhum balancete mensal foi importado na aba Lista de balancete. O DFC permanece zerado.");
  }

  for (const config of DFC_LINE_CONFIG) {
    if (!CONFIGURABLE_LINE_KEYS.has(config.key)) {
      continue;
    }

    const mappings = mappingsByLine.get(config.key) ?? [];
    if (mappings.length === 0) {
      continue;
    }

    const mappedFromBalancete =
      input.monthlyBalanceteRowsByMonth
        ? computeMappedBalanceteSeries(config.key, mappings, input.monthlyBalanceteRowsByMonth)
        : null;

    if (mappedFromBalancete) {
      lines[config.key] = mappedFromBalancete;
    }
  }

  lines.lucroAjustado = addSeries(
    lines.resultadoLiquidoExercicio,
    lines.depreciacaoAmortizacao,
    lines.resultadoVendaAtivoImobilizado,
    lines.resultadoEquivalenciaPatrimonial,
    lines.recebimentosLucrosDividendosSubsidiarias
  );

  lines.resultadoOperacional = addSeries(
    ...RESULTADO_OPERACIONAL_SOURCE_KEYS.map((key) => lines[key])
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
  const saldoFinalDisponivelFromBalancete = input.monthlyBalanceteRowsByMonth
    ? computeMappedBalanceteSeries("disponibilidadesBase", disponibilidadeMappings, input.monthlyBalanceteRowsByMonth)
    : null;
  const saldoInicialDisponivelFromBalancete =
    input.monthlyBalanceteRowsByMonth && disponibilidadeMappings.length > 0
      ? buildStartingBalanceSeriesFromBalancete(input.monthlyBalanceteRowsByMonth, disponibilidadeMappings)
      : null;

  if (saldoFinalDisponivelFromBalancete && saldoInicialDisponivelFromBalancete) {
    lines.saldoFinalDisponivel = saldoFinalDisponivelFromBalancete;
    lines.saldoInicialDisponivel = saldoInicialDisponivelFromBalancete;
  }

  lines.resultadoGeracaoCaixa =
    saldoFinalDisponivelFromBalancete && saldoInicialDisponivelFromBalancete
      ? lines.saldoFinalDisponivel.map(
          (value, index) => value - (lines.saldoInicialDisponivel[index] ?? 0)
        )
      : createZeroSeries();

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
    status: hasMonthlyBalanceteBase ? "ready" : "partial",
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
