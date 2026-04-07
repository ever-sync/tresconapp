import {
  ArrowRight,
  Building2,
  FileText,
  Layers3,
  LifeBuoy,
} from "lucide-react";
import Link from "next/link";

import { requireStaff } from "@/lib/auth-guard";
import { getParametrizationStatus } from "@/lib/parametrization-status";
import prisma from "@/lib/prisma";

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "cyan" | "emerald" | "amber" | "violet";
};

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "cyan",
}: MetricCardProps) {
  const tones = {
    cyan: "from-cyan-500/14 to-sky-500/10 text-cyan-300",
    emerald: "from-emerald-500/14 to-teal-500/10 text-emerald-300",
    amber: "from-amber-500/14 to-orange-500/10 text-amber-300",
    violet: "from-violet-500/14 to-indigo-500/10 text-violet-300",
  } as const;

  return (
    <div className="rounded-[1.45rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.92))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:rounded-[1.75rem] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
            {label}
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{hint}</p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const auth = await requireStaff();

  const [
    parametrizationStatus,
    clientsActive,
    clientsInactive,
    unreadDocuments,
    openTickets,
    inProgressTickets,
  ] = await Promise.all([
    getParametrizationStatus(auth.accountingId),
    prisma.client.count({
      where: {
        accounting_id: auth.accountingId,
        deleted_at: null,
        status: "active",
      },
    }),
    prisma.client.count({
      where: {
        accounting_id: auth.accountingId,
        deleted_at: null,
        status: "inactive",
      },
    }),
    prisma.clientDocument.count({
      where: {
        accounting_id: auth.accountingId,
        deleted_at: null,
        viewed_at: null,
      },
    }),
    prisma.supportTicket.count({
      where: {
        accounting_id: auth.accountingId,
        status: "open",
      },
    }),
    prisma.supportTicket.count({
      where: {
        accounting_id: auth.accountingId,
        status: "in_progress",
      },
    }),
  ]);

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6 lg:p-8">
      <section className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300/75">
              Operacao da contabilidade
            </p>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">
                Visao geral da carteira
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Acompanhe clientes, parametrizacao, documentos, chamados e a saude
                dos demonstrativos sem precisar navegar modulo por modulo.
              </p>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
            <Link
              href="/dashboard/clientes"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Clientes
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard/parametrizacao"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.28)]"
            >
              Parametrizacao
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Clientes ativos"
          value={formatNumber(clientsActive)}
          hint={`${formatNumber(clientsInactive)} inativos na carteira`}
          icon={Building2}
          tone="cyan"
        />
        <MetricCard
          label="Pendencias de parametrizacao"
          value={formatNumber(parametrizationStatus.totalPending)}
          hint={`DRE ${formatNumber(parametrizationStatus.drePending)} • Patrimonial ${formatNumber(parametrizationStatus.patrimonialPending)} • DFC ${formatNumber(parametrizationStatus.dfcPending)}`}
          icon={Layers3}
          tone="amber"
        />
        <MetricCard
          label="Documentos nao vistos"
          value={formatNumber(unreadDocuments)}
          hint="Arquivos enviados pelos clientes aguardando triagem"
          icon={FileText}
          tone="violet"
        />
        <MetricCard
          label="Chamados em aberto"
          value={formatNumber(openTickets)}
          hint={`${formatNumber(inProgressTickets)} em atendimento neste momento`}
          icon={LifeBuoy}
          tone="emerald"
        />
      </section>

    </div>
  );
}
