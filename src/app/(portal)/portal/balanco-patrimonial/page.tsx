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
  Download,
  FileDown,
  FileUp,
  Landmark,
  List,
  LoaderCircle,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

import { uploadFormDataWithProgress } from "@/lib/upload-request";
import { cn } from "@/lib/utils";

type ViewMode = "lista" | "graficos" | "fechado";

type MetricItem = {
  label: string;
  value: number;
  format: "ratio" | "percent" | "currency" | "days";
};

type PatrimonialApiResponse = {
  year: number;
  monthLabels: string[];
  activeMonthIndex: number;
  activeMonthLabel: string;
  closedRows: Array<{ label: string; value: number }>;
  graphCards: Array<{
    label: string;
    value: number;
    stroke: string;
    fill: string;
    series: number[];
  }>;
  rows: Array<{
    key: string;
    label: string;
    level: number;
    accent: "cyan" | "white" | "muted";
    monthly: number[];
    accumulated: number;
    percent: number | null;
  }>;
  totals: {
    ativoCirculante: number[];
    ativoNaoCirculante: number[];
    passivoCirculante: number[];
    passivoNaoCirculante: number[];
    patrimonioLiquido: number[];
    totalAtivo: number[];
    totalPassivo: number[];
  };
  metrics: {
    liquidity: MetricItem[];
    profitability: MetricItem[];
    activity: MetricItem[];
  };
};

type ImportResponse = {
  imported: number;
  year: number;
  status?: "processing" | "ready";
  batchId?: string | null;
  jobId?: string | null;
};

type ImportBatchStatus = {
  status: "processing" | "ready" | "failed";
  errorMessage?: string | null;
};

const tabs: Array<{ id: ViewMode; label: string; icon: typeof List }> = [
  { id: "lista", label: "Lista", icon: List },
  { id: "graficos", label: "Graficos", icon: TrendingUp },
  { id: "fechado", label: "Fechado", icon: FileDown },
];

const emptyData: PatrimonialApiResponse = {
  year: new Date().getFullYear(),
  monthLabels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
  activeMonthIndex: 0,
  activeMonthLabel: "Jan",
  closedRows: [
    { label: "Total do Ativo", value: 0 },
    { label: "Patrimonio Liquido", value: 0 },
    { label: "Total do Passivo", value: 0 },
  ],
  graphCards: [
    { label: "Ativo Circulante", value: 0, stroke: "#1fc8ff", fill: "rgba(31,200,255,0.16)", series: Array(12).fill(0) },
    { label: "Ativo Nao Circulante", value: 0, stroke: "#2f76ff", fill: "rgba(47,118,255,0.16)", series: Array(12).fill(0) },
    { label: "Total do Ativo", value: 0, stroke: "#22d3ee", fill: "rgba(34,211,238,0.15)", series: Array(12).fill(0) },
    { label: "Passivo Circulante", value: 0, stroke: "#ff2d6f", fill: "rgba(255,45,111,0.16)", series: Array(12).fill(0) },
    { label: "Passivo Nao Circulante", value: 0, stroke: "#f59e0b", fill: "rgba(245,158,11,0.16)", series: Array(12).fill(0) },
    { label: "Patrimonio Liquido", value: 0, stroke: "#10b981", fill: "rgba(16,185,129,0.16)", series: Array(12).fill(0) },
  ],
  rows: [],
  totals: {
    ativoCirculante: Array(12).fill(0),
    ativoNaoCirculante: Array(12).fill(0),
    passivoCirculante: Array(12).fill(0),
    passivoNaoCirculante: Array(12).fill(0),
    patrimonioLiquido: Array(12).fill(0),
    totalAtivo: Array(12).fill(0),
    totalPassivo: Array(12).fill(0),
  },
  metrics: {
    liquidity: [
      { label: "Liquidez Corrente", value: 0, format: "ratio" },
      { label: "Liquidez Imediata", value: 0, format: "ratio" },
      { label: "Liquidez Seca", value: 0, format: "ratio" },
      { label: "Liquidez Geral", value: 0, format: "ratio" },
      { label: "Participacao de Terceiros", value: 0, format: "percent" },
    ],
    profitability: [
      { label: "Margem Liquida (ML)", value: 0, format: "percent" },
      { label: "ROE", value: 0, format: "percent" },
      { label: "ROA", value: 0, format: "percent" },
      { label: "ROIC", value: 0, format: "percent" },
      { label: "Giro do Ativo (GA)", value: 0, format: "ratio" },
      { label: "EBITDA", value: 0, format: "currency" },
    ],
    activity: [
      { label: "Rotacao Estoques (RE)", value: 0, format: "ratio" },
      { label: "Prazo Medio Estoque", value: 0, format: "days" },
      { label: "PMC (Dias)", value: 0, format: "days" },
      { label: "PMP (Dias)", value: 0, format: "days" },
      { label: "Ciclo Financeiro", value: 0, format: "days" },
    ],
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRatio(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatDays(value: number) {
  const rounded = Math.round(value);
  return `${formatNumber(rounded)} dias`;
}

function formatMetric(item: MetricItem) {
  switch (item.format) {
    case "currency":
      return formatCurrency(item.value);
    case "percent":
      return formatPercent(item.value * 100);
    case "days":
      return formatDays(item.value);
    default:
      return formatRatio(item.value);
  }
}

function createChartData(series: number[], labels: string[]) {
  return labels.map((month, index) => ({
    month,
    value: series[index] ?? 0,
  }));
}

function zeroArea({
  series,
  labels,
  stroke,
  fill,
}: {
  series: number[];
  labels: string[];
  stroke: string;
  fill: string;
}) {
  const data = createChartData(series, labels);

  return (
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
          formatter={(value) => [formatNumber(Number(value)), "Valor"]}
        />
        <Area type="monotone" dataKey="value" stroke={stroke} fill={fill} strokeWidth={2.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function accentColor(accent: string) {
  switch (accent) {
    case "cyan":
      return "text-cyan-300";
    case "white":
      return "text-white";
    default:
      return "text-slate-500";
  }
}

function BalancoPatrimonialPageContent() {
  const searchParams = useSearchParams();
  const initialYearFromQuery = searchParams.get("year");
  const [view, setView] = useState<ViewMode>("fechado");
  const [data, setData] = useState<PatrimonialApiResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(
    initialYearFromQuery && /^\d{4}$/.test(initialYearFromQuery)
      ? initialYearFromQuery
      : String(new Date().getFullYear())
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => String(currentYear - 3 + index));
  }, []);

  const loadPatrimonial = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        const response = await fetch(`/api/patrimonial/summary?year=${year}`, {
          signal,
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Falha ao carregar o patrimonio");
        }
        const payload = (await response.json()) as PatrimonialApiResponse;
        setData(payload);
        setYear(String(payload.year));
      } catch {
        setData({
          ...emptyData,
          year: Number(year),
        });
      } finally {
        setLoading(false);
      }
    },
    [year]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadPatrimonial(controller.signal);
    return () => controller.abort();
  }, [loadPatrimonial]);

  const waitForBatch = useCallback(async (batchId: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));

      const response = await fetch(`/api/import-batches/${batchId}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel acompanhar a importacao do Patrimonial");
      }

      const payload = (await response.json()) as ImportBatchStatus;
      if (payload.status === "ready") {
        return;
      }

      if (payload.status === "failed") {
        throw new Error(payload.errorMessage || "A importacao do Patrimonial falhou");
      }
    }

    throw new Error("A importacao ainda esta processando. Tente novamente em instantes.");
  }, []);

  async function handleUpload() {
    if (!selectedFile) {
      window.alert("Selecione um arquivo CSV ou uma planilha Excel para enviar.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      formData.set("year", year);

      const payload = await uploadFormDataWithProgress<ImportResponse>(
        "/api/client/patrimonial/import",
        formData,
        setUploadProgress
      );

      setUploadMessage(
        `${payload.imported} linha(s) importadas para ${payload.year}${
          payload.status === "processing" ? ". Processando demonstrativos..." : "."
        }`
      );
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setYear(String(payload.year));
      if (payload.status === "processing" && payload.batchId) {
        await waitForBatch(payload.batchId);
        setUploadMessage(
          `${payload.imported} linha(s) importadas para ${payload.year}. Patrimonial atualizado com sucesso.`
        );
      }
      await loadPatrimonial();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Falha ao importar o Patrimonial");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  const columns = useMemo(() => data.monthLabels, [data.monthLabels]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Balanco Patrimonial
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Resultado Consolidado - {data.activeMonthLabel} de {year}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
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
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/30"
              >
                {availableYears.map((item) => (
                  <option key={item} value={item} className="bg-slate-900">
                    {item}
                  </option>
                ))}
              </select>
            </div>

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
              onClick={() => {
                if (selectedFile) {
                  void handleUpload();
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {uploading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : selectedFile ? (
                <UploadCloud className="h-4 w-4" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {uploading
                ? "Enviando..."
                : selectedFile
                  ? `Importar CSV patrimonial ${year}`
                  : `Selecionar CSV patrimonial ${year}`}
            </button>

            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {(selectedFile || uploadProgress !== null || uploadMessage) && (
          <div className="mt-5 space-y-3">
            {selectedFile && (
              <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] px-5 py-4 text-sm text-slate-300">
                Arquivo selecionado:{" "}
                <span className="font-semibold text-white">{selectedFile.name}</span> • Ano{" "}
                {year}
              </div>
            )}

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
          </div>
        )}
      </section>

      {view === "fechado" && (
        <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
          <div className="space-y-3">
            {data.closedRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/4 px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                  <span className="text-sm font-bold uppercase tracking-[0.02em] text-white">
                    {row.label}
                  </span>
                </div>
                <div className="text-sm font-black tracking-tight text-cyan-300">
                  {formatCurrency(row.value)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-white/6 pt-6">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
              Indicadores
            </p>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-500">
                  Liquidez
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.metrics.liquidity.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/6 bg-white/4 p-4">
                      <p className="text-xs font-black uppercase text-slate-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-black text-white">{formatMetric(item)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-500">
                  Rentabilidade
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.metrics.profitability.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/6 bg-white/4 p-4">
                      <p className="text-xs font-black uppercase text-slate-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-black text-white">{formatMetric(item)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-500">
                  Atividade / Prazos
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.metrics.activity.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/6 bg-white/4 p-4">
                      <p className="text-xs font-black uppercase text-slate-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-black text-white">{formatMetric(item)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {view === "graficos" && (
        <section className="grid gap-4 md:grid-cols-2">
          {data.graphCards.map((card) => (
            <div
              key={card.label}
              className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-white">
                    {formatCurrency(card.value)}
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
                {zeroArea({
                  labels: data.monthLabels,
                  series: card.series,
                  stroke: card.stroke,
                  fill: card.fill,
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {view === "lista" && (
        <section className="overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
          <div className="overflow-x-auto">
            <div className="min-w-[1500px]">
              <div className="grid grid-cols-[260px_repeat(12,minmax(70px,1fr))_120px_90px] border-b border-white/8 bg-white/4 px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.25em] text-slate-400">
                <div>Grupo</div>
                {columns.map((month) => (
                  <div key={month} className="text-center">
                    {month.toUpperCase()}
                  </div>
                ))}
                <div className="text-center">Acum.</div>
                <div className="text-center">%</div>
              </div>

              <div className="divide-y divide-white/6">
                {data.rows.map((row) => (
                  <div
                    key={row.key}
                    className={cn(
                      "grid grid-cols-[260px_repeat(12,minmax(70px,1fr))_120px_90px] items-center px-4 py-4 text-sm",
                      row.level === 0 ? "bg-white/2" : "bg-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {row.level === 0 && <span className={cn("text-lg", accentColor(row.accent))}>•</span>}
                      {row.level > 0 && <span className="ml-6 text-slate-500">•</span>}
                      <span
                        className={cn(
                          "font-semibold",
                          row.level === 0 ? "text-white" : "text-slate-400"
                        )}
                      >
                        {row.label}
                      </span>
                    </div>

                    {row.monthly.map((value, index) => (
                      <div
                        key={`${row.key}-${columns[index]}`}
                        className={cn(
                          "text-center font-bold",
                          row.level === 0 ? "text-slate-200" : "text-slate-500"
                        )}
                      >
                        {formatNumber(value)}
                      </div>
                    ))}

                    <div className="text-right font-black text-white">
                      {formatNumber(row.accumulated)}
                    </div>
                    <div className="text-right font-black text-cyan-300">
                      {row.percent === null ? "-" : `${formatPercent(row.percent)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {data.closedRows.map((row) => (
          <div
            key={row.label}
            className="rounded-[1.6rem] border border-cyan-500/20 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">
              {row.label}
            </p>
            <p className="mt-3 text-3xl font-black tracking-tight text-cyan-300">
              {formatCurrency(row.value)}
            </p>
          </div>
        ))}
      </section>

      {loading && (
        <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-400">
          Carregando balanco patrimonial...
        </div>
      )}
    </div>
  );
}

export default function BalancoPatrimonialPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-slate-400 sm:p-6 lg:p-8">
          Carregando balanco patrimonial...
        </div>
      }
    >
      <BalancoPatrimonialPageContent />
    </Suspense>
  );
}
