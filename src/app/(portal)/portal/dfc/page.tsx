"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileDown,
  FileUp,
  Landmark,
  List,
  LoaderCircle,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

import { uploadFormDataWithProgress } from "@/lib/upload-request";
import { cn } from "@/lib/utils";

type ViewMode = "calculo" | "balancete" | "graficos" | "fechado";

type DfcRow = {
  key: string;
  label: string;
  section: string;
  kind: "section" | "row" | "subtotal";
  level: number;
  monthly: number[];
  accumulated: number;
  percent: number | null;
};

type DfcResponse = {
  year: number;
  monthLabels: string[];
  activeMonthIndex: number;
  status: "ready" | "partial";
  warnings: string[];
  rows: DfcRow[];
  balanceteUploads: Array<{
    month: number;
    label: string;
    status: "processing" | "ready" | "failed" | "empty";
    fileName: string | null;
    rowCount: number;
    errorMessage: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    previewDocumentId: string | null;
    canPreview: boolean;
  }>;
  closedRows: Array<{ label: string; value: number }>;
  cards: Array<{ label: string; value: number }>;
  derivedTargetGroups: Record<
    string,
    Array<{
      title: string;
      total: number;
      accounts: Array<{
        code: string;
        reducedCode: string | null;
        name: string;
      }>;
    }>
  >;
  stale: boolean;
  snapshotStatus: string;
  mappingVersion: number;
  computedAt: string;
};

type ImportResponse = {
  imported: number;
  year: number;
  month?: number;
  valuesMode: string;
  status?: "processing" | "ready";
  batchId?: string | null;
  jobId?: string | null;
};

type ImportBatchStatus = {
  status: "processing" | "ready" | "failed";
  errorMessage?: string | null;
};

type BalancetePreviewResponse = {
  fileName: string;
  displayName: string;
  source: "file" | "fallback";
  rows: Array<{
    conta: string;
    classificacao: string;
    nomeContaContabil: string;
    saldoAnterior: string;
    debito: string;
    credito: string;
    saldoAtual: string;
  }>;
};

const tabs: Array<{ id: ViewMode; label: string; icon: typeof List }> = [
  { id: "calculo", label: "Calculo", icon: List },
  { id: "balancete", label: "Lista de balancete", icon: Landmark },
  { id: "graficos", label: "Graficos", icon: BarChart3 },
  { id: "fechado", label: "Fechado", icon: FileDown },
];

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CARD_TONES = [
  { stroke: "#1fc8ff", fill: "rgba(31,200,255,0.16)" },
  { stroke: "#ff2d6f", fill: "rgba(255,45,111,0.16)" },
  { stroke: "#f59e0b", fill: "rgba(245,158,11,0.16)" },
  { stroke: "#2f76ff", fill: "rgba(47,118,255,0.16)" },
  { stroke: "#10b981", fill: "rgba(16,185,129,0.16)" },
  { stroke: "#a855f7", fill: "rgba(168,85,247,0.16)" },
];
const EMPTY_ROWS: DfcRow[] = [];
const EMPTY_CARDS: Array<{ label: string; value: number }> = [];
const EMPTY_BALANCETE_UPLOADS: DfcResponse["balanceteUploads"] = [];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMappedAccountLabel(account: {
  code: string;
  reducedCode: string | null;
  name: string;
}) {
  return account.reducedCode
    ? `${account.reducedCode} - ${account.name}`
    : `${account.code} - ${account.name}`;
}

function toSeriesData(labels: string[], values: number[]) {
  return labels.map((label, index) => ({
    month: label,
    value: values[index] ?? 0,
  }));
}

function ChartCard({
  label,
  value,
  data,
  stroke,
  fill,
}: {
  label: string;
  value: number;
  data: Array<{ month: string; value: number }>;
  stroke: string;
  fill: string;
}) {
  return (
    <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">
            {formatCurrency(value)}
          </p>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <Landmark className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
            <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(8, 17, 31, 0.96)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                color: "#e2e8f0",
              }}
              formatter={(current: number | string) => formatCurrency(Number(current) || 0)}
            />
            <Area type="monotone" dataKey="value" stroke={stroke} fill={fill} strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DfcPageContent() {
  const searchParams = useSearchParams();
  const initialYearFromQuery = searchParams.get("year");
  const [view, setView] = useState<ViewMode>("calculo");
  const [month, setMonth] = useState("Jan");
  const [uploadMonth, setUploadMonth] = useState("Jan");
  const [year, setYear] = useState(
    initialYearFromQuery && /^\d{4}$/.test(initialYearFromQuery)
      ? initialYearFromQuery
      : String(new Date().getFullYear())
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [data, setData] = useState<DfcResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewMonthLabel, setPreviewMonthLabel] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<BalancetePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deletingMonth, setDeletingMonth] = useState<number | null>(null);
  const [expandedDerivedTargets, setExpandedDerivedTargets] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => String(currentYear - 3 + index));
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const monthIndex = MONTHS.indexOf(month) + 1;
      const response = await fetch(`/api/dfc/summary?year=${year}&month=${monthIndex}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Nao foi possivel carregar o DFC");
      }

      const payload = (await response.json()) as DfcResponse;
      setData(payload);
      setYear(String(payload.year));
      setMonth(payload.monthLabels[payload.activeMonthIndex] ?? month);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o DFC");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const waitForBatch = useCallback(async (batchId: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));

      const response = await fetch(`/api/import-batches/${batchId}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel acompanhar a importacao do DFC");
      }

      const payload = (await response.json()) as ImportBatchStatus;
      if (payload.status === "ready") {
        return;
      }

      if (payload.status === "failed") {
        throw new Error(payload.errorMessage || "A importacao do DFC falhou");
      }
    }

    throw new Error("A importacao ainda esta processando. Tente novamente em instantes.");
  }, []);

  const monthLabels = data?.monthLabels ?? MONTHS;
  const listRows = data?.rows ?? EMPTY_ROWS;
  const balanceteUploads = data?.balanceteUploads ?? EMPTY_BALANCETE_UPLOADS;
  const cards = data?.cards ?? EMPTY_CARDS;
  const closedRows = data?.closedRows ?? EMPTY_CARDS;
  const derivedTargetGroups = data?.derivedTargetGroups ?? {};

  const chartCards = useMemo(() => {
    return cards.map((card, index) => {
      const matchingRow = listRows.find((row) => row.label === card.label);
      return {
        ...card,
        data: toSeriesData(monthLabels, matchingRow?.monthly ?? Array.from({ length: 12 }, () => 0)),
        ...CARD_TONES[index % CARD_TONES.length],
      };
    });
  }, [cards, listRows, monthLabels]);

  const sectionCards = useMemo(() => {
    const subtotalRows = listRows.filter((row) => row.kind === "subtotal");
    return subtotalRows.map((row) => ({
      label: row.label,
      value: row.monthly[data?.activeMonthIndex ?? 0] ?? 0,
    }));
  }, [data?.activeMonthIndex, listRows]);

  const summaryCards = useMemo(() => {
    return [
      cards.find((card) => card.label === "Resultado Contabil"),
      cards.find((card) => card.label === "Resultado Operacional"),
      cards.find((card) => card.label === "Saldo Final Disponivel"),
    ].filter(Boolean) as Array<{ label: string; value: number }>;
  }, [cards]);

  const toggleDerivedTarget = useCallback((label: string) => {
    setExpandedDerivedTargets((current) => ({
      ...current,
      [label]: !current[label],
    }));
  }, []);

  async function handleOpenQuickPreview(item: DfcResponse["balanceteUploads"][number]) {
    setPreviewMonthLabel(item.label);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(true);

    try {
      const response = await fetch(`/api/dfc/balancete-preview?year=${year}&month=${item.month}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Nao foi possivel carregar o balancete.");
      }

      const payload = (await response.json()) as BalancetePreviewResponse;
      setPreviewData(payload);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Nao foi possivel carregar o balancete.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleCloseQuickPreview() {
    setPreviewMonthLabel(null);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }

  async function handleDeleteBalancete(item: DfcResponse["balanceteUploads"][number]) {
    const confirmed = window.confirm(
      `Excluir o balancete de ${item.label}/${year}? Isso remove a importacao deste mes e recalcula o DFC.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingMonth(item.month);
    setUploadMessage(null);

    try {
      const response = await fetch(`/api/client/dfc/import?year=${year}&month=${item.month}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Nao foi possivel excluir o balancete.");
      }

      handleCloseQuickPreview();
      setUploadMessage(`Balancete de ${item.label}/${year} excluido com sucesso.`);
      await loadSummary();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Nao foi possivel excluir o balancete.");
    } finally {
      setDeletingMonth(null);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      window.alert("Selecione um arquivo CSV do balancete ou uma planilha Excel para enviar.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      formData.set("year", year);
      formData.set("month", String(MONTHS.indexOf(uploadMonth) + 1));

      const payload = await uploadFormDataWithProgress<ImportResponse>(
        "/api/client/dfc/import",
        formData,
        setUploadProgress
      );

      setUploadMessage(
        `${payload.imported} linha(s) importadas para ${MONTHS[(payload.month ?? MONTHS.indexOf(uploadMonth) + 1) - 1]}/${payload.year}.`
      );
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (payload.status === "processing" && payload.batchId) {
        setUploadMessage(
          `${payload.imported} linha(s) importadas para ${MONTHS[(payload.month ?? MONTHS.indexOf(uploadMonth) + 1) - 1]}/${payload.year}. Processando DFC...`
        );
        await waitForBatch(payload.batchId);
        setUploadMessage(
          `${payload.imported} linha(s) importadas para ${MONTHS[(payload.month ?? MONTHS.indexOf(uploadMonth) + 1) - 1]}/${payload.year}. DFC atualizado com sucesso.`
        );
      }
      await loadSummary();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Falha ao importar o DFC");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400">
              Balancetes mensais
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Arquivo por mes e ano
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Envie um CSV de balancete por mes. O saldo atual da planilha alimenta apenas o mes escolhido.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-[300px_150px_120px_auto]">
            <div>
              <p className="mb-2 text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-500">
                Planilha
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setSelectedFile(nextFile);
                  setUploadMessage(null);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-white/10"
              >
                <span className="truncate">
                  {selectedFile?.name ?? "Selecionar CSV de balancete"}
                </span>
                <FileUp className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            <div>
              <p className="mb-2 text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-500">
                Mes
              </p>
              <select
                value={uploadMonth}
                onChange={(event) => setUploadMonth(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/30"
              >
                {MONTHS.map((item) => (
                  <option key={item} value={item} className="bg-slate-900">
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-500">
                Ano
              </p>
              <select
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                  setUploadMessage(null);
                }}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/30"
              >
                {availableYears.map((item) => (
                  <option key={item} value={item} className="bg-slate-900">
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)]"
            >
              {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {uploading ? "Enviando..." : "Enviar CSV"}
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {uploadProgress !== null && (
            <div className="rounded-[1.5rem] border border-cyan-400/15 bg-cyan-500/8 px-5 py-4">
              <div className="flex items-center justify-between gap-3 text-sm text-cyan-200">
                <span>Progresso do upload</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#19b6ff_0%,#0b63ff_100%)] transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadMessage && (
            <div className="rounded-[1.5rem] border border-emerald-400/15 bg-emerald-500/8 px-5 py-4 text-sm text-emerald-200">
              {uploadMessage}
            </div>
          )}

          <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/10 px-6 py-6 text-sm text-slate-400">
            {selectedFile
              ? `Arquivo selecionado para ${uploadMonth}/${year}: ${selectedFile.name}`
              : "Selecione um CSV do balancete mensal ou uma planilha Excel e vincule ao mes desejado."}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
              DFC
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">Fluxo de Caixa Indireto</h2>
            {data && (
              <p className="mt-1 text-sm text-slate-400">
                {data.stale ? "Snapshot desatualizado" : "Snapshot pronto"} • versao {data.mappingVersion}
              </p>
            )}
          </div>

          <div className="flex rounded-2xl border border-white/6 bg-black/20 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = view === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setView(tab.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                    active
                      ? "bg-slate-800 text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
                      : "text-slate-500 hover:text-slate-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

        </div>

        {loading && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-300">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando DFC...
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {data?.warnings.length ? (
          <div className="mt-4 space-y-2">
            {data.warnings.map((warning) => (
              <div
                key={warning}
                className="flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {view === "calculo" && (
        <section className="overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="overflow-x-auto">
            <div className="min-w-[1600px]">
              <div className="grid grid-cols-[340px_repeat(12,minmax(78px,1fr))_120px_90px] border-b border-white/8 bg-white/4 px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.25em] text-slate-400">
                <div>Linha</div>
                {monthLabels.map((item) => (
                  <div key={item} className="text-center">
                    {item.toUpperCase()}
                  </div>
                ))}
                <div className="text-center">Acum.</div>
                <div className="text-center">%</div>
              </div>

              <div className="divide-y divide-white/6">
                {listRows.map((row) => (
                  <div key={row.key}>
                    <div
                      className={cn(
                        "grid grid-cols-[340px_repeat(12,minmax(78px,1fr))_120px_90px] items-center px-4 py-4 text-sm",
                        row.kind === "section" ? "bg-white/2" : row.kind === "subtotal" ? "bg-cyan-500/8" : "bg-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn("h-2.5 w-2.5 rounded-full", row.kind === "section" || row.kind === "subtotal" ? "bg-cyan-400" : "bg-slate-500")} />
                        <span
                          className={cn(
                            "font-semibold leading-snug",
                            row.level === 0 ? "text-white" : "text-slate-400"
                          )}
                        >
                          {row.label}
                        </span>
                      </div>

                      {monthLabels.map((item, index) => (
                        <div
                          key={`${row.key}-${item}`}
                          className={cn(
                            "text-center font-bold",
                            row.kind === "subtotal" ? "text-cyan-300" : row.level === 0 ? "text-slate-200" : "text-slate-500"
                          )}
                        >
                          {new Intl.NumberFormat("pt-BR").format(row.monthly[index] ?? 0)}
                        </div>
                      ))}

                      <div className={cn("text-right font-black", row.kind === "subtotal" ? "text-cyan-300" : "text-white")}>
                        {new Intl.NumberFormat("pt-BR").format(row.accumulated)}
                      </div>
                      <div className="text-right font-black text-cyan-300">
                        {row.percent ? `${row.percent.toFixed(1)}%` : "0%"}
                      </div>
                    </div>

                    {(row.label === "Variacao Ativo" || row.label === "Variacao Passivo") &&
                    (derivedTargetGroups[row.label]?.length ?? 0) > 0 ? (
                      <div className="border-t border-white/6 bg-[#0b1525]/85 px-6 py-5">
                        <button
                          type="button"
                          onClick={() => toggleDerivedTarget(row.label)}
                          className="flex w-full items-center justify-between gap-4 rounded-[1.1rem] border border-white/8 bg-[#0f1a2b] px-4 py-3 text-left transition hover:border-cyan-400/25 hover:bg-[#12203a]"
                        >
                          <div className="flex items-center gap-3">
                            {expandedDerivedTargets[row.label] ? (
                              <ChevronDown className="h-4 w-4 text-cyan-300" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-cyan-300" />
                            )}
                            <div>
                              <div className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-cyan-300">
                                Contas vinculadas
                              </div>
                              <div className="mt-1 text-sm text-slate-300">
                                Clique para {expandedDerivedTargets[row.label] ? "fechar" : "abrir"} a visualizacao de {row.label.toLowerCase()}.
                              </div>
                            </div>
                          </div>
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-cyan-200">
                            {derivedTargetGroups[row.label]?.reduce((total, group) => total + group.total, 0) ?? 0} conta(s)
                          </span>
                        </button>

                        {expandedDerivedTargets[row.label] ? (
                          <div className="mt-4 grid gap-4">
                            {derivedTargetGroups[row.label]?.map((group) => (
                              <div
                                key={`${row.key}-${group.title}`}
                                className="rounded-[1.1rem] border border-white/8 bg-[#0f1a2b] px-4 py-4"
                              >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-cyan-300">
                                    {group.title}
                                  </div>
                                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-cyan-200">
                                    {group.total} conta(s)
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {group.accounts.map((account) => (
                                    <div
                                      key={`${group.title}-${account.code}-${account.name}`}
                                      className="rounded-2xl border border-white/8 bg-[#101d31] px-4 py-3 text-sm text-slate-100"
                                    >
                                      {formatMappedAccountLabel(account)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {view === "balancete" && (
        <section className="overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {balanceteUploads.map((item) => (
              <div
                key={`balancete-upload-${item.month}`}
                className={cn(
                  "rounded-[1.6rem] border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]",
                  item.status === "ready"
                    ? "border-emerald-400/20 bg-[linear-gradient(180deg,rgba(8,34,28,0.96),rgba(9,24,22,0.92))]"
                    : item.status === "processing"
                      ? "border-cyan-400/20 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))]"
                      : item.status === "failed"
                        ? "border-rose-400/20 bg-[linear-gradient(180deg,rgba(45,18,27,0.96),rgba(32,16,22,0.92))]"
                        : "border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                      Mes
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-white">{item.label}</h3>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.22em]",
                      item.status === "ready"
                        ? "border border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                        : item.status === "processing"
                          ? "border border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
                          : item.status === "failed"
                            ? "border border-rose-400/20 bg-rose-500/10 text-rose-200"
                            : "border border-white/8 bg-white/4 text-slate-400"
                    )}
                  >
                    {item.status === "ready"
                      ? "Importado"
                      : item.status === "processing"
                        ? "Processando"
                        : item.status === "failed"
                          ? "Falhou"
                          : "Pendente"}
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3 text-slate-300">
                    {item.fileName ?? "Nenhum arquivo enviado para este mes."}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                      <div className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-slate-500">
                        Linhas
                      </div>
                      <div className="mt-2 text-lg font-black text-white">{item.rowCount}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                      <div className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-slate-500">
                        Atualizado
                      </div>
                      <div className="mt-2 text-sm font-bold text-white">
                        {item.finishedAt || item.startedAt
                          ? new Date(item.finishedAt ?? item.startedAt ?? "").toLocaleString("pt-BR")
                          : "-"}
                      </div>
                    </div>
                  </div>
                  {item.errorMessage ? (
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      {item.errorMessage}
                    </div>
                  ) : null}
                  {item.status === "ready" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {item.canPreview ? (
                        <button
                          type="button"
                          onClick={() => void handleOpenQuickPreview(item)}
                          className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/15"
                        >
                          Visualizacao rapida
                        </button>
                      ) : (
                        <div />
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteBalancete(item)}
                        disabled={deletingMonth === item.month}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingMonth === item.month ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Excluir
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === "graficos" && (
        <section className="grid gap-4 md:grid-cols-2">
          {chartCards.map((card) => (
            <ChartCard
              key={card.label}
              label={card.label}
              value={card.value}
              data={card.data}
              stroke={card.stroke}
              fill={card.fill}
            />
          ))}
        </section>
      )}

      {view === "fechado" && (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {closedRows.map((card, index) => (
              <div
                key={card.label}
                className={cn(
                  "rounded-[1.6rem] border border-white/8 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]",
                  index % 2 === 0
                    ? "bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))]"
                    : "bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))]"
                )}
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  {card.label}
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-white">
                  {formatCurrency(card.value)}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-[1.6rem] border border-white/6 bg-white/4 p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-400">
                  Resultado Geracao de Caixa
                </p>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={
                        toSeriesData(
                          monthLabels,
                          listRows.find((row) => row.key === "resultadoGeracaoCaixa")?.monthly ?? Array.from({ length: 12 }, () => 0)
                        )
                      }
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                      <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(8, 17, 31, 0.96)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 16,
                          color: "#e2e8f0",
                        }}
                        formatter={(current: number | string) => formatCurrency(Number(current) || 0)}
                      />
                      <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="rgba(34,211,238,0.16)" strokeWidth={2.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-3">
                {sectionCards.map((section) => (
                  <div key={section.label} className="rounded-2xl border border-white/6 bg-white/4 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                      {section.label}
                    </p>
                    <p className="mt-2 text-2xl font-black text-white">{formatCurrency(section.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {summaryCards.map((card, index) => (
          <div
            key={card.label}
            className={cn(
              "rounded-[1.6rem] border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]",
              index === 0
                ? "border-cyan-500/20 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))]"
                : "border-white/8 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))]"
            )}
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              {card.label}
            </p>
            <p className={cn("mt-3 text-3xl font-black tracking-tight", index === 0 ? "text-cyan-300" : "text-white")}>
              {formatCurrency(card.value)}
            </p>
          </div>
        ))}
      </section>

      {previewMonthLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-2 py-4 backdrop-blur-sm lg:px-4">
          <button
            type="button"
            aria-label="Fechar visualizacao"
            className="absolute inset-0 cursor-default"
            onClick={handleCloseQuickPreview}
          />

          <div className="relative z-10 flex h-[94vh] w-[min(96vw,1500px)] flex-col overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.99),rgba(10,18,32,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300/70">
                  Visualização Rápida
                </p>
                <h3 className="mt-2 text-2xl font-black text-white">
                  Balancete {previewMonthLabel}/{year}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {previewData?.displayName ?? previewData?.fileName ?? "Planilha importada do mes selecionado."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseQuickPreview}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {previewLoading ? (
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-12 text-sm text-slate-300">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Carregando planilha...
                </div>
              ) : previewError ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                  {previewError}
                </div>
              ) : (
                <div className="space-y-4">
                  {previewData?.source === "fallback" ? (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                      O arquivo original deste mes nao foi encontrado. Esta visualizacao mostra apenas os saldos salvos no balancete.
                      Para ver <span className="font-bold">saldo anterior</span>, <span className="font-bold">debito</span> e <span className="font-bold">credito</span>, reimporte a planilha deste mes.
                    </div>
                  ) : null}
                  <div className="overflow-x-auto pb-2">
                    <div className="min-w-[1320px]">
                    <div className="grid grid-cols-[110px_150px_minmax(300px,1.4fr)_minmax(150px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(170px,1fr)] border-b border-white/8 bg-white/4 px-4 py-4 text-[0.7rem] font-black uppercase tracking-[0.22em] text-slate-400">
                      <div>CONTA</div>
                      <div>CLASSIFICAÇÃO</div>
                      <div>NOME DA CONTA CONTÁBIL</div>
                      <div>SALDO ANTERIOR</div>
                      <div>DÉBITO</div>
                      <div>CRÉDITO</div>
                      <div>SALDO ATUAL</div>
                    </div>

                    <div className="divide-y divide-white/6">
                      {previewData?.rows.map((row, index) => (
                        <div
                          key={`${row.classificacao}-${row.conta}-${index}`}
                          className="grid grid-cols-[110px_150px_minmax(300px,1.4fr)_minmax(150px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(170px,1fr)] items-center px-4 py-3 text-sm"
                        >
                          <div className="font-bold text-slate-200">{row.conta || "-"}</div>
                          <div className="text-slate-300">{row.classificacao || "-"}</div>
                          <div className="pr-4 text-slate-100">{row.nomeContaContabil || "-"}</div>
                          <div className="text-right text-slate-300">{row.saldoAnterior || "-"}</div>
                          <div className="text-right text-slate-300">{row.debito || "-"}</div>
                          <div className="text-right text-slate-300">{row.credito || "-"}</div>
                          <div className="text-right font-semibold text-cyan-200">{row.saldoAtual || "-"}</div>
                        </div>
                      ))}

                      {!previewData?.rows.length && (
                        <div className="px-4 py-10 text-center text-sm text-slate-500">
                          Nenhuma linha encontrada no arquivo salvo deste mes.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DfcPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-400 sm:p-6 lg:p-8">Carregando DFC...</div>}>
      <DfcPageContent />
    </Suspense>
  );
}
