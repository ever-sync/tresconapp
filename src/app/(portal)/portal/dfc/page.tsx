"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Download,
  FileDown,
  FileUp,
  Landmark,
  List,
  LoaderCircle,
  UploadCloud,
} from "lucide-react";

import { uploadFormDataWithProgress } from "@/lib/upload-request";
import { cn } from "@/lib/utils";

type ViewMode = "lista" | "graficos" | "fechado";

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
  closedRows: Array<{ label: string; value: number }>;
  cards: Array<{ label: string; value: number }>;
  stale: boolean;
  snapshotStatus: string;
  mappingVersion: number;
  computedAt: string;
};

const tabs: Array<{ id: ViewMode; label: string; icon: typeof List }> = [
  { id: "lista", label: "Lista", icon: List },
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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

export default function DfcPage() {
  const [view, setView] = useState<ViewMode>("lista");
  const [month, setMonth] = useState("Jan");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [valuesMode, setValuesMode] = useState<"monthly" | "accumulated">("monthly");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [data, setData] = useState<DfcResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const monthLabels = data?.monthLabels ?? MONTHS;
  const listRows = data?.rows ?? EMPTY_ROWS;
  const cards = data?.cards ?? EMPTY_CARDS;
  const closedRows = data?.closedRows ?? EMPTY_CARDS;

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

  async function handleUpload() {
    if (!selectedFile) {
      window.alert("Selecione uma planilha XLSX para enviar.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      formData.set("year", year);
      formData.set("valuesMode", valuesMode);

      const payload = await uploadFormDataWithProgress<{
        imported: number;
        year: number;
        valuesMode: string;
      }>("/api/client/dfc/import", formData, setUploadProgress);

      setUploadMessage(
        `${payload.imported} linha(s) importadas para ${payload.year} em modo ${payload.valuesMode === "accumulated" ? "acumulado" : "mensal"}.`
      );
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
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
              Cada envio vira um card. O historico nao sobrescreve o mes anterior.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-[300px_150px_150px_120px_auto]">
            <div>
              <p className="mb-2 text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-500">
                Planilha
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
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
                  {selectedFile?.name ?? "Selecionar planilha XLSX"}
                </span>
                <FileUp className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            <div>
              <p className="mb-2 text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-500">
                Mes
              </p>
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
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
                Modo
              </p>
              <select
                value={valuesMode}
                onChange={(event) => setValuesMode(event.target.value === "accumulated" ? "accumulated" : "monthly")}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/30"
              >
                <option value="monthly" className="bg-slate-900">
                  Mensal
                </option>
                <option value="accumulated" className="bg-slate-900">
                  Acumulado
                </option>
              </select>
            </div>

            <div>
              <p className="mb-2 text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-500">
                Ano
              </p>
              <input
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/30"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)]"
            >
              {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {uploading ? "Enviando..." : "Enviar"}
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
              ? `Arquivo selecionado: ${selectedFile.name}`
              : "Selecione uma planilha XLSX e envie para atualizar o DFC deste cliente."}
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

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)]"
          >
            <UploadCloud className="h-4 w-4" />
            Importar DFC {year}
          </button>

          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Download className="h-4 w-4" />
          </button>
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

      {view === "lista" && (
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
                  <div
                    key={row.key}
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
                ))}
              </div>
            </div>
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
    </div>
  );
}
