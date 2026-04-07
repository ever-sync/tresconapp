"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileDown,
  FileUp,
  LoaderCircle,
  MessageSquareText,
  Plus,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ReportCategory =
  | "fiscal"
  | "trabalhista"
  | "tributario"
  | "financeiro"
  | "comportamento"
  | "societario"
  | "evento_critico";

type Severity = "low" | "medium" | "high" | "critical";
type SignalStatus = "open" | "in_progress" | "resolved";

type ClientOption = {
  id: string;
  name: string;
  cnpj: string;
  taxRegime: string | null;
  status: string;
  industry: string | null;
};

type ReportAlert = {
  id: string;
  category: ReportCategory;
  categoryLabel: string;
  severity: Severity;
  severityLabel: string;
  status: SignalStatus;
  statusLabel: string;
  title: string;
  internalNote: string;
  clientTalkingPoint: string;
  estimatedValue: number | null;
  dueDate: string | null;
  periodYear: number | null;
  periodMonth: number | null;
  source: string;
  generated: boolean;
  createdAt: string;
};

type ReportOverview = {
  client: {
    id: string;
    name: string;
    cnpj: string;
    taxRegime: string | null;
    status: string;
    industry: string | null;
  };
  period: {
    year: number;
    month: number;
    monthLabel: string;
    computedAt: string;
    financialComputedAt: string | null;
  };
  scores: {
    overall: number;
    priority: string;
    fiscalRisk: number;
    laborRisk: number;
    financialRisk: number;
    behaviorRisk: number;
    opportunityPotential: number;
  };
  alerts: ReportAlert[];
  opportunities: ReportAlert[];
  financialSnapshot: {
    revenue: number;
    netResult: number;
    netMargin: number;
    ebitda: number;
    grossTaxes: number;
    cashGeneration: number;
    liquidityCurrent: number;
    totalAssets: number;
    totalLiabilities: number;
    dreStatus: string | null;
    patrimonialStatus: string | null;
    dfcStatus: string | null;
  };
  behavior: {
    unreadDocuments: number;
    documentCount: number;
    openTickets: number;
    inProgressTickets: number;
    highPriorityTickets: number;
    latestDocument: { title: string; category: string; sentAt: string } | null;
    latestImport: {
      kind: string;
      status: string;
      rowCount: number;
      errorMessage: string | null;
      startedAt: string;
      finishedAt: string | null;
    } | null;
  };
  criticalEvents: ReportAlert[];
  benchmark: {
    portfolioSize: number;
    revenuePosition: string;
    riskPosition: string;
    medianRevenue: number;
    medianOpenSignals: number;
    selectedOpenSignals: number;
  };
  advisorScript: {
    opening: string;
    talkingPoints: string[];
    followUp: string;
  };
  exportSummary: ReportExportSummary;
};

type ReportExportSummary = {
  title: string;
  highlights: Array<{ title: string; message: string; estimatedValue: number | null; dueDate: string | null }>;
  recommendations: string[];
  nextStep: string;
};

type SanitizedExport = {
  client: ReportOverview["client"];
  period: ReportOverview["period"];
  financialSnapshot: ReportOverview["financialSnapshot"];
  exportSummary: ReportExportSummary;
};

type SignalForm = {
  category: ReportCategory;
  severity: Severity;
  status: SignalStatus;
  title: string;
  internalNote: string;
  clientTalkingPoint: string;
  estimatedValue: string;
  dueDate: string;
  periodYear: string;
  periodMonth: string;
};

const CATEGORY_OPTIONS: Array<{ value: ReportCategory; label: string; hint: string }> = [
  { value: "fiscal", label: "Risco fiscal", hint: "Guias, declaracoes, multas e certidoes." },
  { value: "trabalhista", label: "Risco trabalhista", hint: "Folha, pro-labore, encargos e rotinas de DP." },
  { value: "tributario", label: "Oportunidade tributaria", hint: "Economia, regime e creditos potenciais." },
  { value: "financeiro", label: "Saude financeira", hint: "Margem, caixa, liquidez e endividamento." },
  { value: "comportamento", label: "Comportamento do cliente", hint: "Documentos, chamados, retrabalho e atrasos." },
  { value: "societario", label: "Societario", hint: "CNAE, quadro societario e capital social." },
  { value: "evento_critico", label: "Evento critico", hint: "Vencimentos e bloqueios que exigem acao." },
];

const SEVERITY_OPTIONS: Array<{ value: Severity; label: string }> = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Critica" },
];

const STATUS_OPTIONS: Array<{ value: SignalStatus; label: string }> = [
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em atendimento" },
  { value: "resolved", label: "Resolvido" },
];

const MONTH_OPTIONS = [
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

const initialForm: SignalForm = {
  category: "fiscal",
  severity: "medium",
  status: "open",
  title: "",
  internalNote: "",
  clientTalkingPoint: "",
  estimatedValue: "",
  dueDate: "",
  periodYear: "",
  periodMonth: "",
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function percent(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function compactNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function severityClasses(severity: Severity) {
  switch (severity) {
    case "critical":
      return "border-rose-400/30 bg-rose-500/10 text-rose-200";
    case "high":
      return "border-orange-400/30 bg-orange-500/10 text-orange-200";
    case "medium":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    default:
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }
}

function categoryIcon(category: ReportCategory) {
  switch (category) {
    case "financeiro":
      return BarChart3;
    case "comportamento":
      return MessageSquareText;
    case "tributario":
      return Sparkles;
    case "evento_critico":
      return AlertTriangle;
    default:
      return ShieldAlert;
  }
}

function scoreTone(score: number) {
  if (score >= 75) return "from-rose-500/30 to-orange-500/10 text-rose-100";
  if (score >= 55) return "from-orange-500/25 to-amber-500/10 text-orange-100";
  if (score >= 30) return "from-amber-500/20 to-cyan-500/10 text-amber-100";
  return "from-emerald-500/22 to-cyan-500/10 text-emerald-100";
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = (lines[0] ?? "").split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function ScorePanel({ overview }: { overview: ReportOverview }) {
  const scoreItems = [
    { label: "Fiscal", value: overview.scores.fiscalRisk },
    { label: "Trabalhista", value: overview.scores.laborRisk },
    { label: "Financeiro", value: overview.scores.financialRisk },
    { label: "Comportamento", value: overview.scores.behaviorRisk },
    { label: "Oportunidade", value: overview.scores.opportunityPotential },
  ];

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.98),rgba(10,18,32,0.92))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.38)] sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="flex flex-1 flex-col">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {scoreItems.map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={cn("flex min-h-[15rem] flex-col justify-between rounded-[1.75rem] bg-gradient-to-br p-6", scoreTone(overview.scores.overall))}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-white/60">Score interno</p>
            <p className="mt-4 text-6xl font-black tracking-tighter text-white">{overview.scores.overall}</p>
            <p className="mt-2 text-sm font-semibold text-white/80">{overview.scores.priority}</p>
          </div>
          <p className="mt-8 max-w-xs text-sm text-white/72">
            Nao expor este numero ao cliente. Use o roteiro consultivo para transformar o risco em orientacao.
          </p>
        </div>
      </div>
    </section>
  );
}

function MetricStrip({ overview }: { overview: ReportOverview }) {
  const metrics = [
    { label: "Receita", value: money(overview.financialSnapshot.revenue), hint: "DRE" },
    { label: "Resultado", value: money(overview.financialSnapshot.netResult), hint: percent(overview.financialSnapshot.netMargin) },
    { label: "Caixa", value: money(overview.financialSnapshot.cashGeneration), hint: "DFC" },
    { label: "Liquidez", value: compactNumber(overview.financialSnapshot.liquidityCurrent), hint: "Corrente" },
    { label: "Docs pendentes", value: String(overview.behavior.unreadDocuments), hint: `${overview.behavior.documentCount} total` },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-5">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-[1.5rem] border border-white/8 bg-white/[0.035] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{metric.label}</p>
          <p className="mt-3 truncate text-2xl font-black text-white">{metric.value}</p>
          <p className="mt-1 text-sm text-slate-400">{metric.hint}</p>
        </div>
      ))}
    </section>
  );
}

function AlertItem({ alert }: { alert: ReportAlert }) {
  const Icon = categoryIcon(alert.category);

  return (
    <article className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-white">{alert.title}</h3>
              {alert.generated && (
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-cyan-200">
                  Auto
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">{alert.internalNote}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", severityClasses(alert.severity))}>
            {alert.severityLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
            {alert.statusLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Impacto</p>
          <p className="mt-2 font-semibold text-slate-200">{alert.estimatedValue ? money(alert.estimatedValue) : "Nao estimado"}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Prazo</p>
          <p className="mt-2 font-semibold text-slate-200">{formatDate(alert.dueDate)}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Fonte</p>
          <p className="mt-2 font-semibold capitalize text-slate-200">{alert.source.replaceAll("_", " ")}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/8 p-4">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-200/75">Como falar com o cliente</p>
        <p className="mt-2 text-sm leading-6 text-cyan-50/90">{alert.clientTalkingPoint}</p>
      </div>
    </article>
  );
}

function ReportSection({ category, alerts }: { category: (typeof CATEGORY_OPTIONS)[number]; alerts: ReportAlert[] }) {
  const Icon = categoryIcon(category.value);

  return (
    <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.8),rgba(10,18,32,0.62))] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">{category.label}</h2>
            <p className="mt-1 text-sm text-slate-400">{category.hint}</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
          {alerts.length} sinal(is)
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.length > 0 ? (
          alerts.map((alert) => <AlertItem key={alert.id} alert={alert} />)
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.025] p-5 text-sm text-slate-400">
            Nenhum sinal registrado nesta categoria para o periodo selecionado.
          </div>
        )}
      </div>
    </section>
  );
}

function AdvisorPanel({ overview, exportData }: { overview: ReportOverview; exportData: SanitizedExport | null }) {
  return (
    <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(7,18,34,0.98),rgba(8,15,28,0.94))] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">Roteiro consultivo</h2>
          <p className="mt-1 text-sm text-slate-400">{overview.advisorScript.opening}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {overview.advisorScript.talkingPoints.length > 0 ? (
          overview.advisorScript.talkingPoints.map((point) => (
            <div key={point} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-slate-200">
              {point}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
            Nenhum ponto critico para converter em conversa neste periodo.
          </div>
        )}
      </div>

      {exportData && (
        <div className="mt-5 rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/8 p-4">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-200/80">Resumo exportavel</p>
          <h3 className="mt-3 font-bold text-white">{exportData.exportSummary.title}</h3>
          <div className="mt-3 space-y-2 text-sm leading-6 text-emerald-50/90">
            {exportData.exportSummary.recommendations.map((item) => (
              <p key={item}>{item}</p>
            ))}
            <p className="font-semibold">{exportData.exportSummary.nextStep}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function ReportsPageContent() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [clientsLoading, setClientsLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [exportData, setExportData] = useState<SanitizedExport | null>(null);
  const [form, setForm] = useState<SignalForm>(initialForm);
  const [savingSignal, setSavingSignal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => String(currentYear - 3 + index));
  }, []);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  useEffect(() => {
    let active = true;

    async function loadClients() {
      setClientsLoading(true);
      try {
        const response = await fetch("/api/staff/reports/clients", { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar clientes");
        const payload = (await response.json()) as { clients?: ClientOption[] };
        if (!active) return;
        const nextClients = payload.clients ?? [];
        setClients(nextClients);
        setSelectedClientId((current) => current || nextClients[0]?.id || "");
      } catch {
        if (active) setClients([]);
      } finally {
        if (active) setClientsLoading(false);
      }
    }

    void loadClients();
    return () => {
      active = false;
    };
  }, []);

  const loadOverview = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedClientId) return;
      setOverviewLoading(true);
      setExportData(null);

      try {
        const params = new URLSearchParams({
          clientId: selectedClientId,
          year,
          month,
        });
        const response = await fetch(`/api/staff/reports/overview?${params.toString()}`, {
          cache: "no-store",
          signal,
        });
        if (!response.ok) throw new Error("Falha ao carregar relatorio");
        const payload = (await response.json()) as ReportOverview;
        setOverview(payload);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setOverview(null);
      } finally {
        setOverviewLoading(false);
      }
    },
    [month, selectedClientId, year]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadOverview(controller.signal);
    return () => controller.abort();
  }, [loadOverview]);

  const groupedAlerts = useMemo(() => {
    const map = new Map<ReportCategory, ReportAlert[]>();
    for (const option of CATEGORY_OPTIONS) {
      map.set(option.value, []);
    }
    for (const alert of overview?.alerts ?? []) {
      map.set(alert.category, [...(map.get(alert.category) ?? []), alert]);
    }
    return map;
  }, [overview?.alerts]);

  const updateForm = useCallback(<K extends keyof SignalForm>(key: K, value: SignalForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  async function handleSaveSignal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClientId) return;
    setSavingSignal(true);
    setMessage(null);

    try {
      const response = await fetch("/api/staff/reports/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          category: form.category,
          severity: form.severity,
          status: form.status,
          title: form.title,
          internalNote: form.internalNote,
          clientTalkingPoint: form.clientTalkingPoint,
          estimatedValue: form.estimatedValue,
          dueDate: form.dueDate,
          periodYear: form.periodYear,
          periodMonth: form.periodMonth,
          source: "manual",
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Nao foi possivel salvar o sinal");
      setForm(initialForm);
      setMessage("Sinal salvo com sucesso.");
      await loadOverview();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nao foi possivel salvar o sinal");
    } finally {
      setSavingSignal(false);
    }
  }

  async function handleImportFile(file: File | null) {
    if (!file || !selectedClientId) return;
    setImporting(true);
    setMessage(null);

    try {
      let rows: Array<Record<string, unknown>> = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        rows = parseCsv(await file.text());
      } else {
        const xlsx = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
        rows = sheet ? xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }) : [];
      }

      if (rows.length === 0) throw new Error("A planilha nao possui linhas validas.");

      const response = await fetch("/api/staff/reports/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId, rows }),
      });
      const payload = (await response.json()) as { imported?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Nao foi possivel importar a planilha");
      setMessage(`${payload.imported ?? 0} sinal(is) importado(s).`);
      await loadOverview();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nao foi possivel importar a planilha");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleGenerateExport() {
    if (!selectedClientId) return;
    setMessage(null);

    try {
      const params = new URLSearchParams({ clientId: selectedClientId, year, month });
      const response = await fetch(`/api/staff/reports/export?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as SanitizedExport & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Nao foi possivel gerar o resumo");
      setExportData(payload);
      setMessage("Resumo para cliente gerado sem campos internos.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nao foi possivel gerar o resumo");
    }
  }

  return (
    <div className="space-y-5 p-3 sm:p-6 lg:p-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300/75">
              Relatorios consultivos
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
              Inteligencia interna por cliente
            </h1>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_8rem_8rem_auto] xl:w-[46rem]">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Cliente</span>
              <select
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/60"
                disabled={clientsLoading}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Ano</span>
              <select
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/60"
              >
                {availableYears.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Mes</span>
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/60"
              >
                {MONTH_OPTIONS.map((item, index) => (
                  <option key={item} value={String(index + 1)}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleGenerateExport}
              disabled={!overview}
              className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-4 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <FileDown className="h-4 w-4" />
              Gerar resumo
            </button>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100">
          {message}
        </div>
      )}

      {clientsLoading ? (
        <div className="flex min-h-[22rem] items-center justify-center rounded-[2rem] border border-white/8 bg-white/[0.03] text-slate-400">
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
          Carregando clientes...
        </div>
      ) : !selectedClient ? (
        <div className="rounded-[2rem] border border-dashed border-white/12 bg-white/[0.03] p-8 text-center">
          <BadgeCheck className="mx-auto h-10 w-10 text-cyan-200" />
          <h2 className="mt-4 text-xl font-black text-white">Nenhum cliente cadastrado</h2>
          <p className="mt-2 text-sm text-slate-400">
            Cadastre um cliente antes de gerar relatorios consultivos.
          </p>
        </div>
      ) : overviewLoading && !overview ? (
        <div className="flex min-h-[22rem] items-center justify-center rounded-[2rem] border border-white/8 bg-white/[0.03] text-slate-400">
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
          Montando diagnostico...
        </div>
      ) : overview ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            <CalendarDays className="h-4 w-4" />
            Atualizado em {formatDate(overview.period.computedAt)}
            {overview.period.financialComputedAt && <span>Demonstrativos: {formatDate(overview.period.financialComputedAt)}</span>}
          </div>

          <ScorePanel overview={overview} />
          <MetricStrip overview={overview} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
            <div className="space-y-5">
              {CATEGORY_OPTIONS.map((category) => (
                <ReportSection
                  key={category.value}
                  category={category}
                  alerts={groupedAlerts.get(category.value) ?? []}
                />
              ))}
            </div>

            <aside className="space-y-5 xl:sticky xl:top-32 xl:self-start">
              <AdvisorPanel overview={overview} exportData={exportData} />

              <section className="rounded-[2rem] border border-white/8 bg-white/[0.035] p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-200">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-white">Benchmark da carteira</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Comparacao com {overview.benchmark.portfolioSize} cliente(s) da contabilidade.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3 text-sm text-slate-300">
                  <p className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">{overview.benchmark.revenuePosition}</p>
                  <p className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">{overview.benchmark.riskPosition}</p>
                  <p className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    Mediana de receita: {money(overview.benchmark.medianRevenue)} · sinais abertos do cliente:{" "}
                    {overview.benchmark.selectedOpenSignals}
                  </p>
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/8 bg-white/[0.035] p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-white">Adicionar sinal</h2>
                    <p className="mt-1 text-sm text-slate-400">Registro manual para fiscal, trabalhista, tributario e demais areas.</p>
                  </div>
                </div>

                <form onSubmit={handleSaveSignal} className="mt-5 space-y-3">
                  <select
                    value={form.category}
                    onChange={(event) => updateForm("category", event.target.value as ReportCategory)}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={form.severity}
                      onChange={(event) => updateForm("severity", event.target.value as Severity)}
                      className="h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none"
                    >
                      {SEVERITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={form.status}
                      onChange={(event) => updateForm("status", event.target.value as SignalStatus)}
                      className="h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    value={form.title}
                    onChange={(event) => updateForm("title", event.target.value)}
                    placeholder="Titulo do sinal"
                    className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                  <textarea
                    value={form.internalNote}
                    onChange={(event) => updateForm("internalNote", event.target.value)}
                    placeholder="Nota interna: evidencia, causa provavel e risco"
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                  <textarea
                    value={form.clientTalkingPoint}
                    onChange={(event) => updateForm("clientTalkingPoint", event.target.value)}
                    placeholder="Como falar com o cliente sem expor dados internos"
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={form.estimatedValue}
                      onChange={(event) => updateForm("estimatedValue", event.target.value)}
                      placeholder="Valor estimado"
                      className="h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none placeholder:text-slate-600"
                    />
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(event) => updateForm("dueDate", event.target.value)}
                      className="h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={form.periodYear}
                      onChange={(event) => updateForm("periodYear", event.target.value)}
                      placeholder="Ano"
                      className="h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none placeholder:text-slate-600"
                    />
                    <input
                      value={form.periodMonth}
                      onChange={(event) => updateForm("periodMonth", event.target.value)}
                      placeholder="Mes"
                      className="h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingSignal}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-slate-950 transition hover:bg-cyan-100 disabled:opacity-50"
                  >
                    {savingSignal ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Salvar sinal
                  </button>
                </form>
              </section>

              <section className="rounded-[2rem] border border-white/8 bg-white/[0.035] p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-white">Importar XLSX/CSV</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Colunas aceitas: categoria, gravidade, status, titulo, nota interna, como falar, valor estimado e vencimento.
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => void handleImportFile(event.target.files?.[0] ?? null)}
                  className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-950"
                />
                {importing && (
                  <p className="mt-3 flex items-center text-sm text-slate-400">
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Importando sinais...
                  </p>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-white/12 bg-white/[0.03] p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-200" />
          <h2 className="mt-4 text-xl font-black text-white">Nao foi possivel montar o relatorio</h2>
          <p className="mt-2 text-sm text-slate-400">Tente trocar o cliente ou o periodo.</p>
        </div>
      )}
    </div>
  );
}

export default function RelatoriosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[26rem] items-center justify-center text-slate-400">
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
          Carregando relatorios...
        </div>
      }
    >
      <ReportsPageContent />
    </Suspense>
  );
}
