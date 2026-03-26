"use client";

import Image from "next/image";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, FileText, Filter, Search, UploadCloud, X } from "lucide-react";

import { UploadDropzone } from "@/components/upload-dropzone";
import { uploadFormDataWithProgress } from "@/lib/upload-request";
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
  viewedAt: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Counters = {
  total: number;
  unread: number;
  viewed: number;
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

export function ClientDocumentsManager() {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
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
  const [counters, setCounters] = useState<Counters>({
    total: 0,
    unread: 0,
    viewed: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Geral");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery]);

  useEffect(() => {
    let active = true;

    async function loadDocuments() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "50",
        });
        if (deferredQuery.trim()) {
          params.set("query", deferredQuery.trim());
        }

        const response = await fetch(`/api/client/documents?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar documentos");

        const payload = (await response.json()) as {
          documents?: ClientDocument[];
          counters?: Counters;
          pagination?: Pagination;
        };
        if (active) {
          setDocuments(payload.documents ?? []);
          setCounters(
            payload.counters ?? {
              total: 0,
              unread: 0,
              viewed: 0,
            }
          );
          setPagination(
            payload.pagination ?? {
              page,
              pageSize: 50,
              total: payload.documents?.length ?? 0,
              totalPages: 1,
            }
          );
        }
      } catch {
        if (active) {
          setDocuments([]);
          setCounters({ total: 0, unread: 0, viewed: 0 });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDocuments();

    return () => {
      active = false;
    };
  }, [deferredQuery, page]);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? null,
    [documents, selectedId]
  );

  const selectedPreviewUrl = selectedDocument
    ? `/api/documents/${selectedDocument.id}/file`
    : null;
  const selectedDownloadUrl = selectedDocument
    ? `/api/documents/${selectedDocument.id}/file?download=1`
    : null;

  async function uploadDocument() {
    if (!file) {
      window.alert("Selecione um arquivo para enviar");
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("category", category);
      formData.set("description", description.trim() || file.name);

      const payload = await uploadFormDataWithProgress<{ document?: ClientDocument }>(
        "/api/client/documents",
        formData,
        setUploadProgress
      );

      setFile(null);
      setDescription("");
      setCategory("Geral");
      setPage(1);
      if (payload.document) {
        setDocuments((current) => [payload.document as ClientDocument, ...current].slice(0, 50));
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Falha ao enviar o arquivo");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,#08111f_0%,#091527_45%,#07101c_100%)] px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(13,24,42,0.96),rgba(8,18,32,0.92))] shadow-[0_24px_90px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-5 border-b border-white/6 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300/70">
              Documentos
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Envio de Documentos
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Envie arquivos com categoria e descricao. Depois de enviados, eles ficam
              disponiveis para a contabilidade analisar.
            </p>
          </div>

          <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-400 lg:w-auto">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar arquivo, categoria ou descricao..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="grid gap-5 border-b border-white/6 px-5 py-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,39,0.96),rgba(8,18,32,0.92))] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Novo envio</h2>
                <p className="text-sm text-slate-400">Selecione o arquivo e envie para analise.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                <UploadCloud className="h-4 w-4" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <UploadDropzone
                  title="Arquivo"
                  description="Arraste e solte o arquivo ou clique para escolher. Apenas um anexo por envio."
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
                  file={file}
                  progress={uploadProgress}
                  uploading={submitting}
                  onFileChange={setFile}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Categoria
                </label>
                <input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Ex: Fiscal"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Descricao
                </label>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Detalhe o conteudo do arquivo"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={uploadDocument}
              disabled={submitting}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" />
              {submitting ? "Enviando..." : "Enviar documento"}
            </button>
          </div>

          <div className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,39,0.96),rgba(8,18,32,0.92))] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Status do envio</h2>
                <p className="text-sm text-slate-400">Documentos aguardando analise ou ja vistos.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                <Filter className="h-4 w-4" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Total de arquivos
                </p>
                <p className="mt-2 text-2xl font-black text-white">{counters.total}</p>
              </div>
              <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Vistos pela contabilidade
                </p>
                <p className="mt-2 text-2xl font-black text-emerald-300">
                  {counters.viewed}
                </p>
              </div>
              <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Aguardando analise
                </p>
                <p className="mt-2 text-2xl font-black text-cyan-300">
                  {counters.unread}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Documentos enviados</h2>
              <p className="text-sm text-slate-400">
                Clique em um card para ver os detalhes do arquivo.
              </p>
            </div>
            <div className="text-sm text-slate-500">
              {loading ? "Carregando..." : `${pagination.total} arquivo(s)`}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {!loading && documents.length === 0 ? (
              <div className="col-span-full rounded-[1.5rem] border border-dashed border-white/10 bg-white/3 px-5 py-10 text-center text-sm text-slate-500">
                Nenhum documento encontrado.
              </div>
            ) : (
              documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => setSelectedId(document.id)}
                  className="group relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,20,36,0.98),rgba(7,15,28,0.94))] p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-400/25"
                >
                  {!document.viewed && (
                    <div className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      Nao visto
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#1eabff_0%,#0e87ff_50%,#0a62ff_100%)] text-base font-black text-white">
                      <FileText className="h-6 w-6" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate pr-16 text-base font-extrabold uppercase tracking-tight text-white">
                        {document.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">{document.description}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.28em] ring-1",
                        toneForCategory(document.category)
                      )}
                    >
                      {document.category}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.28em]",
                        document.viewed
                          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                          : "border-amber-400/20 bg-amber-500/10 text-amber-300"
                      )}
                    >
                      {document.viewed ? "Visualizado" : "Aguardando"}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        Enviado em
                      </p>
                      <p className="mt-1 truncate text-slate-200">
                        {formatDateTime(document.sentAt)}
                      </p>
                    </div>
                    <span className="text-cyan-300">{document.size}</span>
                  </div>
                </button>
              ))
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

      {selectedDocument && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div onClick={() => setSelectedId(null)} className="absolute inset-0" aria-hidden="true" />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.99),rgba(10,18,32,0.97))] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300/70">
                  Documento enviado
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  {selectedDocument.title}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedDocument.viewed ? "Ja visualizado pela contabilidade" : "Aguardando analise"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
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
                    Envio
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
                  Descricao
                </p>
                <p className="mt-3 text-base leading-7 text-slate-200">
                  {selectedDocument.description}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(8,19,36,0.95),rgba(6,14,27,0.95))] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                      Pre-visualizacao
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      O arquivo pode ser aberto em tela quando o tipo permitir.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectedPreviewUrl && window.open(selectedPreviewUrl, "_blank")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/4 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/8"
                    >
                      <Eye className="h-3.5 w-3.5" />
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
                      A visualizacao em tela nao esta disponivel para este tipo de arquivo.
                      Use o botao Baixar para abrir o documento real.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-4 py-4 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-cyan-300" />
                  <span>
                    Quando a contabilidade abrir este documento, ele muda para visualizado.
                  </span>
                </div>
                <div className="font-medium text-white">{selectedDocument.size}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
