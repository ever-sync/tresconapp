"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Filter,
  Download,
  MessagesSquare,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { UploadDropzone } from "@/components/upload-dropzone";
import { uploadFormDataWithProgress } from "@/lib/upload-request";
import { cn } from "@/lib/utils";

type TicketAudience = "staff" | "client";
type TicketStatus = "open" | "in_progress" | "closed";
type TicketPriority = "low" | "medium" | "high";

type SupportMessage = {
  id: string;
  authorRole: TicketAudience | "system";
  authorName: string;
  body: string;
  createdAt: string;
};

type SupportDocument = {
  id: string;
  documentId: string;
  authorRole: TicketAudience;
  authorName: string;
  title: string;
  category: string;
  description: string;
  mimeType: string;
  size: string;
  createdAt: string;
};

type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  client: {
    id: string;
    name: string;
    cnpj: string;
  };
  unreadCount: number;
  messages: SupportMessage[];
  documents: SupportDocument[];
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type TicketCounters = {
  open: number;
  in_progress: number;
  closed: number;
  all: number;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: TicketStatus) {
  if (status === "open") return "Aberto";
  if (status === "in_progress") return "Em atendimento";
  return "Resolvido";
}

function statusTone(status: TicketStatus, active: boolean) {
  if (active) {
    return "border-cyan-400/30 bg-cyan-500/12 text-cyan-300";
  }

  switch (status) {
    case "open":
      return "border-slate-500/20 bg-white/5 text-slate-300";
    case "in_progress":
      return "border-amber-400/20 bg-amber-500/10 text-amber-300";
    default:
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
  }
}

function priorityTone(priority: TicketPriority) {
  switch (priority) {
    case "high":
      return "border-rose-400/20 bg-rose-500/10 text-rose-300";
    case "medium":
      return "border-amber-400/20 bg-amber-500/10 text-amber-300";
    default:
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
  }
}

function priorityLabel(priority: TicketPriority) {
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Media";
  return "Baixa";
}

export function SupportCenter({
  audience,
  title,
  subtitle,
}: {
  audience: TicketAudience;
  title: string;
  subtitle: string;
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });
  const [counters, setCounters] = useState<TicketCounters>({
    open: 0,
    in_progress: 0,
    closed: 0,
    all: 0,
  });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<File | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState<number | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newPriority, setNewPriority] = useState<TicketPriority>("medium");

  useEffect(() => {
    let active = true;

    async function loadTickets() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          audience,
          page: String(page),
          pageSize: "50",
          status: filter,
        });
        if (deferredQuery.trim()) {
          params.set("query", deferredQuery.trim());
        }

        const response = await fetch(`/api/support/tickets?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) throw new Error("Nao foi possivel carregar os chamados");

        const payload = (await response.json()) as {
          tickets?: SupportTicket[];
          pagination?: Pagination;
          counters?: TicketCounters;
        };
        if (active) {
          setTickets(payload.tickets ?? []);
          setPagination(
            payload.pagination ?? {
              page,
              pageSize: 50,
              total: payload.tickets?.length ?? 0,
              totalPages: 1,
            }
          );
          setCounters(
            payload.counters ?? {
              open: 0,
              in_progress: 0,
              closed: 0,
              all: 0,
            }
          );
          setSelectedTicketId((current) => current ?? payload.tickets?.[0]?.id ?? null);
        }
      } catch {
        if (active) setTickets([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTickets();

    return () => {
      active = false;
    };
  }, [audience, deferredQuery, filter, page]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets]
  );

  useEffect(() => {
    if ((!selectedTicketId || !selectedTicket) && tickets[0]) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [selectedTicket, selectedTicketId, tickets]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, filter]);

  async function refreshTickets(nextSelectedId?: string | null) {
    const params = new URLSearchParams({
      audience,
      page: String(page),
      pageSize: "50",
      status: filter,
    });
    if (deferredQuery.trim()) {
      params.set("query", deferredQuery.trim());
    }

    const response = await fetch(`/api/support/tickets?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) return;

    const payload = (await response.json()) as {
      tickets?: SupportTicket[];
      pagination?: Pagination;
      counters?: TicketCounters;
    };
    setTickets(payload.tickets ?? []);
    if (payload.pagination) setPagination(payload.pagination);
    if (payload.counters) setCounters(payload.counters);
    setSelectedTicketId(nextSelectedId ?? (payload.tickets?.[0]?.id ?? null));
  }

  async function uploadAttachment(ticketId: string) {
    if (!replyAttachment) return;

    const formData = new FormData();
    formData.set("file", replyAttachment);
    formData.set("displayName", replyAttachment.name);
    formData.set("description", replyBody.trim() || replyAttachment.name);
    formData.set("category", "Suporte");

    setAttachmentProgress(0);
    await uploadFormDataWithProgress(
      `/api/support/tickets/${ticketId}/documents`,
      formData,
      setAttachmentProgress
    );
  }

  async function openTicket(ticketId: string) {
    setSelectedTicketId(ticketId);
    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, unreadCount: 0 } : ticket
      )
    );

    await fetch(`/api/support/tickets/${ticketId}/read`, {
      method: "PATCH",
    });
  }

  async function sendReply() {
    if (!selectedTicket || (!replyBody.trim() && !replyAttachment)) return;

    setSendingReply(true);
    try {
      if (replyAttachment) {
        await uploadAttachment(selectedTicket.id);
      }

      if (replyBody.trim()) {
        const response = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: replyBody.trim() }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Nao foi possivel enviar a mensagem");
        }
      }

      setReplyBody("");
      setReplyAttachment(null);
      await refreshTickets(selectedTicket.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Nao foi possivel concluir a acao");
    } finally {
      setSendingReply(false);
      setAttachmentProgress(null);
    }
  }

  async function updateTicketStatus(status: TicketStatus) {
    if (!selectedTicket || audience !== "staff") return;

    const response = await fetch(`/api/support/tickets/${selectedTicket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      window.alert(payload.error || "Nao foi possivel atualizar o chamado");
      return;
    }

    await refreshTickets(selectedTicket.id);
  }

  async function createTicket() {
    if (audience !== "client" || !newSubject.trim() || !newMessage.trim()) return;

    const response = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: newSubject.trim(),
        message: newMessage.trim(),
        priority: newPriority,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      window.alert(payload.error || "Nao foi possivel abrir o chamado");
      return;
    }

    setNewSubject("");
    setNewMessage("");
    setNewPriority("medium");
    await refreshTickets(null);
  }

  const selectedUnread = selectedTicket?.unreadCount ?? 0;

  function openAttachment(documentId: string, download = false) {
    const url = `/api/documents/${documentId}/file${download ? "?download=1" : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,#08111f_0%,#091527_45%,#07101c_100%)] px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(13,24,42,0.96),rgba(8,18,32,0.92))] shadow-[0_24px_90px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-5 border-b border-white/6 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300/70">
              Suporte
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(["all", "open", "in_progress", "closed"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "shrink-0 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                  filter === value
                    ? "border-cyan-400/30 bg-cyan-500/12 text-cyan-300"
                    : "border-white/8 bg-white/4 text-slate-400 hover:bg-white/8 hover:text-slate-100"
                )}
              >
                {value === "all"
                  ? "Todos"
                  : value === "open"
                    ? "Abertos"
                    : value === "in_progress"
                      ? "Em atendimento"
                      : "Resolvidos"}
              </button>
            ))}
          </div>
        </div>

        {audience === "client" && (
          <div className="border-b border-white/6 px-5 py-5">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_180px_auto]">
              <input
                value={newSubject}
                onChange={(event) => setNewSubject(event.target.value)}
                placeholder="Assunto do chamado"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <input
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                placeholder="Descreva o que aconteceu"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <select
                value={newPriority}
                onChange={(event) => setNewPriority(event.target.value as TicketPriority)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none"
              >
                <option value="low">Baixa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
              <button
                type="button"
                onClick={createTicket}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-4 py-3 text-sm font-bold text-white"
              >
                <Send className="h-4 w-4" />
                Abrir chamado
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 p-5 md:grid-cols-4">
          {[
            ["Abertos", counters.open],
            ["Em atendimento", counters.in_progress],
            ["Resolvidos", counters.closed],
            ["Todos", counters.all],
          ].map(([label, value]) => (
            <article
              key={label}
              className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,39,0.96),rgba(8,18,32,0.92))] px-5 py-5"
            >
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-black text-white">{value}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-5 px-5 pb-5 lg:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,20,36,0.98),rgba(7,15,28,0.94))]">
            <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-white">Chamados recentes</h2>
                <p className="text-sm text-slate-500">{pagination.total} chamado(s)</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                <Filter className="h-4 w-4" />
              </div>
            </div>

            <div className="border-b border-white/6 px-5 py-4">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-400">
                <Search className="h-4 w-4 shrink-0" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar cliente, assunto ou mensagem..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-4">
              {loading ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/3 px-5 py-10 text-center text-sm text-slate-500">
                  Carregando chamados...
                </div>
              ) : tickets.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/3 px-5 py-10 text-center text-sm text-slate-500">
                  Nenhum chamado encontrado.
                </div>
              ) : (
                tickets.map((ticket) => {
                  const active = selectedTicketId === ticket.id;
                  const unread = ticket.unreadCount > 0;

                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => void openTicket(ticket.id)}
                      className={cn(
                        "group relative w-full rounded-[1.5rem] border p-4 text-left transition",
                        active
                          ? "border-cyan-400/30 bg-cyan-500/10"
                          : "border-white/8 bg-white/3 hover:-translate-y-0.5 hover:border-cyan-400/20 hover:bg-white/5"
                      )}
                    >
                      {unread && !active && (
                        <span className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.28em] text-rose-300">
                          <span className="h-2 w-2 rounded-full bg-rose-400" />
                          Novo
                        </span>
                      )}

                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-cyan-300">
                          <MessagesSquare className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1 pr-16">
                          <p className="truncate text-sm font-bold uppercase tracking-tight text-white">
                            {audience === "staff" ? ticket.client.name : ticket.subject}
                          </p>
                          <p className="mt-1 truncate text-sm text-slate-400">
                            {audience === "staff" ? ticket.subject : ticket.message}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.28em]",
                            statusTone(ticket.status, active)
                          )}
                        >
                          {statusLabel(ticket.status)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.28em]",
                            priorityTone(ticket.priority)
                          )}
                        >
                          {priorityLabel(ticket.priority)}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-4 text-xs text-slate-500">
                        <span>Atualizado em {formatDateTime(ticket.updatedAt)}</span>
                        <span className="inline-flex items-center gap-1 text-cyan-300">
                          <Clock3 className="h-3.5 w-3.5" />
                          Abrir
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-white/6 px-4 py-4">
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-300">
                <span>
                  Pagina {pagination.page} de {pagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1 || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/4 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages || loading}
                    onClick={() =>
                      setPage((current) => Math.min(pagination.totalPages, current + 1))
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/4 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Proxima
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,20,36,0.98),rgba(7,15,28,0.94))]">
            {selectedTicket ? (
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-4 border-b border-white/6 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300/70">
                      Chamado selecionado
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                      {selectedTicket.subject}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">{selectedTicket.client.name}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {selectedUnread} nao lido(s)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {audience === "staff" && (
                      <button
                        type="button"
                        onClick={() => void updateTicketStatus("closed")}
                        className="flex h-10 items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 text-sm text-emerald-300"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Resolver
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedTicketId(null)}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {audience === "staff" && (
                  <div className="grid gap-4 border-b border-white/6 px-5 py-4 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => void updateTicketStatus("open")}
                      className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-left"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                        Status
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">Aberto</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateTicketStatus("in_progress")}
                      className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-left"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                        Status
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">Em atendimento</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateTicketStatus("closed")}
                      className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-left"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                        Status
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">Resolvido</p>
                    </button>
                  </div>
                )}

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                  {selectedTicket.documents.length > 0 && (
                    <div className="rounded-[1.4rem] border border-white/8 bg-white/4 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300/70">
                            Anexos
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Arquivos vinculados ao chamado e ao historico.
                          </p>
                        </div>
                        <div className="text-sm text-slate-500">{selectedTicket.documents.length}</div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {selectedTicket.documents.map((document) => (
                          <div
                            key={document.id}
                            className="rounded-[1.35rem] border border-white/8 bg-white/4 px-4 py-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">
                                  {document.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">{document.description}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.24em]">
                                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">
                                    {document.category}
                                  </span>
                                  <span className="rounded-full border border-white/8 bg-black/10 px-2.5 py-1 text-slate-400">
                                    {document.authorName}
                                  </span>
                                </div>
                              </div>

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                                <Paperclip className="h-4 w-4" />
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/6 pt-3">
                              <span className="text-xs text-slate-500">
                                {formatDateTime(document.createdAt)}
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openAttachment(document.documentId)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/8"
                                >
                                  Abrir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openAttachment(document.documentId, true)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/15"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Baixar
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTicket.messages.map((message) => {
                    const isClient = message.authorRole === "client";
                    const isSystem = message.authorRole === "system";

                    if (isSystem) {
                      return (
                        <div key={message.id} className="flex justify-center">
                          <div className="rounded-full border border-white/8 bg-white/4 px-4 py-2 text-xs font-semibold text-slate-400">
                            {message.body}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-3",
                          isClient ? "justify-start" : "justify-end"
                        )}
                      >
                        {isClient && (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-cyan-300">
                            <UserRound className="h-4 w-4" />
                          </div>
                        )}

                        <div
                          className={cn(
                            "max-w-[80%] rounded-[1.4rem] border px-4 py-4",
                            isClient
                              ? "border-white/8 bg-white/4"
                              : "border-cyan-400/20 bg-cyan-500/10"
                          )}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-bold text-white">{message.authorName}</p>
                            <p className="text-xs text-slate-500">{formatDateTime(message.createdAt)}</p>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{message.body}</p>
                        </div>

                        {!isClient && (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                            <CheckCheck className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-white/6 px-5 py-5">
                  <div className="flex items-start gap-3 rounded-[1.4rem] border border-white/8 bg-white/4 px-4 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-cyan-300">
                      <CircleAlert className="h-4 w-4" />
                    </div>
                    <div className="w-full">
                      <p className="text-sm font-semibold text-white">
                        {audience === "staff" ? "Responder chamado" : "Enviar mensagem"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {audience === "staff"
                          ? "A resposta vai para o cliente e atualiza o historico."
                          : "Sua mensagem sera enviada para a contabilidade."}
                      </p>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <textarea
                          value={replyBody}
                          onChange={(event) => setReplyBody(event.target.value)}
                          rows={3}
                          placeholder="Digite sua mensagem..."
                          className="min-h-[96px] flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                        />
                        <div className="flex flex-col gap-3 sm:w-[320px]">
                          <UploadDropzone
                            title="Anexo opcional"
                            description="Arraste o arquivo aqui ou clique para escolher. O anexo vai junto no chamado."
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
                            file={replyAttachment}
                            progress={attachmentProgress}
                            uploading={sendingReply}
                            compact
                            onFileChange={setReplyAttachment}
                          />

                          <button
                            type="button"
                            onClick={() => void sendReply()}
                            disabled={sendingReply}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:h-auto"
                          >
                            <Send className="h-4 w-4" />
                            {sendingReply ? "Enviando..." : "Enviar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[520px] items-center justify-center px-5 py-10 text-center">
                <div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
                    <MessagesSquare className="h-7 w-7" />
                  </div>
                  <h2 className="mt-4 text-2xl font-black text-white">Nenhum chamado selecionado</h2>
                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    Selecione um chamado da lista para responder, acompanhar o historico e
                    atualizar o status.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
