"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Download,
  FileDown,
  FileUp,
  Landmark,
  List,
  UploadCloud,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ViewMode = "lista" | "graficos" | "fechado";

const tabs: Array<{ id: ViewMode; label: string; icon: typeof List }> = [
  { id: "lista", label: "Lista", icon: List },
  { id: "graficos", label: "Gráficos", icon: BarChart3 },
  { id: "fechado", label: "Fechado", icon: FileDown },
];

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const years = [2026];

const zeroSeries = months.map((month) => ({
  month,
  value: 0,
}));

const uploadCards = [
  { label: "Arquivo por mês e ano", note: "Nenhum balancete enviado ainda." },
];

const chartCards = [
  { label: "Resultado Contábil", value: "R$ 0,00", stroke: "#1fc8ff", fill: "rgba(31,200,255,0.16)" },
  { label: "Resultado Operacional", value: "R$ 0,00", stroke: "#ff2d6f", fill: "rgba(255,45,111,0.16)" },
  { label: "Resultado de Investimento", value: "R$ 0,00", stroke: "#f59e0b", fill: "rgba(245,158,11,0.16)" },
  { label: "Resultado Financeiro", value: "R$ 0,00", stroke: "#2f76ff", fill: "rgba(47,118,255,0.16)" },
  { label: "Resultado Geração de Caixa", value: "R$ 0,00", stroke: "#10b981", fill: "rgba(16,185,129,0.16)" },
  { label: "Saldo Final Disponível", value: "R$ 0,00", stroke: "#a855f7", fill: "rgba(168,85,247,0.16)" },
];

const closedCards = [
  { label: "Resultado Contábil", value: "R$ 0,00" },
  { label: "Resultado Operacional", value: "R$ 0,00" },
  { label: "Resultado de Investimento", value: "R$ 0,00" },
  { label: "Resultado Financeiro", value: "R$ 0,00" },
  { label: "Resultado Geração de Caixa", value: "R$ 0,00" },
  { label: "Saldo Final Disponível", value: "R$ 0,00" },
];

const sections = [
  "Resultado Contábil",
  "Fluxos de Caixa Originários de Atividades Operacionais",
  "Fluxos de Caixa Originários de Atividades de Investimentos",
  "Fluxos de Caixa Originários de Atividades de Financiamentos",
  "Resultado da Geração de Caixa",
];

const listRows = [
  { label: "Resultado Contábil", level: 0, tone: "cyan", kind: "section" },
  { label: "Resultado Líquido do Exercício", level: 1, tone: "muted", kind: "row" },
  { label: "Depreciação e Amortização", level: 1, tone: "muted", kind: "row" },
  { label: "Resultado da Venda de Ativo Imobilizado", level: 1, tone: "muted", kind: "row" },
  { label: "Resultado da Equivalência Patrimonial", level: 1, tone: "muted", kind: "row" },
  { label: "Recebimentos de Lucros e Dividendos de Subsidiárias", level: 1, tone: "muted", kind: "row" },
  { label: "Lucro Ajustado", level: 0, tone: "cyan", kind: "subtotal" },
  { label: "Fluxos de Caixa Originários de Atividades Operacionais", level: 0, tone: "cyan", kind: "section" },
  { label: "Variação Ativo", level: 1, tone: "muted", kind: "row" },
  { label: "Variação Passivo", level: 1, tone: "muted", kind: "row" },
  { label: "Resultado Operacional", level: 0, tone: "cyan", kind: "subtotal" },
  { label: "Fluxos de Caixa Originários de Atividades de Investimentos", level: 0, tone: "cyan", kind: "section" },
  { label: "Recebimentos por Vendas de Ativo Inv./Imob./Intang.", level: 1, tone: "muted", kind: "row" },
  { label: "Compras de Imobilizado", level: 1, tone: "muted", kind: "row" },
  { label: "Aquisições em Investimentos", level: 1, tone: "muted", kind: "row" },
  { label: "Baixa de Ativo Imobilizado", level: 1, tone: "muted", kind: "row" },
  { label: "Resultado de Investimento", level: 0, tone: "cyan", kind: "subtotal" },
  { label: "Fluxos de Caixa Originários de Atividades de Financiamentos", level: 0, tone: "cyan", kind: "section" },
  { label: "Integralização ou Aumento de Capital Social", level: 1, tone: "muted", kind: "row" },
  { label: "Pagamento de Lucros e Dividendos", level: 1, tone: "muted", kind: "row" },
  { label: "Variação em Empréstimos/Financiamentos", level: 1, tone: "muted", kind: "row" },
  { label: "Dividendos Provisionados a Pagar", level: 1, tone: "muted", kind: "row" },
  { label: "Variação Empréstimos Pessoas Ligadas PJ/PF", level: 1, tone: "muted", kind: "row" },
  { label: "Resultado Financeiro", level: 0, tone: "cyan", kind: "subtotal" },
  { label: "Resultado da Geração de Caixa", level: 0, tone: "cyan", kind: "section" },
  { label: "Saldo Inicial Disponível", level: 1, tone: "muted", kind: "row" },
  { label: "Saldo Final Disponível", level: 1, tone: "muted", kind: "row" },
];

function zeroCurrency() {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(0);
}

function zeroLine({
  stroke,
  fill,
}: {
  stroke: string;
  fill: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={zeroSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          formatter={() => zeroCurrency()}
        />
        <Area type="monotone" dataKey="value" stroke={stroke} fill={fill} strokeWidth={2.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function zeroBar({
  label,
  stroke,
  fill,
}: {
  label: string;
  stroke: string;
  fill: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={zeroSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          formatter={() => zeroCurrency()}
        />
        <Bar dataKey="value" fill={stroke} radius={[10, 10, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function areaColor(tone: string) {
  switch (tone) {
    case "cyan":
      return "text-cyan-300";
    case "pink":
      return "text-pink-400";
    case "orange":
      return "text-orange-400";
    default:
      return "text-slate-500";
  }
}

export default function DfcPage() {
  const [view, setView] = useState<ViewMode>("lista");
  const [month, setMonth] = useState("Jan");
  const [year, setYear] = useState("2026");

  const visibleRows = useMemo(() => listRows, []);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400">
              Balancetes mensais
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Arquivo por mês e ano
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Cada envio vira um card. O histórico não sobrescreve o mês anterior.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-[300px_150px_150px_auto]">
            <div>
              <p className="mb-2 text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-500">
                Planilha
              </p>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-white/10"
              >
                <span>Selecionar planilha</span>
                <FileUp className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            <div>
              <p className="mb-2 text-[0.7rem] font-black uppercase tracking-[0.3em] text-slate-500">
                Mês
              </p>
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/30"
              >
                {months.map((item) => (
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
                onChange={(event) => setYear(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/30"
              >
                {years.map((item) => (
                  <option key={item} value={item} className="bg-slate-900">
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)]"
            >
              <UploadCloud className="h-4 w-4" />
              Enviar
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/10 bg-black/10 px-6 py-10 text-center text-slate-500">
          Nenhum balancete enviado ainda.
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
              DFC
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">Fluxo de Caixa Direto</h2>
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
            className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)]"
          >
            <UploadCloud className="h-4 w-4" />
            Importar DFC 2026
          </button>

          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </section>

      {view === "lista" && (
        <section className="overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="overflow-x-auto">
            <div className="min-w-[1600px]">
              <div className="grid grid-cols-[340px_repeat(12,minmax(78px,1fr))_120px_90px] border-b border-white/8 bg-white/4 px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.25em] text-slate-400">
                <div>Linha</div>
                {months.map((item) => (
                  <div key={item} className="text-center">
                    {item.toUpperCase()}
                  </div>
                ))}
                <div className="text-center">Acum.</div>
                <div className="text-center">%</div>
              </div>

              <div className="divide-y divide-white/6">
                {visibleRows.map((row) => (
                  <div
                    key={row.label}
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

                    {months.map((item) => (
                      <div
                        key={`${row.label}-${item}`}
                        className={cn(
                          "text-center font-bold",
                          row.kind === "subtotal" ? "text-cyan-300" : row.level === 0 ? "text-slate-200" : "text-slate-500"
                        )}
                      >
                        0
                      </div>
                    ))}

                    <div className={cn("text-right font-black", row.kind === "subtotal" ? "text-cyan-300" : "text-white")}>
                      0
                    </div>
                    <div className="text-right font-black text-cyan-300">0%</div>
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
            <div
              key={card.label}
              className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-white">
                    {card.value}
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
                {zeroLine({ stroke: card.stroke, fill: card.fill })}
              </div>
            </div>
          ))}
        </section>
      )}

      {view === "fechado" && (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {closedCards.map((card, index) => (
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
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-[1.6rem] border border-white/6 bg-white/4 p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-400">
                  Resultado Geração de Caixa
                </p>
                <div className="mt-4 h-[260px]">
                  {zeroLine({ stroke: "#22d3ee", fill: "rgba(34,211,238,0.16)" })}
                </div>
              </div>

              <div className="space-y-3">
                {sections.map((section) => (
                  <div key={section} className="rounded-2xl border border-white/6 bg-white/4 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                      {section}
                    </p>
                    <p className="mt-2 text-2xl font-black text-white">0</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[1.6rem] border border-cyan-500/20 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Resultado Contábil
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-cyan-300">R$ 0,00</p>
        </div>
        <div className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Resultado Operacional
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">R$ 0,00</p>
        </div>
        <div className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,28,49,0.96),rgba(12,22,40,0.9))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Saldo Final Disponível
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">R$ 0,00</p>
        </div>
      </section>
    </div>
  );
}
