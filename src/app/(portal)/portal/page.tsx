"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Filter, FileDown, UploadCloud } from "lucide-react";

import { useClientAuthStore } from "@/stores/useClientAuthStore";
import { usePortalClient } from "@/components/portal-client-provider";
import { cn } from "@/lib/utils";

const tabs = ["INÍCIO", "Financeiro", "Contábil", "Fiscal", "Serviços"];

const monthLabels = [
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

const zeroSeries = monthLabels.map((month) => ({
  month,
  receita: 0,
  despesa: 0,
  margemBruta: 0,
  margemLiquida: 0,
  margemEbitda: 0,
}));

const emptyPieData = [
  { name: "Custo de Venda", value: 0, color: "#f59e0b" },
  { name: "Desp. Operac.", value: 0, color: "#a855f7" },
  { name: "Impostos", value: 0, color: "#ef4444" },
  { name: "Lucro", value: 0, color: "#10b981" },
];

const reports = [
  { title: "Balanço Patrimonial", period: "DEZEMBRO 2025" },
  { title: "DRE Consolidado", period: "NOVEMBRO 2025" },
  { title: "Demonstrativo de Fluxo", period: "OUTUBRO 2025" },
  { title: "Relatório de Impostos", period: "SETEMBRO 2025" },
];

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function ratioPercent(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return (Math.abs(numerator) / Math.abs(denominator)) * 100;
}

type DreDashboardSummary = {
  monthLabels: string[];
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

export default function PortalPage() {
  const client = usePortalClient();
  const logout = useClientAuthStore((state) => state.logout);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [dreSummary, setDreSummary] = useState<DreDashboardSummary | null>(null);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => String(currentYear - 3 + index));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const response = await fetch(`/api/dre/summary?year=${selectedYear}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          if (active) setDreSummary(null);
          return;
        }

        const payload = (await response.json()) as DreDashboardSummary;
        if (active) {
          setDreSummary(payload);
        }
      } catch {
        if (active) setDreSummary(null);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [selectedYear]);

  const metrics = useMemo(
    () => [
      {
        label: "Receita Bruta",
        value: money(dreSummary?.cards.receitaBruta ?? 0),
        tone: "from-cyan-500/30 to-sky-500/10",
      },
      {
        label: "Custos + Despesas",
        value: money(dreSummary?.cards.custosDespesas ?? 0),
        tone: "from-fuchsia-500/25 to-rose-500/10",
      },
      {
        label: "Resultado Líquido",
        value: money(dreSummary?.cards.resultadoLiquido ?? 0),
        tone: "from-emerald-500/25 to-teal-500/10",
      },
      {
        label: "IRPJ / CSLL",
        value: money(dreSummary?.cards.irpjCsll ?? 0),
        tone: "from-amber-500/20 to-orange-500/10",
      },
    ],
    [dreSummary]
  );

  const chartSeries = useMemo(() => {
    const labels = dreSummary?.monthLabels?.length ? dreSummary.monthLabels : monthLabels;
    const receitaBruta = dreSummary?.lines?.receitaBruta ?? [];
    const custosVendas = dreSummary?.lines?.custosVendas ?? [];
    const custosServicos = dreSummary?.lines?.custosServicos ?? [];
    const lucroOperacional = dreSummary?.lines?.lucroOperacional ?? [];
    const resultadoLiquido = dreSummary?.lines?.resultadoLiquidoExercicio ?? [];

    return labels.map((month, index) => {
      const receita = receitaBruta[index] ?? 0;
      const despesa = Math.abs(custosVendas[index] ?? 0) + Math.abs(custosServicos[index] ?? 0);
      const margemBruta = ratioPercent(receita - despesa, receita);
      const margemLiquida = ratioPercent(resultadoLiquido[index] ?? 0, receita);
      const margemEbitda = ratioPercent(lucroOperacional[index] ?? 0, receita);
      return {
        month,
        receita,
        despesa,
        margemBruta,
        margemLiquida,
        margemEbitda,
      };
    });
  }, [dreSummary]);

  const pieData = useMemo(() => {
    if (!dreSummary) return emptyPieData;
    return [
      { name: "Custo de Venda", value: Math.abs(dreSummary.chart.custoVenda ?? 0), color: "#f59e0b" },
      { name: "Desp. Operac.", value: Math.abs(dreSummary.chart.despesas ?? 0), color: "#a855f7" },
      { name: "Impostos", value: Math.abs(dreSummary.chart.impostos ?? 0), color: "#ef4444" },
      { name: "Lucro", value: dreSummary.chart.lucro ?? 0, color: "#10b981" },
    ];
  }, [dreSummary]);

  const bottomMetrics = useMemo(() => {
    const receita = dreSummary?.cards.receitaBruta ?? 0;
    const liquido = dreSummary?.cards.resultadoLiquido ?? 0;
    const custos = dreSummary?.cards.custosDespesas ?? 0;
    const operacional = dreSummary?.lines?.lucroOperacional?.at(-1) ?? 0;

    return [
      { label: "Margem Líquida", value: `${ratioPercent(liquido, receita).toFixed(1)}%`, note: "Atual", tone: "emerald" },
      { label: "EBITDA", value: money(operacional), note: "Último mês", tone: "violet" },
      { label: "Margem Bruta", value: `${ratioPercent(receita - Math.abs(custos), receita).toFixed(1)}%`, note: "Atual", tone: "cyan" },
      { label: "Margem EBITDA", value: `${ratioPercent(operacional, receita).toFixed(1)}%`, note: "Atual", tone: "indigo" },
    ];
  }, [dreSummary]);

  const healthCards = useMemo(() => {
    const receita = dreSummary?.cards.receitaBruta ?? 0;
    const liquido = dreSummary?.cards.resultadoLiquido ?? 0;
    const operacional = dreSummary?.lines?.lucroOperacional?.at(-1) ?? 0;
    const custos = dreSummary?.cards.custosDespesas ?? 0;
    return [
      { label: "Liquidez Corrente", value: "0,00", note: "Sem base patrimonial", tone: "emerald" },
      { label: "Margem Líquida", value: `${ratioPercent(liquido, receita).toFixed(1)}%`, note: "Atual", tone: "emerald" },
      { label: "Margem EBITDA", value: `${ratioPercent(operacional, receita).toFixed(1)}%`, note: "Atual", tone: "amber" },
      { label: "Peso de Custos", value: `${ratioPercent(custos, receita).toFixed(1)}%`, note: "Receita bruta", tone: "rose" },
    ];
  }, [dreSummary]);

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6 lg:p-8">
      <section className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.88))] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:rounded-[2rem]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                className={cn(
                  "min-w-max snap-start rounded-2xl px-4 py-3 text-sm font-semibold transition-all",
                  index === 0
                    ? "bg-cyan-500 text-white shadow-[0_0_24px_rgba(14,165,233,0.32)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                )}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="w-full lg:w-auto">
            <div className="flex items-center gap-3">
              <p className="text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-500">
                Ano
              </p>
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/30 lg:min-w-[9rem]"
              >
                {availableYears.map((item) => (
                  <option key={item} value={item} className="bg-slate-900">
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {metrics.map((card) => (
          <div
            key={card.label}
            className={cn(
              "rounded-[1.45rem] border border-white/8 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:rounded-[1.6rem] sm:p-5",
              "bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))]",
              "relative overflow-hidden"
            )}
          >
            <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", card.tone)} />
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-black tracking-tight text-white">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_1.2fr_0.75fr]">
        <div className="order-2 rounded-[1.65rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.26)] sm:p-5 lg:order-1 lg:rounded-[1.8rem]">
          <p className="text-lg font-bold text-white">Composição - Jan</p>
          <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
            Distribuição do faturamento
          </p>

          <div className="mt-6 h-[260px] sm:h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={108}
                  paddingAngle={3}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(8, 17, 31, 0.96)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    color: "#e2e8f0",
                  }}
                  formatter={(value: number) => money(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="order-3 rounded-[1.65rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.26)] sm:p-5 lg:order-2 lg:rounded-[1.8rem]">
          <p className="text-lg font-bold text-white">Receita vs Despesa</p>
          <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
            Evolução mensal
          </p>

          <div className="mt-6 h-[260px] sm:h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries.length ? chartSeries : zeroSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(8, 17, 31, 0.96)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    color: "#e2e8f0",
                  }}
                  formatter={(value: number) => money(value)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="receita"
                  stroke="#22d3ee"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="despesa"
                  stroke="#ff2d6f"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="order-1 rounded-[1.65rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.26)] sm:p-5 lg:order-3 lg:rounded-[1.8rem]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-bold text-white">Relatórios</p>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {reports.map((report) => (
              <div
                key={report.title}
                className="flex items-center justify-between gap-4 rounded-2xl bg-white/4 px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                    <FileDown className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{report.title}</p>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
                      {report.period}
                    </p>
                  </div>
                </div>
                <Link
                  href={
                    report.title.includes("Balan")
                      ? `/portal/balanco-patrimonial?year=${selectedYear}`
                      : report.title.includes("DRE")
                        ? `/portal/dre?year=${selectedYear}`
                        : "/portal/dfc?year=".concat(selectedYear)
                  }
                  className="text-slate-500 transition hover:text-slate-200"
                >
                  <UploadCloud className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4">
            <p className="text-sm font-semibold text-white">Pendências</p>
            <p className="mt-1 text-xs text-amber-100/75">0 documentos pendentes</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {bottomMetrics.map((card) => (
          <div
            key={card.label}
            className="rounded-[1.45rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:rounded-[1.6rem] sm:p-5"
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-black tracking-tight text-white">
              {card.value}
            </p>
            <p
              className={cn(
                "mt-4 text-sm font-semibold",
                card.tone === "emerald" && "text-emerald-400",
                card.tone === "violet" && "text-violet-400",
                card.tone === "cyan" && "text-cyan-400",
                card.tone === "indigo" && "text-indigo-400"
              )}
            >
              {card.note}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4">
        <div className="rounded-[1.65rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.26)] sm:rounded-[1.8rem] sm:p-5">
          <p className="text-lg font-bold text-white">Evolução das Margens</p>
          <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
            Margem bruta, líquida e EBITDA ao longo do ano (%)
          </p>

          <div className="mt-6 h-[260px] sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries.length ? chartSeries : zeroSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(8, 17, 31, 0.96)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    color: "#e2e8f0",
                  }}
                  formatter={(value: number) => `${value}%`}
                />
                <Legend />
                <Line type="monotone" dataKey="margemBruta" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="margemLiquida" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="margemEbitda" stroke="#a855f7" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[1.65rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.26)] sm:rounded-[1.8rem] sm:p-5">
          <p className="text-lg font-bold text-white">Para onde vai o dinheiro</p>
          <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
            Distribuição da receita bruta por mês
          </p>

          <div className="mt-6 h-[280px] sm:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSeries.length ? chartSeries : zeroSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(8, 17, 31, 0.96)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    color: "#e2e8f0",
                  }}
                  formatter={(value: number) => money(value)}
                />
                <Legend />
                <Bar dataKey="receita" stackId="a" fill="#22d3ee" radius={[10, 10, 0, 0]} />
                <Bar dataKey="despesa" stackId="a" fill="#f97316" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {healthCards.map((card) => (
            <div
              key={card.label}
              className={cn(
                "rounded-[1.45rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:rounded-[1.6rem] sm:p-5",
                card.tone === "emerald" && "ring-1 ring-emerald-500/15",
                card.tone === "amber" && "ring-1 ring-amber-500/15",
                card.tone === "rose" && "ring-1 ring-rose-500/15"
              )}
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">
                {card.label}
              </p>
              <p className="mt-3 text-3xl font-black tracking-tight text-white">
                {card.value}
              </p>
              <p
                className={cn(
                  "mt-4 text-sm font-semibold",
                  card.tone === "emerald" && "text-emerald-400",
                  card.tone === "amber" && "text-amber-400",
                  card.tone === "rose" && "text-rose-400"
                )}
              >
                {card.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-4 rounded-[1.65rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.26)] sm:flex-row sm:items-center sm:justify-between sm:rounded-[1.8rem] sm:px-5">
        <div>
          <p className="text-sm text-slate-400">Sessão atual</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {client?.name ?? "Cliente não identificado"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/portal/documentos"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Documentos
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-2xl border border-white/10 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
