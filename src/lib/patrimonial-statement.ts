export type PatrimonialCategoryKey =
  | "disponivel"
  | "clientes"
  | "adiantamentos"
  | "estoques"
  | "tributos_a_compensar_cp"
  | "outras_contas_a_receber"
  | "despesas_antecipadas"
  | "contas_a_receber_lp"
  | "processos_judiciais"
  | "partes_relacionadas_a_receber"
  | "outras_contas_a_receber_lp"
  | "tributos_a_recuperar_lp"
  | "investimentos"
  | "imobilizado"
  | "intangivel"
  | "fornecedores"
  | "emprestimos_financiamentos_cp"
  | "obrigacoes_trabalhistas"
  | "obrigacoes_tributarias"
  | "contas_a_pagar_cp"
  | "parcelamentos_cp"
  | "processos_a_pagar_cp"
  | "emprestimos_financiamentos_lp"
  | "conta_corrente_dos_socios"
  | "emprestimos_partes_relacionadas"
  | "parcelamentos_lp"
  | "processos_a_pagar_lp"
  | "impostos_diferidos"
  | "outras_contas_a_pagar_lp"
  | "receita_exercicio_futuro_lp"
  | "provisao_contingencias"
  | "capital_social"
  | "reserva_capital"
  | "reserva_lucros"
  | "resultado_exercicio"
  | "distribuicao_lucros";

export type PatrimonialSectionKey =
  | "ativo_circulante"
  | "ativo_nao_circulante"
  | "passivo_circulante"
  | "passivo_nao_circulante"
  | "patrimonio_liquido";

export interface PatrimonialMovementLike {
  code: string;
  reduced_code?: string | null;
  name: string;
  level: number;
  values: number[];
  type: "dre" | "patrimonial";
  category?: string | null;
}

export interface PatrimonialChartAccountLike {
  code: string;
  reduced_code?: string | null;
  name: string;
  report_category?: string | null;
  report_type?: string | null;
  level?: number | null;
}

export interface PatrimonialMappingLike {
  account_code: string;
  category: string;
  client_id?: string | null;
}

export interface PatrimonialSummaryRow {
  key: string;
  label: string;
  level: number;
  accent: "cyan" | "white" | "muted";
  monthly: number[];
  accumulated: number;
  percent: number | null;
}

export interface PatrimonialStatementResult {
  year: number;
  monthLabels: string[];
  activeMonthIndex: number;
  categorySeries: Record<PatrimonialCategoryKey, number[]>;
  sectionSeries: Record<PatrimonialSectionKey, number[]>;
  totals: {
    ativoCirculante: number[];
    ativoNaoCirculante: number[];
    passivoCirculante: number[];
    passivoNaoCirculante: number[];
    patrimonioLiquido: number[];
    totalAtivo: number[];
    totalPassivo: number[];
  };
  rows: PatrimonialSummaryRow[];
  closedRows: Array<{ label: string; value: number }>;
  graphCards: Array<{
    label: string;
    value: number;
    stroke: string;
    fill: string;
    series: number[];
  }>;
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

const CATEGORY_KEYS: PatrimonialCategoryKey[] = [
  "disponivel",
  "clientes",
  "adiantamentos",
  "estoques",
  "tributos_a_compensar_cp",
  "outras_contas_a_receber",
  "despesas_antecipadas",
  "contas_a_receber_lp",
  "processos_judiciais",
  "partes_relacionadas_a_receber",
  "outras_contas_a_receber_lp",
  "tributos_a_recuperar_lp",
  "investimentos",
  "imobilizado",
  "intangivel",
  "fornecedores",
  "emprestimos_financiamentos_cp",
  "obrigacoes_trabalhistas",
  "obrigacoes_tributarias",
  "contas_a_pagar_cp",
  "parcelamentos_cp",
  "processos_a_pagar_cp",
  "emprestimos_financiamentos_lp",
  "conta_corrente_dos_socios",
  "emprestimos_partes_relacionadas",
  "parcelamentos_lp",
  "processos_a_pagar_lp",
  "impostos_diferidos",
  "outras_contas_a_pagar_lp",
  "receita_exercicio_futuro_lp",
  "provisao_contingencias",
  "capital_social",
  "reserva_capital",
  "reserva_lucros",
  "resultado_exercicio",
  "distribuicao_lucros",
];

const SECTION_KEYS: PatrimonialSectionKey[] = [
  "ativo_circulante",
  "ativo_nao_circulante",
  "passivo_circulante",
  "passivo_nao_circulante",
  "patrimonio_liquido",
];

const CATEGORY_TO_SECTION: Record<PatrimonialCategoryKey, PatrimonialSectionKey> = {
  disponivel: "ativo_circulante",
  clientes: "ativo_circulante",
  adiantamentos: "ativo_circulante",
  estoques: "ativo_circulante",
  tributos_a_compensar_cp: "ativo_circulante",
  outras_contas_a_receber: "ativo_circulante",
  despesas_antecipadas: "ativo_circulante",
  contas_a_receber_lp: "ativo_nao_circulante",
  processos_judiciais: "ativo_nao_circulante",
  partes_relacionadas_a_receber: "ativo_nao_circulante",
  outras_contas_a_receber_lp: "ativo_nao_circulante",
  tributos_a_recuperar_lp: "ativo_nao_circulante",
  investimentos: "ativo_nao_circulante",
  imobilizado: "ativo_nao_circulante",
  intangivel: "ativo_nao_circulante",
  fornecedores: "passivo_circulante",
  emprestimos_financiamentos_cp: "passivo_circulante",
  obrigacoes_trabalhistas: "passivo_circulante",
  obrigacoes_tributarias: "passivo_circulante",
  contas_a_pagar_cp: "passivo_circulante",
  parcelamentos_cp: "passivo_circulante",
  processos_a_pagar_cp: "passivo_circulante",
  emprestimos_financiamentos_lp: "passivo_nao_circulante",
  conta_corrente_dos_socios: "passivo_nao_circulante",
  emprestimos_partes_relacionadas: "passivo_nao_circulante",
  parcelamentos_lp: "passivo_nao_circulante",
  processos_a_pagar_lp: "passivo_nao_circulante",
  impostos_diferidos: "passivo_nao_circulante",
  outras_contas_a_pagar_lp: "passivo_nao_circulante",
  receita_exercicio_futuro_lp: "passivo_nao_circulante",
  provisao_contingencias: "passivo_nao_circulante",
  capital_social: "patrimonio_liquido",
  reserva_capital: "patrimonio_liquido",
  reserva_lucros: "patrimonio_liquido",
  resultado_exercicio: "patrimonio_liquido",
  distribuicao_lucros: "patrimonio_liquido",
};

const ROW_CONFIG = [
  { key: "ativo_circulante", label: "Ativo Circulante", level: 0, accent: "cyan" },
  { key: "disponivel", label: "Disponivel", level: 1, accent: "muted" },
  { key: "clientes", label: "Clientes", level: 1, accent: "muted" },
  { key: "adiantamentos", label: "Adiantamentos", level: 1, accent: "muted" },
  { key: "estoques", label: "Estoques", level: 1, accent: "muted" },
  { key: "tributos_a_compensar_cp", label: "Tributos A Compensar CP", level: 1, accent: "muted" },
  { key: "outras_contas_a_receber", label: "Outras Contas A Receber", level: 1, accent: "muted" },
  { key: "despesas_antecipadas", label: "Despesas Antecipadas", level: 1, accent: "muted" },
  { key: "ativo_nao_circulante", label: "Ativo Nao Circulante", level: 0, accent: "cyan" },
  { key: "contas_a_receber_lp", label: "Contas A Receber LP", level: 1, accent: "muted" },
  { key: "processos_judiciais", label: "Processos Judiciais", level: 1, accent: "muted" },
  { key: "partes_relacionadas_a_receber", label: "Partes Relacionadas A Receber", level: 1, accent: "muted" },
  { key: "outras_contas_a_receber_lp", label: "Outras Contas A Receber LP", level: 1, accent: "muted" },
  { key: "tributos_a_recuperar_lp", label: "Tributos A Recuperar LP", level: 1, accent: "muted" },
  { key: "investimentos", label: "Investimentos", level: 1, accent: "muted" },
  { key: "imobilizado", label: "Imobilizado", level: 1, accent: "muted" },
  { key: "intangivel", label: "Intangivel", level: 1, accent: "muted" },
  { key: "total_ativo", label: "Total do Ativo", level: 0, accent: "cyan" },
  { key: "passivo_circulante", label: "Passivo Circulante", level: 0, accent: "cyan" },
  { key: "fornecedores", label: "Fornecedores", level: 1, accent: "muted" },
  { key: "emprestimos_financiamentos_cp", label: "Emprestimos E Financiamentos CP", level: 1, accent: "muted" },
  { key: "obrigacoes_trabalhistas", label: "Obrigacoes Trabalhistas", level: 1, accent: "muted" },
  { key: "obrigacoes_tributarias", label: "Obrigacoes Tributarias", level: 1, accent: "muted" },
  { key: "contas_a_pagar_cp", label: "Contas A Pagar Cp", level: 1, accent: "muted" },
  { key: "parcelamentos_cp", label: "Parcelamentos Cp", level: 1, accent: "muted" },
  { key: "processos_a_pagar_cp", label: "Processos A Pagar Cp", level: 1, accent: "muted" },
  { key: "passivo_nao_circulante", label: "Passivo Nao Circulante", level: 0, accent: "cyan" },
  { key: "emprestimos_financiamentos_lp", label: "Emprestimos E Financiamentos Lp", level: 1, accent: "muted" },
  { key: "conta_corrente_dos_socios", label: "Conta Corrente Dos Socios", level: 1, accent: "muted" },
  { key: "emprestimos_partes_relacionadas", label: "Emprestimos Partes Relacionadas", level: 1, accent: "muted" },
  { key: "parcelamentos_lp", label: "Parcelamentos Lp", level: 1, accent: "muted" },
  { key: "processos_a_pagar_lp", label: "Processos A Pagar Lp", level: 1, accent: "muted" },
  { key: "impostos_diferidos", label: "Impostos Diferidos", level: 1, accent: "muted" },
  { key: "outras_contas_a_pagar_lp", label: "Outras Contas A Pagar Lp", level: 1, accent: "muted" },
  { key: "receita_exercicio_futuro_lp", label: "Receita De Exercicio Futuro Lp", level: 1, accent: "muted" },
  { key: "provisao_contingencias", label: "Provisao Para Contingencias", level: 1, accent: "muted" },
  { key: "patrimonio_liquido", label: "Patrimonio Liquido", level: 0, accent: "cyan" },
  { key: "capital_social", label: "Capital Social", level: 1, accent: "muted" },
  { key: "reserva_capital", label: "Reserva De Capital", level: 1, accent: "muted" },
  { key: "reserva_lucros", label: "Reserva De Lucros", level: 1, accent: "muted" },
  { key: "resultado_exercicio", label: "Resultado Do Exercicio", level: 1, accent: "muted" },
  { key: "distribuicao_lucros", label: "Distribuicao De Lucros", level: 1, accent: "muted" },
  { key: "total_passivo", label: "Total do Passivo", level: 0, accent: "cyan" },
] as const;

const PREFIX_TO_CATEGORY: Array<[string, PatrimonialCategoryKey]> = [
  ["01.1.01.01", "disponivel"],
  ["01.1.01.02", "disponivel"],
  ["01.1.01", "disponivel"],
  ["01.1.02", "clientes"],
  ["01.1.03", "adiantamentos"],
  ["01.1.04", "estoques"],
  ["01.1.05", "tributos_a_compensar_cp"],
  ["01.1.06", "outras_contas_a_receber"],
  ["01.1.07", "despesas_antecipadas"],
  ["01.2.01", "contas_a_receber_lp"],
  ["01.2.02", "processos_judiciais"],
  ["01.2.03", "partes_relacionadas_a_receber"],
  ["01.2.04", "outras_contas_a_receber_lp"],
  ["01.2.05", "tributos_a_recuperar_lp"],
  ["01.2.06", "investimentos"],
  ["01.2.07", "imobilizado"],
  ["01.2.08", "intangivel"],
  ["02.1.01", "fornecedores"],
  ["02.1.02", "emprestimos_financiamentos_cp"],
  ["02.1.03", "obrigacoes_trabalhistas"],
  ["02.1.04", "obrigacoes_tributarias"],
  ["02.1.05", "contas_a_pagar_cp"],
  ["02.1.06", "parcelamentos_cp"],
  ["02.1.07", "processos_a_pagar_cp"],
  ["02.2.01", "emprestimos_financiamentos_lp"],
  ["02.2.02", "conta_corrente_dos_socios"],
  ["02.2.03", "emprestimos_partes_relacionadas"],
  ["02.2.04", "parcelamentos_lp"],
  ["02.2.05", "processos_a_pagar_lp"],
  ["02.2.06", "impostos_diferidos"],
  ["02.2.07", "outras_contas_a_pagar_lp"],
  ["02.2.08", "receita_exercicio_futuro_lp"],
  ["02.2.09", "provisao_contingencias"],
  ["02.3.01", "receita_exercicio_futuro_lp"],
  ["02.3.02", "provisao_contingencias"],
  ["02.4.01", "capital_social"],
  ["02.4.02", "reserva_capital"],
  ["02.4.03", "reserva_lucros"],
  ["02.4.04", "resultado_exercicio"],
  ["02.4.05", "distribuicao_lucros"],
];

const CATEGORY_ALIASES: Record<string, PatrimonialCategoryKey> = {
  disponivel: "disponivel",
  caixa: "disponivel",
  bancos: "disponivel",
  clientes: "clientes",
  adiantamentos: "adiantamentos",
  estoques: "estoques",
  "tributos a compensar cp": "tributos_a_compensar_cp",
  "outras contas a receber": "outras_contas_a_receber",
  "despesas antecipadas": "despesas_antecipadas",
  "contas a receber lp": "contas_a_receber_lp",
  "processos judiciais": "processos_judiciais",
  "partes relacionadas a receber": "partes_relacionadas_a_receber",
  "outras contas a receber lp": "outras_contas_a_receber_lp",
  "tributos a recuperar lp": "tributos_a_recuperar_lp",
  investimentos: "investimentos",
  imobilizado: "imobilizado",
  intangivel: "intangivel",
  fornecedores: "fornecedores",
  "emprestimos e financiamentos cp": "emprestimos_financiamentos_cp",
  "obrigacoes trabalhistas": "obrigacoes_trabalhistas",
  "obrigacoes tributarias": "obrigacoes_tributarias",
  "contas a pagar cp": "contas_a_pagar_cp",
  "parcelamentos cp": "parcelamentos_cp",
  "processos a pagar cp": "processos_a_pagar_cp",
  "emprestimos e financiamentos lp": "emprestimos_financiamentos_lp",
  "conta corrente dos socios": "conta_corrente_dos_socios",
  "emprestimos partes relacionadas": "emprestimos_partes_relacionadas",
  "parcelamentos lp": "parcelamentos_lp",
  "processos a pagar lp": "processos_a_pagar_lp",
  "impostos diferidos": "impostos_diferidos",
  "outras contas a pagar lp": "outras_contas_a_pagar_lp",
  "receita de exercicio futuro lp": "receita_exercicio_futuro_lp",
  "provisao para contingencias": "provisao_contingencias",
  "capital social": "capital_social",
  "reserva de capital": "reserva_capital",
  "reserva de lucros": "reserva_lucros",
  "resultado do exercicio": "resultado_exercicio",
  "distribuicao de lucros": "distribuicao_lucros",
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createZeroSeries(fill = 0): number[] {
  return Array.from({ length: 12 }, () => fill);
}

function createSeriesRecord<T extends string>(keys: readonly T[]): Record<T, number[]> {
  return keys.reduce((acc, key) => {
    acc[key] = createZeroSeries();
    return acc;
  }, {} as Record<T, number[]>);
}

function seriesTotal(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function buildLookup<T extends { code: string }>(items: T[]): Map<string, T> {
  const lookup = new Map<string, T>();
  for (const item of items) {
    lookup.set(item.code, item);
  }
  return lookup;
}

function hasChildren(code: string, allCodes: string[]): boolean {
  const normalized = code.trim();
  return allCodes.some(
    (other) =>
      other !== normalized &&
      (other.startsWith(`${normalized}.`) ||
        other.startsWith(`${normalized}-`) ||
        other.startsWith(`${normalized}/`))
  );
}

function normalizeCategory(category: string | null | undefined): PatrimonialCategoryKey | null {
  if (!category) return null;
  const normalized = normalizeText(category);
  return CATEGORY_ALIASES[normalized] ?? null;
}

function inferCategory(code: string, name: string): PatrimonialCategoryKey | null {
  const normalizedCode = normalizeText(code);
  const normalizedName = normalizeText(name);
  const text = `${normalizedCode} ${normalizedName}`;

  for (const [prefix, category] of PREFIX_TO_CATEGORY) {
    if (normalizedCode.startsWith(prefix)) {
      return category;
    }
  }

  const keywordRules: Array<[RegExp, PatrimonialCategoryKey]> = [
    [/disponiv|caixa|banco/i, "disponivel"],
    [/cliente/i, "clientes"],
    [/adiant/i, "adiantamentos"],
    [/estoque/i, "estoques"],
    [/tribut.*compens/i, "tributos_a_compensar_cp"],
    [/outras? contas? a receber/i, "outras_contas_a_receber"],
    [/despesa.*antecip/i, "despesas_antecipadas"],
    [/receber.*lp/i, "contas_a_receber_lp"],
    [/processos? judic/i, "processos_judiciais"],
    [/partes? relacionadas?.*receber/i, "partes_relacionadas_a_receber"],
    [/tribut.*recuper/i, "tributos_a_recuperar_lp"],
    [/invest/i, "investimentos"],
    [/imobil/i, "imobilizado"],
    [/intang/i, "intangivel"],
    [/fornecedor/i, "fornecedores"],
    [/emprestimos?.*cp/i, "emprestimos_financiamentos_cp"],
    [/obrigac.*trabalh/i, "obrigacoes_trabalhistas"],
    [/obrigac.*tribut/i, "obrigacoes_tributarias"],
    [/contas? a pagar cp/i, "contas_a_pagar_cp"],
    [/parcelam.*cp/i, "parcelamentos_cp"],
    [/pagar cp/i, "processos_a_pagar_cp"],
    [/emprestimos?.*lp/i, "emprestimos_financiamentos_lp"],
    [/conta corrente dos socios/i, "conta_corrente_dos_socios"],
    [/partes? relacionadas?.*emprest/i, "emprestimos_partes_relacionadas"],
    [/parcelam.*lp/i, "parcelamentos_lp"],
    [/pagar lp/i, "processos_a_pagar_lp"],
    [/impostos? difer/i, "impostos_diferidos"],
    [/outras? contas? a pagar lp/i, "outras_contas_a_pagar_lp"],
    [/receita.*exercicio.*futuro/i, "receita_exercicio_futuro_lp"],
    [/provisao.*conting/i, "provisao_contingencias"],
    [/capital social/i, "capital_social"],
    [/reserva de capital/i, "reserva_capital"],
    [/reserva de lucros/i, "reserva_lucros"],
    [/resultado do exercicio/i, "resultado_exercicio"],
    [/distribuicao de lucros/i, "distribuicao_lucros"],
  ];

  for (const [pattern, category] of keywordRules) {
    if (pattern.test(text)) return category;
  }

  return null;
}

export function resolvePatrimonialCategory(input: {
  movement: PatrimonialMovementLike;
  chartAccount?: PatrimonialChartAccountLike | null;
  mapping?: PatrimonialMappingLike | null;
}): PatrimonialCategoryKey | null {
  const mapped = normalizeCategory(input.mapping?.category);
  if (mapped) return mapped;

  const movementCategory = normalizeCategory(input.movement.category);
  if (movementCategory) return movementCategory;

  const reportCategory = normalizeCategory(input.chartAccount?.report_category);
  if (reportCategory) return reportCategory;

  return inferCategory(
    input.movement.code,
    input.chartAccount?.name ?? input.movement.name
  );
}

export function buildPatrimonialStatement(input: {
  year: number;
  movements: PatrimonialMovementLike[];
  chartAccounts: PatrimonialChartAccountLike[];
  mappings: PatrimonialMappingLike[];
  activeMonthIndex?: number;
}): PatrimonialStatementResult {
  const monthLabels = MONTH_LABELS.slice();
  const allCodes = input.movements.map((movement) => movement.code);
  const chartByCode = buildLookup(input.chartAccounts);
  const mappingByCode = new Map<string, PatrimonialMappingLike>();

  for (const mapping of input.mappings) {
    mappingByCode.set(mapping.account_code, mapping);
  }

  const leafMovements = input.movements.filter(
    (movement) => !hasChildren(movement.code, allCodes)
  );

  const categorySeries = createSeriesRecord(CATEGORY_KEYS);

  for (const movement of leafMovements) {
    const chartAccount = chartByCode.get(movement.code) ?? null;
    const mapping = mappingByCode.get(movement.code) ?? null;
    const category = resolvePatrimonialCategory({ movement, chartAccount, mapping });

    if (!category) continue;

    for (let index = 0; index < 12; index += 1) {
      categorySeries[category][index] += movement.values[index] ?? 0;
    }
  }

  const sectionSeries = createSeriesRecord(SECTION_KEYS);
  for (const [category, values] of Object.entries(categorySeries) as Array<
    [PatrimonialCategoryKey, number[]]
  >) {
    const section = CATEGORY_TO_SECTION[category];
    for (let index = 0; index < 12; index += 1) {
      sectionSeries[section][index] += values[index] ?? 0;
    }
  }

  const totals = {
    ativoCirculante: sectionSeries.ativo_circulante,
    ativoNaoCirculante: sectionSeries.ativo_nao_circulante,
    passivoCirculante: sectionSeries.passivo_circulante,
    passivoNaoCirculante: sectionSeries.passivo_nao_circulante,
    patrimonioLiquido: sectionSeries.patrimonio_liquido,
    totalAtivo: sectionSeries.ativo_circulante.map(
      (value, index) => value + sectionSeries.ativo_nao_circulante[index]
    ),
    totalPassivo: sectionSeries.passivo_circulante.map(
      (value, index) =>
        value + sectionSeries.passivo_nao_circulante[index] + sectionSeries.patrimonio_liquido[index]
    ),
  };

  const activeMonthIndex =
    typeof input.activeMonthIndex === "number" && input.activeMonthIndex >= 0
      ? Math.min(input.activeMonthIndex, 11)
      : findLastActiveMonth(totals);

  const rows = ROW_CONFIG.map((config) => {
    const monthly = resolveRowMonthly(config.key, categorySeries, sectionSeries, totals);
    const accumulated = seriesTotal(monthly);
    const percent = resolveRowPercent(
      config.key,
      monthly[activeMonthIndex] ?? 0,
      totals,
      activeMonthIndex
    );

    return {
      key: config.key,
      label: config.label,
      level: config.level,
      accent: config.accent,
      monthly,
      accumulated,
      percent,
    };
  });

  const closedRows = [
    {
      label: "Total do Ativo",
      value: totals.totalAtivo[activeMonthIndex] ?? 0,
    },
    {
      label: "Patrimonio Liquido",
      value: totals.patrimonioLiquido[activeMonthIndex] ?? 0,
    },
    {
      label: "Total do Passivo",
      value: totals.totalPassivo[activeMonthIndex] ?? 0,
    },
  ];

  const graphCards = [
    {
      label: "Ativo Circulante",
      value: totals.ativoCirculante[activeMonthIndex] ?? 0,
      stroke: "#1fc8ff",
      fill: "rgba(31,200,255,0.16)",
      series: totals.ativoCirculante,
    },
    {
      label: "Ativo Nao Circulante",
      value: totals.ativoNaoCirculante[activeMonthIndex] ?? 0,
      stroke: "#2f76ff",
      fill: "rgba(47,118,255,0.16)",
      series: totals.ativoNaoCirculante,
    },
    {
      label: "Total do Ativo",
      value: totals.totalAtivo[activeMonthIndex] ?? 0,
      stroke: "#22d3ee",
      fill: "rgba(34,211,238,0.15)",
      series: totals.totalAtivo,
    },
    {
      label: "Passivo Circulante",
      value: totals.passivoCirculante[activeMonthIndex] ?? 0,
      stroke: "#ff2d6f",
      fill: "rgba(255,45,111,0.16)",
      series: totals.passivoCirculante,
    },
    {
      label: "Passivo Nao Circulante",
      value: totals.passivoNaoCirculante[activeMonthIndex] ?? 0,
      stroke: "#f59e0b",
      fill: "rgba(245,158,11,0.16)",
      series: totals.passivoNaoCirculante,
    },
    {
      label: "Patrimonio Liquido",
      value: totals.patrimonioLiquido[activeMonthIndex] ?? 0,
      stroke: "#10b981",
      fill: "rgba(16,185,129,0.16)",
      series: totals.patrimonioLiquido,
    },
  ];

  return {
    year: input.year,
    monthLabels,
    activeMonthIndex,
    categorySeries,
    sectionSeries,
    totals,
    rows,
    closedRows,
    graphCards,
  };
}

function resolveRowMonthly(
  key: string,
  categorySeries: Record<PatrimonialCategoryKey, number[]>,
  sectionSeries: Record<PatrimonialSectionKey, number[]>,
  totals: PatrimonialStatementResult["totals"]
): number[] {
  if (key in sectionSeries) {
    return sectionSeries[key as PatrimonialSectionKey];
  }

  if (key in categorySeries) {
    return categorySeries[key as PatrimonialCategoryKey];
  }

  switch (key) {
    case "total_ativo":
      return totals.totalAtivo;
    case "total_passivo":
      return totals.totalPassivo;
    default:
      return createZeroSeries();
  }
}

function resolveRowPercent(
  key: string,
  activeMonthValue: number,
  totals: PatrimonialStatementResult["totals"],
  activeMonthIndex: number
): number | null {
  if (["total_ativo", "total_passivo"].includes(key)) {
    return 100;
  }

  if (
    [
      "ativo_circulante",
      "ativo_nao_circulante",
      "passivo_circulante",
      "passivo_nao_circulante",
      "patrimonio_liquido",
    ].includes(key)
  ) {
    const base =
      key === "ativo_circulante" || key === "ativo_nao_circulante"
        ? totals.totalAtivo[activeMonthIndex] ?? 0
        : totals.totalPassivo[activeMonthIndex] ?? 0;

    return base === 0 ? 0 : (Math.abs(activeMonthValue) / Math.abs(base)) * 100;
  }

  return null;
}

function findLastActiveMonth(totals: PatrimonialStatementResult["totals"]): number {
  for (let index = 11; index >= 0; index -= 1) {
    const hasValue = Object.values(totals).some((series) => Math.abs(series[index] ?? 0) > 0);
    if (hasValue) return index;
  }
  return 0;
}

export function emptyPatrimonialStatement(year: number): PatrimonialStatementResult {
  const zero = createZeroSeries();
  return {
    year,
    monthLabels: MONTH_LABELS,
    activeMonthIndex: 0,
    categorySeries: createSeriesRecord(CATEGORY_KEYS),
    sectionSeries: createSeriesRecord(SECTION_KEYS),
    totals: {
      ativoCirculante: zero,
      ativoNaoCirculante: zero,
      passivoCirculante: zero,
      passivoNaoCirculante: zero,
      patrimonioLiquido: zero,
      totalAtivo: zero,
      totalPassivo: zero,
    },
    rows: ROW_CONFIG.map((config) => ({
      key: config.key,
      label: config.label,
      level: config.level,
      accent: config.accent,
      monthly: createZeroSeries(),
      accumulated: 0,
      percent: config.key === "total_ativo" || config.key === "total_passivo" ? 100 : null,
    })),
    closedRows: [
      { label: "Total do Ativo", value: 0 },
      { label: "Patrimonio Liquido", value: 0 },
      { label: "Total do Passivo", value: 0 },
    ],
    graphCards: [
      { label: "Ativo Circulante", value: 0, stroke: "#1fc8ff", fill: "rgba(31,200,255,0.16)", series: zero },
      { label: "Ativo Nao Circulante", value: 0, stroke: "#2f76ff", fill: "rgba(47,118,255,0.16)", series: zero },
      { label: "Total do Ativo", value: 0, stroke: "#22d3ee", fill: "rgba(34,211,238,0.15)", series: zero },
      { label: "Passivo Circulante", value: 0, stroke: "#ff2d6f", fill: "rgba(255,45,111,0.16)", series: zero },
      { label: "Passivo Nao Circulante", value: 0, stroke: "#f59e0b", fill: "rgba(245,158,11,0.16)", series: zero },
      { label: "Patrimonio Liquido", value: 0, stroke: "#10b981", fill: "rgba(16,185,129,0.16)", series: zero },
    ],
  };
}
