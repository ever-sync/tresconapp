"use client";

import Image from "next/image";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  FileText,
  FolderSearch,
  Search,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ClientDocument = {
  id: string;
  title: string;
  category: string;
  description: string;
  sentAt: string;
  size: string;
  mimeType: string;
  viewed: boolean;
};

type ClientInbox = {
  id: string;
  name: string;
  cnpj: string;
  industry: string;
  unreadCount: number;
  documentCount: number;
  documents: ClientDocument[];
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

function formatInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function toneForCategory(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("fiscal")) return "bg-rose-500/10 text-rose-300 ring-rose-400/20";
  if (normalized.includes("cont")) return "bg-cyan-500/10 text-cyan-300 ring-cyan-400/20";
  if (normalized.includes("finance")) return "bg-amber-500/10 text-amber-300 ring-amber-400/20";
  if (normalized.includes("pessoal")) return "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20";
  return "bg-slate-500/10 text-slate-300 ring-white/10";
}

function isPreviewableMimeType(mimeType: string) {
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/")
  );
}

export default function DocumentosPage() {
  const [clients, setClients] = useState<ClientInbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "50",
        });
        if (deferredQuery.trim()) {
          params.set("query", deferredQuery.trim());
        }

        const response = await fetch(`/api/documents?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load documents");

        const payload = (await response.json()) as {
          clients?: ClientInbox[];
          pagination?: Pagination;
        };
        if (active) {
          setClients(payload.clients ?? []);
          setPagination(
            payload.pagination ?? {
              page,
              pageSize: 50,
              total: payload.clients?.length ?? 0,
              totalPages: 1,
            }
          );
        }
      } catch {
        if (active) setClients([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [deferredQuery, page]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  useEffect(() => {
    if (!selectedClientId || selectedClient || clients.length === 0) return;
    setSelectedClientId(clients[0].id);
    setSelectedDocumentId(null);
  }, [clients, selectedClient, selectedClientId]);

  const selectedDocument = useMemo(() => {
    if (!selectedClient || !selectedDocumentId) return null;
    return selectedClient.documents.find((document) => document.id === selectedDocumentId) ?? null;
  }, [selectedClient, selectedDocumentId]);

  const selectedPreviewUrl = selectedDocument
    ? `/api/documents/${selectedDocument.id}/file`
    : null;
  const selectedDownloadUrl = selectedDocument
    ? `/api/documents/${selectedDocument.id}/file?download=1`
    : null;

  const unreadByClient = useMemo(() => {
    return Object.fromEntries(
      clients.map((client) => [
        client.id,
        client.unreadCount,
      ])
    ) as Record<string, number>;
  }, [clients]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery]);

  function openClient(clientId: string) {
    setSelectedClientId(clientId);
    setSelectedDocumentId(null);
  }

  function closeClient() {
    setSelectedClientId(null);
    setSelectedDocumentId(null);
  }

  function openDocument(clientId: string, documentId: string) {
    setClients((current) =>
      current.map((client) =>
        client.id === clientId
          ? {
              ...client,
              documents: client.documents.map((document) =>
                document.id === documentId ? { ...document, viewed: true } : document
              ),
            }
          : client
      )
    );

    setSelectedClientId(clientId);
    setSelectedDocumentId(documentId);

    void fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ viewed: true }),
    });
  }

  function closeDocument() {
    setSelectedDocumentId(null);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (selectedDocumentId) {
        closeDocument();
        return;
      }

      if (selectedClientId) {
        closeClient();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClientId, selectedDocumentId]);

  const currentDocumentCount = selectedClient?.documents.length ?? 0;
  const currentUnreadCount = selectedClient ? unreadByClient[selectedClient.id] ?? 0 : 0;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#08111f_0%,#0a1528_45%,#07101c_100%)] px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(13,24,42,0.96),rgba(8,18,32,0.92))] shadow-[0_24px_90px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-5 border-b border-white/6 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300/70">
              Documentos
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Arquivos dos Clientes
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Cada cliente pode enviar documentos com categoria, descriçao e data de envio.
              Ao abrir o arquivo, a marca de não visto some do card.
            </p>
          </div>

          <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-400 lg:w-auto">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar arquivo, categoria ou cliente..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Clientes com documentos</h2>
              <p className="text-sm text-slate-400">
                Clique em um card para ver os anexos recebidos.
            </p>
          </div>
          <div className="text-sm text-slate-500">
              {loading ? "Carregando..." : `${pagination.total} cliente(s)`}
          </div>
        </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {!loading && clients.length === 0 ? (
              <div className="col-span-full rounded-[1.5rem] border border-dashed border-white/10 bg-white/3 px-5 py-10 text-center text-sm text-slate-500">
                Nenhum documento encontrado.
              </div>
            ) : (
              clients.map((client) => {
                const unreadCount = unreadByClient[client.id] ?? 0;
                const latestDocument = [...client.documents].sort(
                  (left, right) =>
                    new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime()
                )[0];

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => openClient(client.id)}
                    className="group relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,20,36,0.98),rgba(7,15,28,0.94))] p-5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-cyan-400/25 hover:shadow-[0_24px_70px_rgba(0,0,0,0.3)]"
                  >
                    {unreadCount > 0 && (
                      <div className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300">
                        <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]" />
                        {unreadCount} novo{unreadCount > 1 ? "s" : ""}
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#1eabff_0%,#0e87ff_50%,#0a62ff_100%)] text-base font-black text-white shadow-[0_0_30px_rgba(14,165,233,0.35)]">
                        {formatInitials(client.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate pr-16 text-base font-extrabold uppercase tracking-tight text-white">
                          {client.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">{client.industry}</p>
                        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                          <FileText className="h-4 w-4" />
                          <span>CNPJ: {client.cnpj}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 border-t border-white/6 pt-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/6 bg-white/3 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Documentos
                        </p>
                        <p className="mt-2 text-xl font-black text-white">
                          {client.documentCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/6 bg-white/3 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Nao vistos
                        </p>
                        <p className="mt-2 text-xl font-black text-cyan-300">
                          {unreadCount}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                          Ultimo envio
                        </p>
                        <p className="mt-1 truncate font-medium text-slate-200">
                          {latestDocument?.title ?? "Nenhum documento"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-cyan-300">
                        <span className="text-xs font-semibold uppercase">Abrir</span>
                        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-4 py-3 text-sm text-slate-300">
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

      {selectedClient && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div onClick={closeClient} className="absolute inset-0" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.98),rgba(10,18,32,0.96))] shadow-[0_30px_120px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                    <FolderSearch className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">
                      {selectedClient.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {currentDocumentCount} arquivo(s) recebidos • {currentUnreadCount} não
                      visto(s)
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeClient}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                {selectedClient.documents.map((document) => {
                  const isUnread = !document.viewed;

                  return (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => openDocument(selectedClient.id, document.id)}
                      className={cn(
                        "rounded-[1.5rem] border p-5 text-left shadow-[0_16px_45px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5",
                        isUnread ? "border-cyan-400/25 bg-cyan-500/8" : "border-white/6 bg-white/3"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.28em] ring-1",
                                toneForCategory(document.category)
                              )}
                            >
                              {document.category}
                            </span>
                            {isUnread && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-500/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-rose-300">
                                <CircleAlert className="h-3.5 w-3.5" />
                                Não visto
                              </span>
                            )}
                          </div>
                          <h3 className="mt-4 truncate text-lg font-extrabold text-white">
                            {document.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {document.description}
                          </p>
                        </div>

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-cyan-300">
                          <Eye className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-white/6 pt-4 text-sm text-slate-400">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          <span>{formatDateTime(document.sentAt)}</span>
                        </div>
                        <span>{document.size}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDocument && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div onClick={closeDocument} className="absolute inset-0" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.99),rgba(10,18,32,0.97))] shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300/70">
                  Documento recebido
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  {selectedDocument.title}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{selectedClient.name}</p>
              </div>

              <button
                type="button"
                onClick={closeDocument}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/6 bg-white/3 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Categoria
                  </p>
                  <p className="mt-2 text-sm font-bold text-white">{selectedDocument.category}</p>
                </div>
                <div className="rounded-2xl border border-white/6 bg-white/3 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Data do envio
                  </p>
                  <p className="mt-2 text-sm font-bold text-white">
                    {formatDateTime(selectedDocument.sentAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/6 bg-white/3 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Tamanho
                  </p>
                  <p className="mt-2 text-sm font-bold text-white">{selectedDocument.size}</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-cyan-400/15 bg-cyan-500/6 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300/70">
                  Descrição
                </p>
                <p className="mt-3 text-base leading-7 text-slate-200">
                  {selectedDocument.description}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(8,19,36,0.95),rgba(6,14,27,0.95))] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                      Pré-visualização
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      Abra o arquivo real ou baixe o documento autêntico recebido do cliente.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectedPreviewUrl && window.open(selectedPreviewUrl, "_blank")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/4 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/8"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        selectedDownloadUrl && window.open(selectedDownloadUrl, "_blank", "noopener,noreferrer")
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300 transition hover:bg-cyan-500/15"
                    >
                      Baixar
                    </button>
                  </div>
                </div>
                <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-white/8 bg-black/20">
                  {selectedDocument && isPreviewableMimeType(selectedDocument.mimeType) ? (
                    selectedDocument.mimeType.startsWith("image/") ? (
                      <div className="relative h-[420px] w-full">
                        <Image
                          src={selectedPreviewUrl ?? ""}
                          alt={selectedDocument.title}
                          fill
                          unoptimized
                          sizes="(max-width: 1024px) 100vw, 768px"
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <iframe
                        src={selectedPreviewUrl ?? ""}
                        title={selectedDocument.title}
                        className="h-[420px] w-full border-0 bg-white"
                      />
                    )
                  ) : (
                    <div className="flex min-h-[240px] items-center justify-center px-5 py-8 text-center text-sm text-slate-500">
                      A visualização em tela não está disponível para este tipo de arquivo.
                      Use o botão Baixar para abrir o documento real.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-4 py-4 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-cyan-300" />
                  <span>Ao abrir este documento, ele passa a ser marcado como visto.</span>
                </div>
                <div className="font-medium text-white">{selectedClient.name.split(" ")[0]}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
