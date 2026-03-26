"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  FileDown,
  List,
  UploadCloud,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MONTH_LABELS } from "@/lib/dre-statement";
import { cn } from "@/lib/utils";

type ViewMode = "lista" | "graficos" | "fechado";

type DreApiResponse = {
  year: number;
  monthLabels: string[];
  activeMonthIndex: number;
  rows: Array<{
    key: string;
    label: string;
    level: number;
    accent: "cyan" | "pink" | "orange" | "emerald";
    monthly: number[];
    accumulated: number;
    percent: number;
  }>;
  summaryRows: Array<{ label: string; percent: number; value: number }>;
  cards: {
    receitaBruta: number;
    custosDespesas: number;
    resultadoLiquido: number;
    irpjCsll: number;
  };
  lines: Record<string, number[]>;
  chart: {
    custoVenda: number;
    impostos: number;
    despesas: number;
    lucro: number;
  };
};

const tabs: Array<{ id: ViewMode; label: string; icon: typeof List }> = [
  { id: "lista", label: "Lista", icon: List },
  { id: "graficos", label: "Gráficos", icon: BarChart3 },
  { id: "fechado", label: "Fechado", icon: FileDown },
];

const zeroResponse: DreApiResponse = {
  year: new Date().getFullYear(),
  monthLabels: MONTH_LABELS,
  activeMonthIndex: 0,
  rows: [],
  summaryRows: [],
  cards: {
    receitaBruta: 0,
    custosDespesas: 0,
    resultadoLiquido: 0,
    irpjCsll: 0,
  },
  lines: {},
  chart: {
    custoVenda: 0,
    impostos: 0,
    despesas: 0,
    lucro: 0,
  },
};

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function accentClasses(accent: string) {
  switch (accent) {
    case "pink":
      return "text-pink-400";
    case "orange":
      return "text-orange-400";
    case "emerald":
      return "text-emerald-400";
    default:
      return "text-cyan-300";
  }
}

function zeroSeries() {
  return MONTH_LABELS.map((month) => ({ month, value: 0 }));
}

function StatementSparkline({
  values,
  stroke,
  fill,
}: {
  values: number[];
  stroke: string;
  fill: string;
}) {
  const chartData = useMemo(
    () =>
      MONTH_LABELS.map((month, index) => ({
        month,
        value: values[index] ?? 0,
      })),
    [values]
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
        <XAxis dataKey="month" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            background: "rgba(8, 17, 31, 0.96)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            color: "#e2e8f0",
          }}
          formatter={(value) => currency(Number(value))}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          fill={fill}
          strokeWidth={2.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function DrePage() {
  const [view, setView] = useState<ViewMode>("fechado");
  const [data, setData] = useState<DreApiResponse>(zeroResponse);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const response = await fetch("/api/dre/summary", {
          signal: controller.signal,
          credentials: "include",
        });

        if (!response.ok) {
          setData(zeroResponse);
          return;
        }

        const json = (await response.json()) as DreApiResponse;
        setData({
          ...zeroResponse,
          ...json,
          monthLabels: json.monthLabels?.length ? json.monthLabels : MONTH_LABELS,
        });
      } catch {
        setData(zeroResponse);
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => controller.abort();
  }, []);

  const activeMonthLabel = data.monthLabels[data.activeMonthIndex] ?? "Jan";
  const chartCards = useMemo(
    () => [
      {
        label: "Receita Bruta",
        value: data.cards.receitaBruta,
        stroke: "#1fc8ff",
        fill: "rgba(31,200,255,0.16)",
        series: data.lines.receitaBruta ?? zeroSeries().map(() => 0),
      },
      {
        label: "Deduções",
        value: data.lines.deducoes?.[data.activeMonthIndex] ?? 0,
        stroke: "#ff2d6f",
        fill: "rgba(255,45,111,0.18)",
        series: data.lines.deducoes ?? zeroSeries().map(() => 0),
      },
      {
        label: "Receita Líquida",
        value: data.lines.receitaLiquida?.[data.activeMonthIndex] ?? 0,
        stroke: "#2f76ff",
        fill: "rgba(47,118,255,0.16)",
        series: data.lines.receitaLiquida ?? zeroSeries().map(() => 0),
      },
      {
        label: "Custos das Vendas",
        value: data.lines.custosVendas?.[data.activeMonthIndex] ?? 0,
        stroke: "#ff9c1a",
        fill: "rgba(255,156,26,0.16)",
        series: data.lines.custosVendas ?? zeroSeries().map(() => 0),
      },
      {
        label: "Custos dos Serviços",
        value: data.lines.custosServicos?.[data.activeMonthIndex] ?? 0,
        stroke: "#ff7a00",
        fill: "rgba(255,122,0,0.18)",
        series: data.lines.custosServicos ?? zeroSeries().map(() => 0),
      },
      {
        label: "Lucro Operacional",
        value: data.lines.lucroOperacional?.[data.activeMonthIndex] ?? 0,
        stroke: "#3d7bff",
        fill: "rgba(61,123,255,0.18)",
        series: data.lines.lucroOperacional ?? zeroSeries().map(() => 0),
      },
    ],
    [data.activeMonthIndex, data.cards.receitaBruta, data.lines]
  );

  const summaryRows = data.summaryRows.length
    ? data.summaryRows
    : [
        { label: "Receita Bruta", percent: 0, value: 0 },
        { label: "Receita Líquida", percent: 0, value: 0 },
        { label: "Lucro Operacional", percent: 0, value: 0 },
        { label: "Lucro Antes do IRPJ e CSLL", percent: 0, value: 0 },
        { label: "Lucro/Prejuízo Líquido", percent: 0, value: 0 },
        { label: "Resultado EBITDA", percent: 0, value: 0 },
      ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Relatório Gerencial DRE
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Resultado Consolidado · {activeMonthLabel} {loading ? "(carregando...)" : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)]"
            >
              <UploadCloud className="h-4 w-4" />
              Importar Balancete 2026
            </button>

            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {view === "fechado" && (
        <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
          <div className="space-y-3">
            {summaryRows.map((row) => (
              <div
                key={row.label}
                className={cn(
                  "grid grid-cols-[minmax(220px,1fr)_72px_90px] items-center gap-4 rounded-2xl border border-white/6 px-4 py-4",
                  row.label === "Lucro/Prejuízo Líquido" || row.label === "Resultado EBITDA"
                    ? "border-cyan-500/25 bg-cyan-500/8"
                    : "bg-white/4"
                )}
              >
                <div className={cn("flex items-center gap-3 text-sm font-bold", accentClasses("cyan"))}>
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                  <span className="text-white">{row.label}</span>
                </div>
                <div className="text-right text-xs font-semibold text-slate-500">
                  {percent(row.percent)}
                </div>
                <div className="text-right text-sm font-black tracking-tight text-white">
                  {currency(row.value)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === "graficos" && (
        <section className="grid gap-4 md:grid-cols-2">
          {chartCards.map((card) => (
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
                    {currency(card.value)}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 h-[140px]">
                <StatementSparkline
                  values={card.series}
                  stroke={card.stroke}
                  fill={card.fill}
                />
              </div>
            </div>
          ))}
        </section>
      )}

      {view === "lista" && (
        <section className="overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
          <div className="grid grid-cols-[260px_repeat(12,minmax(48px,1fr))_120px_90px] border-b border-white/8 bg-white/4 px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.25em] text-slate-400">
            <div>Indicador</div>
            {data.monthLabels.map((m) => (
              <div key={m} className="text-center">
                {m.toUpperCase()}
              </div>
            ))}
            <div className="text-center">Acumulado</div>
            <div className="text-center">%</div>
          </div>

          <div className="divide-y divide-white/6">
            {data.rows.map((row) => (
              <div
                key={row.key}
                className={cn(
                  "grid grid-cols-[260px_repeat(12,minmax(48px,1fr))_120px_90px] items-center px-4 py-4 text-sm",
                  row.level === 0 ? "bg-white/2" : "bg-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("text-lg", accentClasses(row.accent))}>•</span>
                  <span
                    className={cn(
                      "font-semibold",
                      row.level === 0 ? "text-white" : "text-slate-300"
                    )}
                  >
                    {row.label}
                  </span>
                </div>

                {row.monthly.map((value, index) => (
                  <div
                    key={`${row.key}-${data.monthLabels[index]}`}
                    className={cn(
                      "text-center font-bold",
                      row.level === 0 ? "text-slate-200" : "text-rose-400"
                    )}
                  >
                    {compactNumber(value)}
                  </div>
                ))}

                <div className={cn("text-right font-black text-white")}>
                  {compactNumber(row.accumulated)}
                </div>
                <div className="text-right font-black text-cyan-300">
                  {percent(row.percent)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
