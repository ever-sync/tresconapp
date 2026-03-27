import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import parametrizationCache from "@/data/parametrization-cache.json";
import { ParametrizationWorkspace } from "@/components/parametrization-workspace";
import { cn } from "@/lib/utils";
import {
  DFC_DERIVED_LINES,
  DFC_UI_GROUPS,
  getCanonicalDfcLineKey,
  getDfcLabelFromLineKey,
  getDfcLineKeyVariants,
  getDfcTargetCanonicalLineKeys,
} from "@/lib/dfc-lines";

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
  mappedCount: number;
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
  tone: string;
  groups: GroupSection[];
  unmappedAccounts: AccountSnapshot[];
  unmappedTotalCount: number;
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
};

type ParametrizationCacheSnapshot = {
  sourceClient: { id: string; name: string; cnpj: string | null } | null;
  chartAccounts: ChartAccountRow[];
  dreMappings: DreMappingRow[];
  dfcLineMappings: DfcLineMappingRow[];
};

const MONTH_YEAR = new Date().getFullYear();
const UNMAPPED_PREVIEW_LIMIT = 120;

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
      "Outras Despesas",
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

function normalizeDemoKey(value: string | string[] | undefined): DemoKey {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "patrimonial" || raw === "dfc") return raw;
  return "dre";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGroupedCards(
  groups: Array<[string, string[]]>,
  countsByCategory: Map<string, number>,
  accountsByCategory: Map<string, AccountSnapshot[]>,
  description: string
): GroupSection[] {
  return groups.map(([title, items]) => ({
    title,
    cards: items.map((item) => ({
      key: normalizeText(item),
      title: item,
      mappedCount: countsByCategory.get(normalizeText(item)) ?? 0,
      mappedAccounts: accountsByCategory.get(normalizeText(item)) ?? [],
      description,
    })),
  }));
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

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function firstTargetOf(groups: Array<[string, string[]]>) {
  return groups[0]?.[1]?.[0] ?? "";
}

function buildDfcCountsByTarget(
  groups: Array<[string, string[]]>,
  counts: Array<{ line_key: string; _count: { _all: number } }>
) {
  const rawCountsByLine = counts.reduce((acc, group) => {
    const canonical = getCanonicalDfcLineKey(group.line_key);
    acc.set(canonical, (acc.get(canonical) ?? 0) + group._count._all);
    return acc;
  }, new Map<string, number>());

  return groups
    .flatMap(([, items]) => items)
    .reduce((acc, item) => {
      const total = getDfcTargetCanonicalLineKeys(item).reduce(
        (sum, key) => sum + (rawCountsByLine.get(key) ?? 0),
        0
      );
      acc.set(normalizeText(item), total);
      return acc;
    }, new Map<string, number>());
}

export default async function ParametrizacaoPage({ searchParams }: ParametrizacaoPageProps) {
  const auth = await requireStaff();
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedTab = normalizeDemoKey(resolvedSearchParams.tab);
  const initialTarget =
    selectedTab === "dre"
      ? firstTargetOf(DRE_GROUPS)
      : selectedTab === "patrimonial"
        ? firstTargetOf(PATRIMONIAL_GROUPS)
        : firstTargetOf(DFC_UI_GROUPS);

  let loadError: string | null = null;
  let mappedChartAccounts: ChartAccountRow[] = [];
  let dreMappings: DreMappingRow[] = [];
  let patrimonialMappings: PatrimonialMappingRow[] = [];
  let dfcLineMappings: DfcLineMappingRow[] = [];
  let unmappedPreviewAccounts: ChartAccountRow[] = [];
  let unmappedTotalCount = 0;
  let mappedCountsByTarget = new Map<string, number>();

  try {
    if (selectedTab === "dre") {
      const [dreCounts, initialMappings] = await Promise.all([
        prisma.dREMapping.groupBy({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
          by: ["category"],
          _count: {
            _all: true,
          },
        }),
        prisma.dREMapping.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
            category: initialTarget,
          },
          select: {
            account_code: true,
            account_name: true,
            category: true,
          },
          orderBy: [{ account_code: "asc" }],
        }),
      ]);

      mappedCountsByTarget = new Map(
        dreCounts.map((group) => [normalizeText(group.category), group._count._all])
      );
      dreMappings = initialMappings;

      const dreCodes = uniqueStrings(initialMappings.map((mapping) => mapping.account_code));
      if (dreCodes.length > 0) {
        mappedChartAccounts = await prisma.chartOfAccounts.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
            code: { in: dreCodes },
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
        });
      }
    } else if (selectedTab === "patrimonial") {
      const [patrimonialCounts, initialMappings] = await Promise.all([
        prisma.patrimonialMapping.groupBy({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
          by: ["category"],
          _count: {
            _all: true,
          },
        }),
        prisma.patrimonialMapping.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
            category: initialTarget,
          },
          select: {
            account_code: true,
            account_name: true,
            category: true,
          },
          orderBy: [{ account_code: "asc" }],
        }),
      ]);

      mappedCountsByTarget = new Map(
        patrimonialCounts.map((group) => [normalizeText(group.category), group._count._all])
      );
      patrimonialMappings = initialMappings;

      const mappedCodes = uniqueStrings(initialMappings.map((mapping) => mapping.account_code));
      const unmappedWhere =
        mappedCodes.length > 0
          ? {
              accounting_id: auth.accountingId,
              client_id: null as null,
              code: { notIn: mappedCodes },
            }
          : {
              accounting_id: auth.accountingId,
              client_id: null as null,
            };

      [mappedChartAccounts, unmappedPreviewAccounts, unmappedTotalCount] = await Promise.all([
        mappedCodes.length > 0
          ? prisma.chartOfAccounts.findMany({
              where: {
                accounting_id: auth.accountingId,
                client_id: null,
                code: { in: mappedCodes },
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
            })
          : Promise.resolve([]),
        prisma.chartOfAccounts.findMany({
          where: unmappedWhere,
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
          take: UNMAPPED_PREVIEW_LIMIT,
        }),
        prisma.chartOfAccounts.count({ where: unmappedWhere }),
      ]);
    } else {
      const [dfcCounts, initialMappings] = await Promise.all([
        prisma.dFCLineMapping.groupBy({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
          by: ["line_key"],
          _count: {
            _all: true,
          },
        }),
        prisma.dFCLineMapping.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
            line_key: { in: getDfcLineKeyVariants(initialTarget) },
          },
          select: {
            line_key: true,
            chart_account_id: true,
            account_code_snapshot: true,
            reduced_code_snapshot: true,
          },
          orderBy: [{ account_code_snapshot: "asc" }],
        }),
      ]);

      mappedCountsByTarget = buildDfcCountsByTarget(DFC_UI_GROUPS, dfcCounts);
      dfcLineMappings = initialMappings;

      const mappedIds = uniqueStrings(initialMappings.map((mapping) => mapping.chart_account_id));
      const unmappedWhere =
        mappedIds.length > 0
          ? {
              accounting_id: auth.accountingId,
              client_id: null as null,
              id: { notIn: mappedIds },
            }
          : {
              accounting_id: auth.accountingId,
              client_id: null as null,
            };

      [mappedChartAccounts, unmappedPreviewAccounts, unmappedTotalCount] = await Promise.all([
        mappedIds.length > 0
          ? prisma.chartOfAccounts.findMany({
              where: {
                accounting_id: auth.accountingId,
                client_id: null,
                id: { in: mappedIds },
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
            })
          : Promise.resolve([]),
        prisma.chartOfAccounts.findMany({
          where: unmappedWhere,
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
          take: UNMAPPED_PREVIEW_LIMIT,
        }),
        prisma.chartOfAccounts.count({ where: unmappedWhere }),
      ]);
    }
  } catch (err) {
    console.error("[parametrizacao] failed to load reference data", err);
    const snapshot = parametrizationCache as ParametrizationCacheSnapshot;
    mappedChartAccounts = snapshot.chartAccounts ?? [];
    dreMappings =
      selectedTab === "dre"
        ? (snapshot.dreMappings ?? []).filter((mapping) => mapping.category === initialTarget)
        : [];
    patrimonialMappings = [];
    dfcLineMappings =
      selectedTab === "dfc"
        ? (snapshot.dfcLineMappings ?? []).filter((mapping) =>
            getDfcLineKeyVariants(initialTarget).includes(mapping.line_key)
          )
        : [];
    unmappedPreviewAccounts = selectedTab === "dre" ? [] : (snapshot.chartAccounts ?? []).slice(0, UNMAPPED_PREVIEW_LIMIT);
    unmappedTotalCount = selectedTab === "dre" ? 0 : (snapshot.chartAccounts ?? []).length;
    if (selectedTab === "dre") {
      mappedCountsByTarget = (snapshot.dreMappings ?? []).reduce((acc, mapping) => {
        const key = normalizeText(mapping.category);
        acc.set(key, (acc.get(key) ?? 0) + 1);
        return acc;
      }, new Map<string, number>());
    } else if (selectedTab === "dfc") {
      mappedCountsByTarget = buildDfcCountsByTarget(
        DFC_UI_GROUPS,
        (snapshot.dfcLineMappings ?? []).reduce<Array<{ line_key: string; _count: { _all: number } }>>(
          (acc, mapping) => {
            const current = acc.find((item) => item.line_key === mapping.line_key);
            if (current) {
              current._count._all += 1;
            } else {
              acc.push({ line_key: mapping.line_key, _count: { _all: 1 } });
            }
            return acc;
          },
          []
        )
      );
    }
    loadError =
      "Nao foi possivel carregar o banco agora. A tela esta usando a copia local da parametrizacao da Coca-Cola.";
  }

  const isOffline = Boolean(loadError);

  const mappedAccountsByCode = new Map(mappedChartAccounts.map((account) => [account.code, account]));
  const mappedAccountsById = new Map(mappedChartAccounts.map((account) => [account.id, account]));

  let activeSection: DemoSection;

  if (selectedTab === "dre") {
    const dreMappingsByCategory = new Map<string, AccountSnapshot[]>();

    for (const mapping of dreMappings) {
      const account = mappedAccountsByCode.get(mapping.account_code);
      const snapshot = buildAccountSnapshot({
        code: mapping.account_code,
        reduced_code: account?.reduced_code ?? null,
        name: account?.name ?? mapping.account_name,
      });
      const key = normalizeText(mapping.category);
      const list = dreMappingsByCategory.get(key) ?? [];
      list.push(snapshot);
      dreMappingsByCategory.set(key, list);
    }

    activeSection = {
      key: "dre",
      title: "DRE",
      subtitle: "Resultado",
      description: "Parametrizacao global do resultado consolidado.",
      tone: "border-cyan-400/20",
      groups: buildGroupedCards(
        DRE_GROUPS,
        mappedCountsByTarget,
        dreMappingsByCategory,
        "Ajuste o DE-PARA desta linha para consolidar o demonstrativo."
      ),
      unmappedAccounts: [],
      unmappedTotalCount: 0,
    };
  } else if (selectedTab === "patrimonial") {
    const mappingsByCategory = new Map<string, AccountSnapshot[]>();

    for (const mapping of patrimonialMappings) {
      const account = mappedAccountsByCode.get(mapping.account_code);
      const snapshot = buildAccountSnapshot({
        code: mapping.account_code,
        reduced_code: account?.reduced_code ?? null,
        name: account?.name ?? mapping.account_name,
      });
      const key = normalizeText(mapping.category);
      const list = mappingsByCategory.get(key) ?? [];
      list.push(snapshot);
      mappingsByCategory.set(key, list);
    }

    activeSection = {
      key: "patrimonial",
      title: "Patrimonial",
      subtitle: "Balanco",
      description: "Parametrizacao global dos grupos patrimoniais e indicadores.",
      tone: "border-sky-400/20",
      groups: buildGroupedCards(
        PATRIMONIAL_GROUPS,
        mappedCountsByTarget,
        mappingsByCategory,
        "Ajuste o DE-PARA desta linha para consolidar o balanco."
      ),
      unmappedAccounts: unmappedPreviewAccounts.map(buildAccountSnapshot),
      unmappedTotalCount,
    };
  } else {
    const mappingsByLine = new Map<string, AccountSnapshot[]>();

    for (const mapping of dfcLineMappings) {
      const linkedAccount = mappedAccountsById.get(mapping.chart_account_id);
      const snapshot = buildAccountSnapshot({
        code: linkedAccount?.code ?? mapping.account_code_snapshot,
        reduced_code: linkedAccount?.reduced_code ?? mapping.reduced_code_snapshot,
        name: linkedAccount?.name ?? mapping.account_code_snapshot,
      });
      const key = normalizeText(getDfcLabelFromLineKey(mapping.line_key));
      const list = mappingsByLine.get(key) ?? [];
      if (!list.some((item) => item.code === snapshot.code)) {
        list.push(snapshot);
      }
      mappingsByLine.set(key, list);
    }

    activeSection = {
      key: "dfc",
      title: "DFC",
      subtitle: "Caixa",
      description: "Parametrizacao global das linhas do fluxo de caixa.",
      tone: "border-blue-400/20",
      groups: buildGroupedCards(
        DFC_UI_GROUPS,
        mappedCountsByTarget,
        mappingsByLine,
        "Defina a linha do fluxo de caixa e mantenha a consolidacao padronizada."
      ),
      unmappedAccounts: unmappedPreviewAccounts.map(buildAccountSnapshot),
      unmappedTotalCount,
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
              O que for salvo aqui vale para toda a contabilidade.
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
