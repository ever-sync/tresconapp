const DFC_LINE_LABELS = {
  resultadoLiquidoExercicio: "Resultado Liquido do Exercicio",
  depreciacaoAmortizacao: "Depreciacao e Amortizacao",
  resultadoVendaAtivoImobilizado: "Resultado da Venda de Ativo Imobilizado",
  resultadoEquivalenciaPatrimonial: "Resultado da Equivalencia Patrimonial",
  recebimentosLucrosDividendosSubsidiarias: "Recebimentos de Lucros e Dividendos de Subsidiarias",
  contasReceber: "Contas a Receber",
  adiantamentos: "Adiantamentos",
  impostosCompensar: "Impostos a Compensar",
  estoques: "Estoques",
  despesasAntecipadas: "Despesas Antecipadas",
  outrasContasReceber: "Outras Contas a Receber",
  fornecedores: "Fornecedores",
  obrigacoesTrabalhistas: "Obrigacoes Trabalhistas",
  obrigacoesTributarias: "Obrigacoes Tributarias",
  outrasObrigacoes: "Outras Obrigacoes",
  parcelamentos: "Parcelamentos",
  recebimentosVendasAtivo: "Recebimentos por Vendas de Ativo",
  comprasImobilizado: "Compras de Imobilizado",
  aquisicoesInvestimentos: "Aquisicoes em Investimentos",
  baixaAtivoImobilizado: "Baixa de Ativo Imobilizado",
  integralizacaoAumentoCapitalSocial: "Integralizacao ou Aumento de Capital Social",
  pagamentoLucrosDividendos: "Pagamento de Lucros e Dividendos",
  variacaoEmprestimosFinanciamentos: "Variacao em Emprestimos/Financiamentos",
  dividendosProvisionadosPagar: "Dividendos Provisionados a Pagar",
  variacaoEmprestimosPessoasLigadas: "Variacao Emprestimos Pessoas Ligadas PJ/PF",
  disponibilidadesBase: "Disponibilidades Base",
} as const;

const DFC_LEGACY_TO_CANONICAL = {
  contasAReceber: "contasReceber",
  integralizacaoCapitalSocial: "integralizacaoAumentoCapitalSocial",
} as const;

export const DFC_UI_GROUPS: Array<[string, string[]]> = [
  [
    "Operacional",
    [
      DFC_LINE_LABELS.resultadoLiquidoExercicio,
      DFC_LINE_LABELS.depreciacaoAmortizacao,
      DFC_LINE_LABELS.resultadoVendaAtivoImobilizado,
      DFC_LINE_LABELS.resultadoEquivalenciaPatrimonial,
      DFC_LINE_LABELS.recebimentosLucrosDividendosSubsidiarias,
      DFC_LINE_LABELS.contasReceber,
      DFC_LINE_LABELS.adiantamentos,
      DFC_LINE_LABELS.impostosCompensar,
      DFC_LINE_LABELS.estoques,
      DFC_LINE_LABELS.despesasAntecipadas,
      DFC_LINE_LABELS.outrasContasReceber,
      DFC_LINE_LABELS.fornecedores,
      DFC_LINE_LABELS.obrigacoesTrabalhistas,
      DFC_LINE_LABELS.obrigacoesTributarias,
      DFC_LINE_LABELS.outrasObrigacoes,
      DFC_LINE_LABELS.parcelamentos,
    ],
  ],
  [
    "Investimentos",
    [
      DFC_LINE_LABELS.recebimentosVendasAtivo,
      DFC_LINE_LABELS.comprasImobilizado,
      DFC_LINE_LABELS.aquisicoesInvestimentos,
      DFC_LINE_LABELS.baixaAtivoImobilizado,
    ],
  ],
  [
    "Financiamentos",
    [
      DFC_LINE_LABELS.integralizacaoAumentoCapitalSocial,
      DFC_LINE_LABELS.pagamentoLucrosDividendos,
      DFC_LINE_LABELS.variacaoEmprestimosFinanciamentos,
      DFC_LINE_LABELS.dividendosProvisionadosPagar,
      DFC_LINE_LABELS.variacaoEmprestimosPessoasLigadas,
    ],
  ],
  ["Base", [DFC_LINE_LABELS.disponibilidadesBase]],
];

export const DFC_DERIVED_LINES = [
  "Lucro Ajustado",
  "Variacao Ativo",
  "Variacao Passivo",
  "Resultado Operacional",
  "Resultado de Investimento",
  "Resultado Financeiro",
  "Saldo Inicial Disponivel",
  "Saldo Final Disponivel",
  "Resultado Geracao de Caixa",
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DFC_CANONICAL_KEYS = Object.keys(DFC_LINE_LABELS) as Array<keyof typeof DFC_LINE_LABELS>;
const DFC_LABEL_TO_CANONICAL = new Map<string, string>(
  DFC_CANONICAL_KEYS.map((key) => [normalizeText(DFC_LINE_LABELS[key]), key] as [string, string])
);
const DFC_KEY_TO_CANONICAL = new Map<string, string>(
  DFC_CANONICAL_KEYS.map((key) => [normalizeText(key), key] as [string, string]).concat(
    Object.entries(DFC_LEGACY_TO_CANONICAL).map(
      ([legacyKey, canonicalKey]) => [normalizeText(legacyKey), canonicalKey] as [string, string]
    )
  )
);

export function getCanonicalDfcLineKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const normalized = normalizeText(trimmed);
  return DFC_LABEL_TO_CANONICAL.get(normalized) ?? DFC_KEY_TO_CANONICAL.get(normalized) ?? trimmed;
}

export function getDfcLineKeyVariants(value: string): string[] {
  const canonical = getCanonicalDfcLineKey(value);
  const aliases = Object.entries(DFC_LEGACY_TO_CANONICAL)
    .filter(([, mapped]) => mapped === canonical)
    .map(([legacy]) => legacy);

  return Array.from(new Set([canonical, ...aliases]));
}

export function getDfcLabelFromLineKey(value: string) {
  const canonical = getCanonicalDfcLineKey(value) as keyof typeof DFC_LINE_LABELS;
  return DFC_LINE_LABELS[canonical] ?? value;
}
