import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Layers3,
  LifeBuoy,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { requireStaff } from "@/lib/auth-guard";
import { getParametrizationStatus } from "@/lib/parametrization-status";
import prisma from "@/lib/prisma";

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function timeAgo(value: Date | null | undefined) {
  if (!value) return "Sem atualizacao";

  const diffMs = value.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}

function statusTone(status: string) {
  switch (status) {
    case "ready":
    case "closed":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "processing":
    case "in_progress":
    case "partial":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "failed":
    case "stale":
    case "open":
      return "border-rose-400/20 bg-rose-400/10 text-rose-300";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function importKindLabel(kind: string) {
  switch (kind) {
    case "chart_of_accounts":
      return "Plano de Contas";
    case "dre":
      return "DRE";
    case "patrimonial":
      return "Patrimonial";
    case "dfc":
      return "DFC";
    default:
      return kind;
  }
}

function snapshotLabel(type: string) {
  switch (type) {
    case "dre":
      return "DRE";
    case "patrimonial":
      return "Patrimonial";
    case "dfc":
      return "DFC";
    default:
      return type;
  }
}

function ticketStatusLabel(status: string) {
  switch (status) {
    case "open":
      return "Aberto";
    case "in_progress":
      return "Em atendimento";
    case "closed":
      return "Resolvido";
    default:
      return status;
  }
}

function importStatusLabel(status: string) {
  switch (status) {
    case "processing":
      return "Processando";
    case "ready":
      return "Concluido";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
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
  const currentYear = new Date().getFullYear();

  const [
    parametrizationStatus,
    clientsActive,
    clientsInactive,
    unreadDocuments,
    openTickets,
    inProgressTickets,
    processingImports,
    failedImports,
    recentImports,
    recentTickets,
    recentDocuments,
    snapshotGroups,
    topOperationalClients,
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
    prisma.importBatch.count({
      where: {
        accounting_id: auth.accountingId,
        status: "processing",
      },
    }),
    prisma.importBatch.count({
      where: {
        accounting_id: auth.accountingId,
        status: "failed",
      },
    }),
    prisma.importBatch.findMany({
      where: {
        accounting_id: auth.accountingId,
      },
      orderBy: { started_at: "desc" },
      take: 6,
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.supportTicket.findMany({
      where: {
        accounting_id: auth.accountingId,
      },
      orderBy: { updated_at: "desc" },
      take: 6,
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.clientDocument.findMany({
      where: {
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
      orderBy: { created_at: "desc" },
      take: 6,
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.statementSnapshot.groupBy({
      by: ["statement_type", "status"],
      where: {
        accounting_id: auth.accountingId,
        year: currentYear,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.client.findMany({
      where: {
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
      orderBy: { name: "asc" },
      take: 8,
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            documents: {
              where: {
                deleted_at: null,
                viewed_at: null,
              },
            },
            supportTickets: {
              where: {
                status: {
                  in: ["open", "in_progress"],
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const snapshotSummary = snapshotGroups.reduce<
    Record<string, { ready: number; partial: number; stale: number; failed: number }>
  >((accumulator, item) => {
    const key = item.statement_type;
    if (!accumulator[key]) {
      accumulator[key] = { ready: 0, partial: 0, stale: 0, failed: 0 };
    }

    if (item.status === "ready") accumulator[key].ready += item._count._all;
    if (item.status === "partial") accumulator[key].partial += item._count._all;
    if (item.status === "stale") accumulator[key].stale += item._count._all;
    if (item.status === "failed") accumulator[key].failed += item._count._all;

    return accumulator;
  }, {});

  const operationalClients = topOperationalClients
    .map((client) => ({
      id: client.id,
      name: client.name,
      unreadDocuments: client._count.documents,
      activeTickets: client._count.supportTickets,
      totalPending: client._count.documents + client._count.supportTickets,
    }))
    .filter((client) => client.totalPending > 0)
    .sort((left, right) => right.totalPending - left.totalPending)
    .slice(0, 5);

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

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <div className="rounded-[1.55rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.92))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:rounded-[1.75rem] sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
                Importacoes recentes
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                Ultimos lotes processados
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
                {formatNumber(processingImports)} processando
              </span>
              <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-rose-300">
                {formatNumber(failedImports)} com falha
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {recentImports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
                Nenhuma importacao registrada ainda.
              </div>
            ) : (
              recentImports.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {importKindLabel(item.kind)}
                        {item.client ? ` • ${item.client.name}` : " • Global"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {item.file_name || "Arquivo sem nome"} •{" "}
                        {item.year ? `Ano ${item.year}` : "Sem ano"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${statusTone(item.status)}`}
                    >
                      {importStatusLabel(item.status)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>{formatNumber(item.row_count)} linhas</span>
                    <span>{formatNumber(item.error_count)} erros</span>
                    <span>{formatDate(item.started_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[1.55rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.92))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:rounded-[1.75rem] sm:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
              Saude dos demonstrativos
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-white">
              Snapshots do ano {currentYear}
            </h2>
          </div>

          <div className="mt-5 space-y-3">
            {(["dre", "patrimonial", "dfc"] as const).map((type) => {
              const item = snapshotSummary[type] ?? {
                ready: 0,
                partial: 0,
                stale: 0,
                failed: 0,
              };

              return (
                <div
                  key={type}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-white">{snapshotLabel(type)}</p>
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {formatNumber(item.ready + item.partial + item.stale + item.failed)} clientes
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-emerald-300">
                      Pronto: {formatNumber(item.ready)}
                    </div>
                    <div className="rounded-xl border border-amber-400/15 bg-amber-400/10 px-3 py-2 text-amber-300">
                      Parcial: {formatNumber(item.partial)}
                    </div>
                    <div className="rounded-xl border border-rose-400/15 bg-rose-400/10 px-3 py-2 text-rose-300">
                      Stale: {formatNumber(item.stale)}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300">
                      Falha: {formatNumber(item.failed)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[1.55rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.92))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:rounded-[1.75rem] sm:p-5 xl:col-span-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
                Fila de suporte
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                Chamados recentes
              </h2>
            </div>
            <Link
              href="/dashboard/suporte"
              className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
            >
              Ver tudo
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentTickets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
                Nenhum chamado por enquanto.
              </div>
            ) : (
              recentTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{ticket.subject}</p>
                      <p className="mt-1 text-sm text-slate-400">{ticket.client.name}</p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.24em] ${statusTone(ticket.status)}`}
                    >
                      {ticketStatusLabel(ticket.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Atualizado {timeAgo(ticket.updated_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[1.55rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.92))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:rounded-[1.75rem] sm:p-5 xl:col-span-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
                Documentos recentes
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                Ultimos envios dos clientes
              </h2>
            </div>
            <Link
              href="/dashboard/documentos"
              className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
            >
              Abrir documentos
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentDocuments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
                Nenhum documento recebido ainda.
              </div>
            ) : (
              recentDocuments.map((document) => (
                <div
                  key={document.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{document.display_name}</p>
                      <p className="mt-1 text-sm text-slate-400">{document.client.name}</p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.24em] ${document.viewed_at ? "border-white/10 bg-white/5 text-slate-300" : "border-violet-400/20 bg-violet-400/10 text-violet-300"}`}
                    >
                      {document.viewed_at ? "Visto" : "Novo"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>{document.category}</span>
                    <span>{formatDate(document.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[1.55rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.92))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:rounded-[1.75rem] sm:p-5 xl:col-span-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
                Pendencias por cliente
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                Onde agir primeiro
              </h2>
            </div>
            <Sparkles className="h-5 w-5 text-cyan-300" />
          </div>

          <div className="mt-5 space-y-3">
            {operationalClients.length === 0 ? (
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-6 text-sm text-emerald-300">
                Carteira sem pendencias operacionais imediatas. Bom sinal.
              </div>
            ) : (
              operationalClients.map((client) => (
                <div
                  key={client.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-white">{client.name}</p>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.24em] text-cyan-300">
                      {formatNumber(client.totalPending)} pendencias
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-violet-300">
                      Docs nao vistos: {formatNumber(client.unreadDocuments)}
                    </span>
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-amber-300">
                      Tickets ativos: {formatNumber(client.activeTickets)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 md:gap-4">
        <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] p-4 sm:rounded-[1.5rem]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            <div>
              <p className="text-sm font-bold text-white">Atalhos rapidos</p>
              <p className="text-xs text-slate-500">Acesso direto aos modulos principais</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { href: "/dashboard/clientes", label: "Clientes" },
              { href: "/dashboard/plano-de-contas", label: "Plano de Contas" },
              { href: "/dashboard/parametrizacao", label: "Parametrizacao" },
              { href: "/dashboard/documentos", label: "Documentos" },
              { href: "/dashboard/suporte", label: "Suporte" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/10"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] p-4 sm:rounded-[1.5rem]">
          <div className="flex items-center gap-3">
            <LoaderCircle className="h-5 w-5 text-amber-300" />
            <div>
              <p className="text-sm font-bold text-white">Fila tecnica</p>
              <p className="text-xs text-slate-500">Processos que merecem atencao agora</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>• Imports em andamento: {formatNumber(processingImports)}</li>
            <li>• Imports com falha: {formatNumber(failedImports)}</li>
            <li>• Snapshots pendentes/parciais no ano: {formatNumber((snapshotSummary.dre?.partial ?? 0) + (snapshotSummary.patrimonial?.partial ?? 0) + (snapshotSummary.dfc?.partial ?? 0))}</li>
          </ul>
        </div>

        <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] p-4 sm:rounded-[1.5rem]">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-300" />
            <div>
              <p className="text-sm font-bold text-white">Leitura rapida</p>
              <p className="text-xs text-slate-500">O que vale priorizar nesta semana</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>• Fechar as pendencias de parametrizacao mais criticas</li>
            <li>• Verificar clientes com documentos nao vistos</li>
            <li>• Tirar chamados abertos da fila mais antiga</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
