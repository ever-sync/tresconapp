export type DreCategoryKey =
  | "receita_bruta"
  | "deducoes_vendas"
  | "custos_vendas"
  | "custos_servicos"
  | "despesas_administrativas"
  | "despesas_comerciais"
  | "despesas_tributarias"
  | "resultado_participacoes_societarias"
  | "outras_receitas"
  | "receitas_financeiras"
  | "despesas_financeiras"
  | "irpj_csll"
  | "depreciacao_amortizacao";

export type DreLineKey =
  | "receitaBruta"
  | "deducoes"
  | "receitaLiquida"
  | "custosVendas"
  | "custosServicos"
  | "lucroOperacional"
  | "despesasAdministrativas"
  | "despesasComerciais"
  | "despesasTributarias"
  | "resultadoParticipacoesSocietarias"
  | "outrasReceitas"
  | "receitasFinanceiras"
  | "despesasFinanceiras"
  | "lair"
  | "irpjCsll"
  | "lucroLiquido"
  | "depreciacaoAmortizacao"
  | "resultadoFinanceiro"
  | "ebitda";

export interface DreMovementLike {
  code: string;
  reduced_code?: string | null;
  name: string;
  level: number;
  values: number[];
  type: "dre" | "patrimonial";
  category?: string | null;
}

export interface DreChartAccountLike {
  code: string;
  reduced_code?: string | null;
  name: string;
  report_category?: string | null;
  report_type?: string | null;
  level?: number | null;
}

export interface DreMappingLike {
  account_code: string;
  category: string;
  client_id?: string | null;
}

export interface DreSummaryRow {
  key: DreLineKey;
  label: string;
  level: number;
  accent: "cyan" | "pink" | "orange" | "emerald";
  monthly: number[];
  accumulated: number;
  percent: number;
}

export interface DreStatementResult {
  year: number;
  monthLabels: string[];
  activeMonthIndex: number;
  categories: Record<DreCategoryKey, number[]>;
  lines: Record<DreLineKey, number[]>;
  cards: {
    receitaBruta: number;
    custosDespesas: number;
    resultadoLiquido: number;
    irpjCsll: number;
  };
  chart: {
    custoVenda: number;
    impostos: number;
    despesas: number;
    lucro: number;
  };
  rows: DreSummaryRow[];
  summaryRows: Array<{ label: string; percent: number; value: number }>;
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

const DRE_CATEGORY_KEYS: DreCategoryKey[] = [
  "receita_bruta",
  "deducoes_vendas",
  "custos_vendas",
  "custos_servicos",
  "despesas_administrativas",
  "despesas_comerciais",
  "despesas_tributarias",
  "resultado_participacoes_societarias",
  "outras_receitas",
  "receitas_financeiras",
  "despesas_financeiras",
  "irpj_csll",
  "depreciacao_amortizacao",
];

const DRE_LINE_CONFIG: Array<{
  key: DreLineKey;
  label: string;
  level: number;
  accent: "cyan" | "pink" | "orange" | "emerald";
}> = [
  { key: "receitaBruta", label: "Receita Bruta", level: 0, accent: "cyan" },
  { key: "deducoes", label: "Deduções", level: 1, accent: "pink" },
  { key: "receitaLiquida", label: "Receita Líquida", level: 0, accent: "cyan" },
  { key: "custosVendas", label: "Custos das Vendas", level: 1, accent: "pink" },
  { key: "custosServicos", label: "Custos dos Serviços", level: 1, accent: "orange" },
  { key: "lucroOperacional", label: "Lucro Operacional", level: 0, accent: "cyan" },
  {
    key: "despesasAdministrativas",
    label: "Despesas Administrativas",
    level: 1,
    accent: "pink",
  },
  { key: "despesasComerciais", label: "Despesas Comerciais", level: 1, accent: "pink" },
  { key: "despesasTributarias", label: "Despesas Tributárias", level: 1, accent: "pink" },
  {
    key: "resultadoParticipacoesSocietarias",
    label: "Resultado de Participações Societárias",
    level: 1,
    accent: "emerald",
  },
  { key: "outrasReceitas", label: "Outras Receitas", level: 1, accent: "emerald" },
  { key: "receitasFinanceiras", label: "Receitas Financeiras", level: 1, accent: "emerald" },
  { key: "despesasFinanceiras", label: "Despesas Financeiras", level: 1, accent: "pink" },
  {
    key: "lair",
    label: "Lucro Antes do IRPJ e CSLL",
    level: 0,
    accent: "cyan",
  },
  { key: "irpjCsll", label: "IRPJ e CSLL", level: 1, accent: "pink" },
  { key: "lucroLiquido", label: "Lucro/Prejuízo Líquido", level: 0, accent: "cyan" },
  {
    key: "depreciacaoAmortizacao",
    label: "Depreciação e Amortização",
    level: 1,
    accent: "orange",
  },
  { key: "resultadoFinanceiro", label: "Resultado Financeiro", level: 1, accent: "emerald" },
  { key: "ebitda", label: "Resultado EBITDA", level: 0, accent: "cyan" },
];

const DRE_CLOSED_ROWS = [
  "Receita Bruta",
  "Receita Líquida",
  "Lucro Operacional",
  "Lucro Antes do IRPJ e CSLL",
  "Lucro/Prejuízo Líquido",
  "Resultado EBITDA",
];

const CATEGORY_ALIASES: Record<string, DreCategoryKey> = {
  "receita bruta": "receita_bruta",
  "faturamento bruto": "receita_bruta",
  "vendas brutas": "receita_bruta",
  "deducoes de vendas": "deducoes_vendas",
  "deducoes": "deducoes_vendas",
  "devolucoes": "deducoes_vendas",
  "impostos sobre vendas": "deducoes_vendas",
  "custos das vendas": "custos_vendas",
  "custo das vendas": "custos_vendas",
  "custos de vendas": "custos_vendas",
  "custos dos servicos": "custos_servicos",
  "custo dos servicos": "custos_servicos",
  "despesas administrativas": "despesas_administrativas",
  "despesas comerciais": "despesas_comerciais",
  "despesas tributarias": "despesas_tributarias",
  "resultado de participacoes societarias": "resultado_participacoes_societarias",
  "participacoes societarias": "resultado_participacoes_societarias",
  "outras receitas": "outras_receitas",
  "receitas financeiras": "receitas_financeiras",
  "despesas financeiras": "despesas_financeiras",
  "irpj e csll": "irpj_csll",
  "irpj/csll": "irpj_csll",
  "depreciacao e amortizacao": "depreciacao_amortizacao",
  "depreciacao/amortizacao": "depreciacao_amortizacao",
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

function createCategoryBuckets(): Record<DreCategoryKey, number[]> {
  return DRE_CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = createZeroSeries();
    return acc;
  }, {} as Record<DreCategoryKey, number[]>);
}

function negativeSeries(values: number[]): number[] {
  return values.map((value) => -Math.abs(value));
}

function positiveSeries(values: number[]): number[] {
  return values.map((value) => Math.abs(value));
}

function seriesTotal(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function buildCodeLookup<T extends { code: string }>(
  items: T[]
): Map<string, T> {
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

function normalizeCategory(category: string | null | undefined): DreCategoryKey | null {
  if (!category) return null;
  const normalized = normalizeText(category);
  return CATEGORY_ALIASES[normalized] ?? null;
}

function inferCategoryFromText(code: string, name: string): DreCategoryKey | null {
  const text = normalizeText(`${code} ${name}`);

  const keywordMap: Array<[RegExp, DreCategoryKey]> = [
    [/receita bruta|faturamento|venda/i, "receita_bruta"],
    [/deducao|devolucao|imposto.*venda/i, "deducoes_vendas"],
    [/custo.*venda/i, "custos_vendas"],
    [/custo.*servic/i, "custos_servicos"],
    [/despesa.*administr/i, "despesas_administrativas"],
    [/despesa.*comerc/i, "despesas_comerciais"],
    [/despesa.*tribut/i, "despesas_tributarias"],
    [/participac|equivalencia/i, "resultado_participacoes_societarias"],
    [/outras? receitas?/i, "outras_receitas"],
    [/receita.*financeir/i, "receitas_financeiras"],
    [/despesa.*financeir/i, "despesas_financeiras"],
    [/(irpj|csll)/i, "irpj_csll"],
    [/depreciac|amortiz/i, "depreciacao_amortizacao"],
  ];

  for (const [pattern, key] of keywordMap) {
    if (pattern.test(text)) return key;
  }

  return null;
}

export function resolveDreCategory(input: {
  movement: DreMovementLike;
  chartAccount?: DreChartAccountLike | null;
  mapping?: DreMappingLike | null;
}): DreCategoryKey | null {
  const mapped = normalizeCategory(input.mapping?.category);
  if (mapped) return mapped;

  const movementCategory = normalizeCategory(input.movement.category);
  if (movementCategory) return movementCategory;

  const reportCategory = normalizeCategory(input.chartAccount?.report_category);
  if (reportCategory) return reportCategory;

  if (input.movement.type === "dre") {
    return inferCategoryFromText(
      input.movement.code,
      input.chartAccount?.name ?? input.movement.name
    );
  }

  return null;
}

export function convertAccumulatedToMonthly(values: number[]): number[] {
  const normalized = values.slice(0, 12);
  while (normalized.length < 12) {
    normalized.push(0);
  }

  const result = createZeroSeries();
  for (let index = 0; index < 12; index += 1) {
    const current = normalized[index] ?? 0;
    const previous = index === 0 ? 0 : normalized[index - 1] ?? 0;
    result[index] = current - previous;
  }
  return result;
}

export function buildDreStatement(input: {
  year: number;
  movements: DreMovementLike[];
  chartAccounts: DreChartAccountLike[];
  mappings: DreMappingLike[];
  activeMonthIndex?: number;
  treatValuesAsAccumulated?: boolean;
}): DreStatementResult {
  const monthLabels = MONTH_LABELS.slice();
  const allCodes = input.movements.map((movement) => movement.code);
  const chartByCode = buildCodeLookup(input.chartAccounts);
  const mappingByCode = new Map<string, DreMappingLike>();

  for (const mapping of input.mappings) {
    mappingByCode.set(mapping.account_code, mapping);
  }

  const leafMovements = input.movements.filter(
    (movement) => !hasChildren(movement.code, allCodes)
  );

  const categories = createCategoryBuckets();

  for (const movement of leafMovements) {
    const chartAccount = chartByCode.get(movement.code) ?? null;
    const mapping = mappingByCode.get(movement.code) ?? null;
    const category = resolveDreCategory({ movement, chartAccount, mapping });

    if (!category) {
      continue;
    }

    const values = input.treatValuesAsAccumulated
      ? convertAccumulatedToMonthly(movement.values)
      : movement.values;

    for (let index = 0; index < 12; index += 1) {
      categories[category][index] += values[index] ?? 0;
    }
  }

  const receitaBruta = positiveSeries(categories.receita_bruta);
  const deducoes = negativeSeries(categories.deducoes_vendas);
  const receitaLiquida = receitaBruta.map((value, index) => value + deducoes[index]);
  const custosVendas = negativeSeries(categories.custos_vendas);
  const custosServicos = negativeSeries(categories.custos_servicos);
  const lucroOperacional = receitaLiquida.map(
    (value, index) => value + custosVendas[index] + custosServicos[index]
  );
  const despesasAdministrativas = negativeSeries(categories.despesas_administrativas);
  const despesasComerciais = negativeSeries(categories.despesas_comerciais);
  const despesasTributarias = negativeSeries(categories.despesas_tributarias);
  const resultadoParticipacoesSocietarias = positiveSeries(
    categories.resultado_participacoes_societarias
  );
  const outrasReceitas = positiveSeries(categories.outras_receitas);
  const receitasFinanceiras = positiveSeries(categories.receitas_financeiras);
  const despesasFinanceiras = negativeSeries(categories.despesas_financeiras);
  const lair = lucroOperacional.map(
    (value, index) =>
      value +
      despesasAdministrativas[index] +
      despesasComerciais[index] +
      despesasTributarias[index] +
      resultadoParticipacoesSocietarias[index] +
      outrasReceitas[index] +
      receitasFinanceiras[index] +
      despesasFinanceiras[index]
  );
  const irpjCsll = negativeSeries(categories.irpj_csll);
  const lucroLiquido = lair.map((value, index) => value + irpjCsll[index]);
  const depreciacaoAmortizacao = negativeSeries(categories.depreciacao_amortizacao);
  const resultadoFinanceiro = receitasFinanceiras.map(
    (value, index) => value + despesasFinanceiras[index]
  );
  const ebitda = lair.map(
    (value, index) => value + Math.abs(depreciacaoAmortizacao[index]) + resultadoFinanceiro[index]
  );

  const lines: Record<DreLineKey, number[]> = {
    receitaBruta,
    deducoes,
    receitaLiquida,
    custosVendas,
    custosServicos,
    lucroOperacional,
    despesasAdministrativas,
    despesasComerciais,
    despesasTributarias,
    resultadoParticipacoesSocietarias,
    outrasReceitas,
    receitasFinanceiras,
    despesasFinanceiras,
    lair,
    irpjCsll,
    lucroLiquido,
    depreciacaoAmortizacao,
    resultadoFinanceiro,
    ebitda,
  };

  const activeMonthIndex =
    typeof input.activeMonthIndex === "number" && input.activeMonthIndex >= 0
      ? Math.min(input.activeMonthIndex, 11)
      : findLastActiveMonth(lines);

  const cards = {
    receitaBruta: receitaBruta[activeMonthIndex] ?? 0,
    custosDespesas: Math.abs(
      custosVendas[activeMonthIndex] +
        custosServicos[activeMonthIndex] +
        despesasAdministrativas[activeMonthIndex] +
        despesasComerciais[activeMonthIndex] +
        despesasTributarias[activeMonthIndex] +
        despesasFinanceiras[activeMonthIndex]
    ),
    resultadoLiquido: lucroLiquido[activeMonthIndex] ?? 0,
    irpjCsll: Math.abs(irpjCsll[activeMonthIndex] ?? 0),
  };

  const chart = {
    custoVenda: Math.abs(custosVendas[activeMonthIndex] ?? 0),
    impostos: Math.abs((deducoes[activeMonthIndex] ?? 0) + (irpjCsll[activeMonthIndex] ?? 0)),
    despesas: Math.abs(
      (despesasAdministrativas[activeMonthIndex] ?? 0) +
        (despesasComerciais[activeMonthIndex] ?? 0) +
        (despesasTributarias[activeMonthIndex] ?? 0) +
        (despesasFinanceiras[activeMonthIndex] ?? 0)
    ),
    lucro: Math.max(lucroLiquido[activeMonthIndex] ?? 0, 0),
  };

  const rows = DRE_LINE_CONFIG.map((config) => {
    const monthly = lines[config.key];
    const accumulated = seriesTotal(monthly);
    const percent =
      seriesTotal(receitaBruta) === 0 ? 0 : (accumulated / seriesTotal(receitaBruta)) * 100;

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

  const summaryRows = DRE_CLOSED_ROWS.map((label) => {
    const row = rows.find((entry) => entry.label === label);
    const value = row?.monthly[activeMonthIndex] ?? 0;
    const percent =
      cards.receitaBruta === 0 ? 0 : (Math.abs(value) / Math.abs(cards.receitaBruta)) * 100;

    return { label, percent, value };
  });

  return {
    year: input.year,
    monthLabels,
    activeMonthIndex,
    categories,
    lines,
    cards,
    chart,
    rows,
    summaryRows,
  };
}

function findLastActiveMonth(lines: Record<DreLineKey, number[]>): number {
  for (let index = 11; index >= 0; index -= 1) {
    const hasValue = Object.values(lines).some((series) => Math.abs(series[index] ?? 0) > 0);
    if (hasValue) return index;
  }
  return 0;
}

export function emptyDreStatement(year: number): DreStatementResult {
  const emptyLines = DRE_LINE_CONFIG.reduce((acc, config) => {
    acc[config.key] = createZeroSeries();
    return acc;
  }, {} as Record<DreLineKey, number[]>);

  const emptyResult = buildDreStatement({
    year,
    movements: [],
    chartAccounts: [],
    mappings: [],
    activeMonthIndex: 0,
  });

  return {
    ...emptyResult,
    year,
    lines: emptyLines,
    rows: DRE_LINE_CONFIG.map((config) => ({
      key: config.key,
      label: config.label,
      level: config.level,
      accent: config.accent,
      monthly: createZeroSeries(),
      accumulated: 0,
      percent: 0,
    })),
    summaryRows: DRE_CLOSED_ROWS.map((label) => ({
      label,
      percent: 0,
      value: 0,
    })),
  };
}

export { DRE_LINE_CONFIG, MONTH_LABELS };
