"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { CalendarDays, Filter, FileDown, UploadCloud } from "lucide-react";

import { useClientAuthStore } from "@/stores/useClientAuthStore";
import { cn } from "@/lib/utils";

const tabs = ["INÍCIO", "Financeiro", "Contábil", "Fiscal", "Serviços"];

const metrics = [
  { label: "Receita Bruta", value: "R$ 0", tone: "from-cyan-500/30 to-sky-500/10" },
  { label: "Custos + Despesas", value: "R$ 0", tone: "from-fuchsia-500/25 to-rose-500/10" },
  { label: "Resultado Líquido", value: "R$ 0", tone: "from-emerald-500/25 to-teal-500/10" },
  { label: "IRPJ / CSLL", value: "R$ 0", tone: "from-amber-500/20 to-orange-500/10" },
];

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

const pieData = [
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

const healthCards = [
  { label: "Liquidez Corrente", value: "0,00", note: "Sem movimentação", tone: "emerald" },
  { label: "Margem Líquida", value: "0,0%", note: "Sem resultado", tone: "emerald" },
  { label: "Margem EBITDA", value: "0,0%", note: "Aguardando dados", tone: "amber" },
  { label: "Endividamento", value: "0,0%", note: "Sem passivos", tone: "rose" },
];

const bottomMetrics = [
  { label: "Margem Líquida", value: "0,0%", note: "Saudável", tone: "emerald" },
  { label: "EBITDA", value: "R$ 0", note: "Sem base", tone: "violet" },
  { label: "Margem Bruta", value: "0,0%", note: "Sem base", tone: "cyan" },
  { label: "Margem EBITDA", value: "0,0%", note: "Sem base", tone: "indigo" },
];

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PortalPage() {
  const client = useClientAuthStore((state) => state.client);
  const logout = useClientAuthStore((state) => state.logout);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => String(currentYear - 3 + index));
  }, []);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.88))] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-semibold transition-all",
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

          <div>
            <p className="mb-2 text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-500">
              Ano
            </p>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/30"
            >
              {availableYears.map((item) => (
                <option key={item} value={item} className="bg-slate-900">
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.92))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#1ea7ff_0%,#0f86ff_50%,#0a6bff_100%)] text-2xl font-bold text-white shadow-[0_0_28px_rgba(14,165,233,0.45)]">
                {client?.name ? client.name.slice(0, 2).toUpperCase() : "CO"}
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {client?.name ?? "Cliente não identificado"}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                    Cliente Premium
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    ID: {client?.id ? `#${client.id.slice(0, 8).toUpperCase()}` : "#TC-000-000"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-900" />
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-900" />
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(11,145,239,0.96),rgba(23,93,253,0.95))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-5xl font-black tracking-tight text-white">27</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/80">
                Sábado
              </p>
              <p className="mt-1 text-lg font-bold text-white">Reunião Mensal</p>
              <p className="mt-1 text-sm text-cyan-100/80">10:25 am - 30 mins</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((card) => (
          <div
            key={card.label}
            className={cn(
              "rounded-[1.6rem] border border-white/8 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]",
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
        <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)]">
          <p className="text-lg font-bold text-white">Composição - Jan</p>
          <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
            Distribuição do faturamento
          </p>

          <div className="mt-6 h-[330px]">
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

        <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)]">
          <p className="text-lg font-bold text-white">Receita vs Despesa</p>
          <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
            Evolução mensal
          </p>

          <div className="mt-6 h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={zeroSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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

        <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)]">
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

      <section className="grid gap-4 xl:grid-cols-4">
        {bottomMetrics.map((card) => (
          <div
            key={card.label}
            className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
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
        <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)]">
          <p className="text-lg font-bold text-white">Evolução das Margens</p>
          <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
            Margem bruta, líquida e EBITDA ao longo do ano (%)
          </p>

          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={zeroSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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

        <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)]">
          <p className="text-lg font-bold text-white">Para onde vai o dinheiro</p>
          <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
            Distribuição da receita bruta por mês
          </p>

          <div className="mt-6 h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zeroSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {healthCards.map((card) => (
            <div
              key={card.label}
              className={cn(
                "rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]",
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

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,38,0.97),rgba(10,18,32,0.92))] px-5 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.26)]">
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
