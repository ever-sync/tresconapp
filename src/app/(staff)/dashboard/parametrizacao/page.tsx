import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import parametrizationCache from "@/data/parametrization-cache.json";
import { ParametrizationWorkspace } from "@/components/parametrization-workspace";
import {
  ParametrizationAddButton,
  ParametrizationRemoveButton,
  ParametrizationRemoveManyButton,
} from "@/components/parametrization-actions";
import { cn } from "@/lib/utils";

type DemoKey = "dre" | "patrimonial" | "dfc";

type ParametrizacaoPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
  }>;
};

type AccountSnapshot = {
  code: string;
  reducedCode: string | null;
  name: string;
};

type CategoryCard = {
  key: string;
  title: string;
  mappedAccounts: AccountSnapshot[];
  description: string;
};

type GroupSection = {
  title: string;
  cards: CategoryCard[];
};

type DemoSection = {
  key: DemoKey;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  tone: string;
  groups: GroupSection[];
  unmappedAccounts: AccountSnapshot[];
  derivedLines?: string[];
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

type DreMappingRow = {
  account_code: string;
  account_name: string;
  category: string;
};

type PatrimonialMappingRow = {
  account_code: string;
  account_name: string;
  category: string;
};

type DfcLineMappingRow = {
  line_key: string;
  chart_account_id: string;
  account_code_snapshot: string;
  reduced_code_snapshot: string | null;
  source_type: string;
  multiplier: number;
  include_children: boolean;
};

type ParametrizationCacheSnapshot = {
  sourceClient: { id: string; name: string; cnpj: string | null } | null;
  chartAccounts: ChartAccountRow[];
  dreMappings: DreMappingRow[];
  dfcLineMappings: DfcLineMappingRow[];
};

const MONTH_YEAR = new Date().getFullYear();
const COCA_COLA_SOURCE_CLIENT_ID = "68d82e4e-5571-406a-88c4-5fb3abf5d63e";

function normalizeDemoKey(value: string | string[] | undefined): DemoKey {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "patrimonial" || raw === "dfc") return raw;
  return "dre";
}

const DRE_GROUPS: Array<[string, string[]]> = [
  [
    "Receitas",
    ["Receita Bruta", "Receitas Financeiras", "Outras Receitas", "Resultado Participacoes Societarias"],
  ],
  ["Deducoes", ["Deducoes de Vendas", "IRPJ e CSLL"]],
  ["Custos", ["Custos das Vendas", "Custos dos Servicos"]],
  [
    "Despesas",
    [
      "Despesas Administrativas",
      "Despesas Comerciais",
      "Despesas Tributarias",
      "Despesas Financeiras",
    ],
  ],
  ["Outros", ["Depreciacao e Amortizacao"]],
];

const PATRIMONIAL_GROUPS: Array<[string, string[]]> = [
  [
    "Ativo Circulante",
    [
      "Disponivel",
      "Clientes",
      "Adiantamentos",
      "Estoques",
      "Tributos A Compensar CP",
      "Outras Contas A Receber",
      "Despesas Antecipadas",
    ],
  ],
  [
    "Ativo Nao Circulante",
    [
      "Contas A Receber LP",
      "Processos Judiciais",
      "Partes Relacionadas A Receber",
      "Outras Contas A Receber LP",
      "Tributos A Recuperar LP",
      "Investimentos",
      "Imobilizado",
      "Intangivel",
    ],
  ],
  [
    "Passivo Circulante",
    [
      "Fornecedores",
      "Emprestimos E Financiamentos CP",
      "Obrigacoes Trabalhistas",
      "Obrigacoes Tributarias",
      "Contas A Pagar CP",
      "Parcelamentos CP",
      "Processos A Pagar CP",
    ],
  ],
  [
    "Passivo Nao Circulante",
    [
      "Emprestimos E Financiamentos LP",
      "Conta Corrente Dos Socios",
      "Emprestimos Partes Relacionadas",
      "Parcelamentos LP",
      "Processos A Pagar LP",
      "Impostos Diferidos",
      "Outras Contas A Pagar LP",
      "Receita De Exercicio Futuro LP",
      "Provisao Para Contingencias",
    ],
  ],
  [
    "Patrimonio Liquido",
    [
      "Capital Social",
      "Reserva De Capital",
      "Reserva De Lucros",
      "Resultado Do Exercicio",
      "Distribuicao De Lucros",
    ],
  ],
];

const DFC_GROUPS: Array<[string, string[]]> = [
  [
    "Operacional",
    [
      "Resultado Liquido do Exercicio",
      "Depreciacao e Amortizacao",
      "Resultado da Equivalencia Patrimonial",
      "Recebimentos de Lucros e Dividendos de Subsidiarias",
      "Contas a Receber",
      "Adiantamentos",
      "Impostos a Compensar",
      "Estoques",
      "Despesas Antecipadas",
      "Outras Contas a Receber",
      "Fornecedores",
      "Obrigacoes Trabalhistas",
      "Obrigacoes Tributarias",
      "Outras Obrigacoes",
      "Parcelamentos",
    ],
  ],
  [
    "Investimentos",
    [
      "Recebimentos por Vendas de Ativo",
      "Compras de Imobilizado",
      "Aquisicoes em Investimentos",
      "Baixa de Ativo Imobilizado",
    ],
  ],
  [
    "Financiamentos",
    [
      "Integralizacao ou Aumento de Capital Social",
      "Pagamento de Lucros e Dividendos",
      "Variacao em Emprestimos/Financiamentos",
      "Dividendos Provisionados a Pagar",
      "Variacao Emprestimos Pessoas Ligadas PJ/PF",
    ],
  ],
  ["Base", ["Disponibilidades Base"]],
];

const DFC_DERIVED_LINES = [
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

function countLabel(count: number) {
  return `${count} conta(s) mapeada(s)`;
}

function formatListLabel(account: AccountSnapshot) {
  const code = account.reducedCode || account.code;
  return `${code} - ${account.name}`;
}

function groupCardTitle(title: string) {
  return title;
}

function buildAccountSnapshot(item: {
  code: string;
  reduced_code?: string | null;
  name: string;
}): AccountSnapshot {
  return {
    code: item.code,
    reducedCode: item.reduced_code ?? null,
    name: item.name,
  };
}

function resolveConfiguredCategory(category: string | null | undefined) {
  const normalized = category ? normalizeText(category) : "";
  return normalized || null;
}

function resolveSectionColor(index: number) {
  const palette = [
    "border-cyan-500/20 bg-cyan-500/8",
    "border-sky-500/20 bg-sky-500/8",
    "border-blue-500/20 bg-blue-500/8",
    "border-emerald-500/20 bg-emerald-500/8",
    "border-amber-500/20 bg-amber-500/8",
  ];

  return palette[index % palette.length];
}

function buildGroupedCards(
  groups: Array<[string, string[]]>,
  accountsByCategory: Map<string, AccountSnapshot[]>
): GroupSection[] {
  return groups.map(([title, items]) => ({
    title,
    cards: items.map((item) => ({
      key: normalizeText(item),
      title: item,
      mappedAccounts: accountsByCategory.get(normalizeText(item)) ?? [],
      description: "Ajuste o DE-PARA desta linha para consolidar o demonstrativo.",
    })),
  }));
}

function buildDfcGroups(
  groups: Array<[string, string[]]>,
  mappingsByLine: Map<string, AccountSnapshot[]>
): GroupSection[] {
  return groups.map(([title, items]) => ({
    title,
    cards: items.map((item) => ({
      key: normalizeText(item),
      title: item,
      mappedAccounts: mappingsByLine.get(normalizeText(item)) ?? [],
      description: "Defina a linha de fluxo de caixa e mantenha a consolidacao padronizada.",
    })),
  }));
}

function renderAccountLines(
  accounts: AccountSnapshot[],
  kind?: DemoKey,
  target?: string
) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-500">
        Nenhuma conta configurada nessa categoria.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <div
          key={`${account.code}-${account.name}`}
          className="rounded-[1.1rem] border border-white/8 bg-[#0b1525] px-4 py-3"
        >
          <div className="mb-2 text-[0.58rem] font-black uppercase tracking-[0.32em] text-slate-500">
            Conta
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-2xl border border-white/8 bg-[#0f1a2b] px-4 py-3 text-sm text-slate-100">
              {formatListLabel(account)}
            </div>
            {kind && target ? (
              <ParametrizationRemoveButton
                kind={kind}
                target={target}
                accountCode={account.code}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function DemoSectionView({
  section,
  isOffline,
}: {
  section: DemoSection;
  isOffline: boolean;
}) {
  return (
    <section
      id={section.key}
      className={cn(
        "rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(8,18,32,0.92))] shadow-[0_24px_90px_rgba(0,0,0,0.3)]",
        section.tone
      )}
    >
      <div className="px-5 py-5">
        <div className="space-y-5">
          {section.groups.map((group, index) => (
            <div key={group.title} className="rounded-[1.5rem] border border-white/8 bg-white/3 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                    {group.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Selecione as contas titulo que alimentam este bloco.
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.24em] text-slate-200",
                    resolveSectionColor(index)
                  )}
                >
                  {group.cards.length} itens
                </span>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {group.cards.map((card) => (
                  <article
                    key={card.key}
                    className="rounded-[1.4rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,39,0.98),rgba(8,17,30,0.95))] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-white">{groupCardTitle(card.title)}</h3>
                        <p className="mt-1 text-xs text-slate-500">{countLabel(card.mappedAccounts.length)}</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <ParametrizationAddButton
                          kind={section.key}
                          target={card.title}
                          disabled={isOffline}
                        />
                        <ParametrizationRemoveManyButton
                          kind={section.key}
                          target={card.title}
                          accountCodes={card.mappedAccounts.map((account) => account.code)}
                          disabled={isOffline || card.mappedAccounts.length === 0}
                        />
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/6 bg-black/10 p-4">
                      {renderAccountLines(card.mappedAccounts, section.key, card.title)}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        {section.key !== "dre" && (
          <div className="mt-6 rounded-[1.6rem] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(42,35,20,0.96),rgba(32,26,16,0.92))] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
                  Contas nao mapeadas ({section.unmappedAccounts.length})
                </p>
                <p className="mt-1 text-xs text-amber-100/60">
                  Use a base de referencia para classificar rapidamente as contas sem destino.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-200 transition hover:bg-amber-500/15"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Revisar lista
              </button>
            </div>

            <div className="max-h-64 overflow-auto rounded-2xl border border-white/6 bg-black/20 p-4">
              {renderAccountLines(section.unmappedAccounts)}
            </div>
          </div>
        )}

        {section.derivedLines && (
          <div className="mt-6 rounded-[1.6rem] border border-white/8 bg-white/4 p-4">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-slate-300">
              Linhas derivadas nao parametrizadas
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Essas linhas sao calculadas automaticamente pelo sistema.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {section.derivedLines.map((line) => (
                <span
                  key={line}
                  className="rounded-full border border-white/8 bg-black/15 px-3 py-2 text-xs font-semibold text-slate-200"
                >
                  {line}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default async function ParametrizacaoPage({ searchParams }: ParametrizacaoPageProps) {
  const auth = await requireStaff();
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedTab = normalizeDemoKey(resolvedSearchParams.tab);

  let loadError: string | null = null;
  let cocaColaSourceClient: { id: string; name: string; cnpj: string | null } | null = null;
  let referenceClient: { id: string; name: string; cnpj: string | null } | null = null;
  let firstClient: { id: string; name: string; cnpj: string | null } | null = null;
  let chartAccounts: ChartAccountRow[] = [];
  let dreMappings: DreMappingRow[] = [];
  let patrimonialMappings: PatrimonialMappingRow[] = [];
  let dfcLineMappings: DfcLineMappingRow[] = [];

  try {
    [
      cocaColaSourceClient,
      referenceClient,
      firstClient,
      chartAccounts,
      dreMappings,
      patrimonialMappings,
      dfcLineMappings,
    ] = await Promise.all([
      prisma.client.findUnique({
        where: {
          id: COCA_COLA_SOURCE_CLIENT_ID,
        },
        select: { id: true, name: true, cnpj: true },
      }),
      prisma.client.findFirst({
        where: {
          accounting_id: auth.accountingId,
          deleted_at: null,
          name: { contains: "coca cola", mode: "insensitive" },
        },
        select: { id: true, name: true, cnpj: true },
      }),
      prisma.client.findFirst({
        where: {
          accounting_id: auth.accountingId,
          deleted_at: null,
        },
        orderBy: { created_at: "asc" },
        select: { id: true, name: true, cnpj: true },
      }),
      prisma.chartOfAccounts.findMany({
        where: {
          accounting_id: auth.accountingId,
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
        orderBy: [{ level: "asc" }, { code: "asc" }],
      }),
      selectedTab === "dre"
        ? prisma.dREMapping.findMany({
            where: {
              accounting_id: auth.accountingId,
              client_id: null,
            },
            select: {
              account_code: true,
              account_name: true,
              category: true,
            },
            orderBy: [{ category: "asc" }, { account_code: "asc" }],
          })
        : Promise.resolve([]),
      selectedTab === "patrimonial"
        ? prisma.patrimonialMapping.findMany({
            where: {
              accounting_id: auth.accountingId,
              client_id: null,
            },
            select: {
              account_code: true,
              account_name: true,
              category: true,
            },
            orderBy: [{ category: "asc" }, { account_code: "asc" }],
          })
        : Promise.resolve([]),
      selectedTab === "dfc"
        ? prisma.dFCLineMapping.findMany({
            where: {
              accounting_id: auth.accountingId,
              client_id: null,
            },
            select: {
              line_key: true,
              chart_account_id: true,
              account_code_snapshot: true,
              reduced_code_snapshot: true,
              source_type: true,
              multiplier: true,
              include_children: true,
            },
            orderBy: [{ line_key: "asc" }, { account_code_snapshot: "asc" }],
          })
        : Promise.resolve([]),
    ]);
  } catch (err) {
    console.error("[parametrizacao] failed to load reference data", err);
    const snapshot = parametrizationCache as ParametrizationCacheSnapshot;
    cocaColaSourceClient = snapshot.sourceClient;
    referenceClient = snapshot.sourceClient;
    firstClient = snapshot.sourceClient;
    chartAccounts = snapshot.chartAccounts ?? [];
    dreMappings = snapshot.dreMappings ?? [];
    patrimonialMappings = [];
    dfcLineMappings = snapshot.dfcLineMappings ?? [];
    loadError =
      "Nao foi possivel carregar o banco agora. A tela esta usando a copia local da parametrizacao da Coca-Cola.";
  }

  const baseClient = cocaColaSourceClient ?? referenceClient ?? firstClient;
  const baseClientName = baseClient?.name ?? "Base de referencia";
  const isOffline = Boolean(loadError);

  const mergedAccountsByCode = new Map<string, ChartAccountRow>();
  const mergedAccountsById = new Map<string, ChartAccountRow>();
  for (const account of chartAccounts) {
    mergedAccountsByCode.set(account.code, account);
    mergedAccountsById.set(account.id, account);
  }

  let activeSection: DemoSection;

  if (selectedTab === "dre") {
    const dreMappingsByCategory = new Map<string, AccountSnapshot[]>();
    const dreUnmapped: AccountSnapshot[] = [];

    for (const account of mergedAccountsByCode.values()) {
      const mapping = (dreMappings as DreMappingRow[]).find((item) => item.account_code === account.code) ?? null;
      const category = resolveConfiguredCategory(mapping?.category ?? account.report_category);

      const snapshot = buildAccountSnapshot(account);
      if (category) {
        const list = dreMappingsByCategory.get(normalizeText(category)) ?? [];
        list.push(snapshot);
        dreMappingsByCategory.set(normalizeText(category), list);
      } else {
        dreUnmapped.push(snapshot);
      }
    }

    activeSection = {
      key: "dre",
      title: "DRE",
      subtitle: "Parametrizacao DRE Global",
      description:
        "Base de referencia: " +
        baseClientName +
        ". O mapeamento global vale para toda a carteira da contabilidade.",
      accent: "text-cyan-300",
      tone: "border-cyan-400/20",
      groups: buildGroupedCards(DRE_GROUPS, dreMappingsByCategory),
      unmappedAccounts: dreUnmapped,
    };
  } else if (selectedTab === "patrimonial") {
    const patrimonialMappingsByCategory = new Map<string, AccountSnapshot[]>();
    const patrimonialUnmapped: AccountSnapshot[] = [];

    for (const account of mergedAccountsByCode.values()) {
      const mapping =
        (patrimonialMappings as PatrimonialMappingRow[]).find((item) => item.account_code === account.code) ?? null;
      const category = resolveConfiguredCategory(mapping?.category ?? account.report_category);

      const snapshot = buildAccountSnapshot(account);
      if (category) {
        const list = patrimonialMappingsByCategory.get(normalizeText(category)) ?? [];
        list.push(snapshot);
        patrimonialMappingsByCategory.set(normalizeText(category), list);
      } else {
        patrimonialUnmapped.push(snapshot);
      }
    }

    activeSection = {
      key: "patrimonial",
      title: "Patrimonial",
      subtitle: "Parametrizacao Patrimonial Global",
      description:
        "Base de referencia: " +
        baseClientName +
        ". A leitura do balanco segue os grupos patrimoniais e os indicadores da tela.",
      accent: "text-sky-300",
      tone: "border-sky-400/20",
      groups: buildGroupedCards(PATRIMONIAL_GROUPS, patrimonialMappingsByCategory),
      unmappedAccounts: patrimonialUnmapped,
    };
  } else {
    const dfcMappingsByLine = new Map<string, AccountSnapshot[]>();
    const dfcMappedCodes = new Set<string>();
    for (const mapping of dfcLineMappings as DfcLineMappingRow[]) {
      const key = normalizeText(mapping.line_key);
      const linkedAccount = mergedAccountsById.get(mapping.chart_account_id) ?? null;
      const snapshot = buildAccountSnapshot({
        code: linkedAccount?.code ?? mapping.account_code_snapshot,
        reduced_code: linkedAccount?.reduced_code ?? mapping.reduced_code_snapshot,
        name: linkedAccount?.name ?? mapping.account_code_snapshot,
      });
      const list = dfcMappingsByLine.get(key) ?? [];
      list.push(snapshot);
      dfcMappingsByLine.set(key, list);
      dfcMappedCodes.add(snapshot.code);
    }

    const dfcUnmapped = Array.from(mergedAccountsByCode.values())
      .filter((account) => !dfcMappedCodes.has(account.code))
      .map(buildAccountSnapshot);

    activeSection = {
      key: "dfc",
      title: "DFC",
      subtitle: "Parametrizacao DFC Global",
      description:
        "Base de referencia: " +
        baseClientName +
        ". O fluxo de caixa indireto usa linhas parametrizadas e linhas derivadas calculadas.",
      accent: "text-blue-300",
      tone: "border-blue-400/20",
      groups: buildDfcGroups(DFC_GROUPS, dfcMappingsByLine),
      unmappedAccounts: dfcUnmapped,
      derivedLines: DFC_DERIVED_LINES,
    };
  }

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,#08111f_0%,#091527_45%,#07101c_100%)] px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(13,24,42,0.96),rgba(8,18,32,0.92))] shadow-[0_24px_90px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-5 border-b border-white/6 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300/70">
              Parametrizacao
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Parametrizacao dos Demonstrativos
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              O que for salvo aqui vale para toda a contabilidade. Use a base de referencia
              para acelerar a configuracao.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
            <span className="text-sm font-semibold text-slate-300">Ano</span>
            <span className="text-sm font-black text-cyan-300">{MONTH_YEAR}</span>
            <ChevronRight className="h-4 w-4 rotate-90 text-slate-500" />
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                key: "dre" as const,
                title: "DRE",
                subtitle: "Resultado",
                href: "/dashboard/parametrizacao?tab=dre",
                accent: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
                active: selectedTab === "dre",
              },
              {
                key: "patrimonial" as const,
                title: "Patrimonial",
                subtitle: "Balanco",
                href: "/dashboard/parametrizacao?tab=patrimonial",
                accent: "border-sky-400/20 bg-sky-500/10 text-sky-300",
                active: selectedTab === "patrimonial",
              },
              {
                key: "dfc" as const,
                title: "DFC",
                subtitle: "Caixa",
                href: "/dashboard/parametrizacao?tab=dfc",
                accent: "border-blue-400/20 bg-blue-500/10 text-blue-300",
                active: selectedTab === "dfc",
              },
            ].map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={cn(
                  "flex items-center justify-between rounded-[1.5rem] border px-5 py-4 transition hover:-translate-y-0.5",
                  tab.active
                    ? tab.accent
                    : "border-white/8 bg-white/4 text-slate-300 hover:bg-white/5"
                )}
              >
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.35em] text-slate-500">
                    {tab.subtitle}
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-tight">{tab.title}</h2>
                </div>
                <ChevronRight className="h-5 w-5" />
              </Link>
            ))}
          </div>

          {isOffline && (
            <div className="rounded-[1.5rem] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(45,32,18,0.96),rgba(30,22,14,0.92))] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
                    Base indisponivel
                  </p>
                  <p className="mt-1 text-sm text-amber-100/70">{loadError}</p>
                </div>
              </div>
            </div>
          )}

          <ParametrizationWorkspace section={activeSection} isOffline={isOffline} />
        </div>
      </section>
    </div>
  );
}
