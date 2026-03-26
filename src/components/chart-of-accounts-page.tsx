"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Loader2, Plus, Search, UploadCloud, X } from "lucide-react";
import * as XLSX from "xlsx";

import { cn } from "@/lib/utils";

type AccountRow = {
  id: string;
  code: string;
  reducedCode: string;
  level: number;
  type: "T" | "A";
  description: string;
  alias: string;
  report: string;
};

type AccountForm = {
  code: string;
  reducedCode: string;
  level: string;
  type: "T" | "A";
  description: string;
  alias: string;
  report: string;
};

type ImportedRow = Record<string, unknown>;

type RemoteResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: AccountRow[];
};

const PAGE_SIZE = 200;

const blankForm: AccountForm = {
  code: "",
  reducedCode: "",
  level: "1",
  type: "A",
  description: "",
  alias: "",
  report: "Balanco Patrimonial",
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getRowValue(row: ImportedRow, aliases: string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeText(key), value] as const);
  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias);
    const found = normalizedEntries.find(([key]) => key === normalizedAlias);
    if (found) {
      return found[1];
    }
  }
  return "";
}

function parseImportedAccounts(rows: ImportedRow[]): AccountRow[] {
  return rows
    .map((row, index) => {
      const code = String(getRowValue(row, ["codigo", "código", "code", "cod"])).trim();
      const reducedCode = String(
        getRowValue(row, ["cod. red.", "cód. red.", "codigo reduzido", "código reduzido", "reduced code", "reduced"])
      ).trim();
      const rawLevel = String(getRowValue(row, ["nivel", "nível", "niv", "level"])).trim();
      const description = String(
        getRowValue(row, ["descricao", "descrição", "nome", "conta", "description"])
      ).trim();
      const alias = String(getRowValue(row, ["apelido", "alias", "abreviacao", "abreviação"])).trim();
      const report = String(getRowValue(row, ["relatorio", "relatório", "report"])).trim();
      const rawType = String(getRowValue(row, ["tipo", "type"])).trim().toUpperCase();

      if (!code && !description) {
        return null;
      }

      const level = Number(rawLevel) || Math.max(1, code.split(".").length || 1);
      const type: "T" | "A" =
        rawType === "T" || rawType === "TITULO" || rawType.includes("TIT") ? "T" : "A";

      return {
        id: crypto.randomUUID(),
        code: code || `import-${index + 1}`,
        reducedCode: reducedCode || "-",
        level,
        type: level >= 5 && type !== "T" ? "A" : type,
        description: description || "Conta importada",
        alias: alias || "-",
        report: report || "Balanco Patrimonial",
      } satisfies AccountRow;
    })
    .filter((row): row is AccountRow => Boolean(row));
}

function AccountTypeBadge({ type }: { type: "T" | "A" }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black",
        type === "T" ? "bg-cyan-500/12 text-cyan-300" : "bg-white/8 text-slate-300"
      )}
    >
      {type}
    </span>
  );
}

export function ChartOfAccountsPage() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importedFileName, setImportedFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<AccountForm>(blankForm);
  const [mode, setMode] = useState<"remote" | "local">("remote");

  useEffect(() => {
    let cancelled = false;

    async function fetchPage() {
      if (mode === "local") return;

      const isFirstPage = page === 1;
      if (isFirstPage) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await fetch(
          `/api/chart-of-accounts?page=${page}&pageSize=${PAGE_SIZE}&query=${encodeURIComponent(deferredQuery)}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("Falha ao carregar o plano de contas.");
        }

        const data = (await response.json()) as RemoteResponse;
        if (cancelled) return;

        setTotal(data.total);
        setTotalPages(data.totalPages);
        setRows((current) => (isFirstPage ? data.rows : [...current, ...data.rows]));
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          window.alert(error instanceof Error ? error.message : "Falha ao carregar o plano de contas.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    fetchPage();

    return () => {
      cancelled = true;
    };
  }, [page, deferredQuery, mode]);

  useEffect(() => {
    if (mode !== "remote") return;
    setRows([]);
    setPage(1);
    setTotal(0);
    setTotalPages(1);
  }, [deferredQuery, mode]);

  const filteredLocalRows = useMemo(() => {
    if (mode !== "local") return rows;
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) return rows;

    return rows.filter((row) =>
      [row.code, row.reducedCode, row.description, row.alias, row.report]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [rows, deferredQuery, mode]);

  const visibleRows = mode === "local" ? filteredLocalRows : rows;
  const totalVisible = mode === "local" ? filteredLocalRows.length : total;

  function updateForm<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function formatCode(value: string) {
    return value.replace(/[^\d.]/g, "");
  }

  function handleImportClick() {
    importInputRef.current?.click();
  }

  async function handleImportChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Nenhuma planilha encontrada no arquivo.");
      }

      const sheet = workbook.Sheets[sheetName];
      const imported = XLSX.utils.sheet_to_json<ImportedRow>(sheet, { defval: "" });
      const parsedRows = parseImportedAccounts(imported);

      if (parsedRows.length === 0) {
        throw new Error("Nao foi possivel identificar contas na planilha.");
      }

      setMode("local");
      setRows(parsedRows);
      setTotal(parsedRows.length);
      setTotalPages(1);
      setImportedFileName(file.name);
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : "Falha ao importar planilha.");
    } finally {
      setImporting(false);
      event.currentTarget.value = "";
    }
  }

  function closeCreateModal() {
    setCreateOpen(false);
    setForm(blankForm);
  }

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMode("local");
    setRows((current) => [
      {
        id: crypto.randomUUID(),
        code: form.code || "00",
        reducedCode: form.reducedCode || "-",
        level: Number(form.level) || 1,
        type: form.type,
        description: form.description || "Nova conta",
        alias: form.alias || "-",
        report: form.report || "Balanco Patrimonial",
      },
      ...current,
    ]);
    setTotal((current) => current + 1);
    setTotalPages(1);

    closeCreateModal();
  }

  function handleResetRemoteMode() {
    setImportedFileName("");
    setMode("remote");
    setRows([]);
    setTotal(0);
    setTotalPages(1);
    setPage(1);
  }

  const canLoadMore = mode === "remote" && page < totalPages;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Plano de Contas</h1>
            <p className="mt-1 text-sm text-slate-400">
              Plano compartilhado do escritorio para todos os clientes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-500">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar codigo, descricao..."
                className="w-64 bg-transparent text-sm outline-none placeholder:text-slate-600"
              />
            </div>

            <button
              type="button"
              onClick={handleImportClick}
              disabled={importing}
              className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <UploadCloud className={cn("h-4 w-4", importing && "animate-pulse")} />
              {importing ? "Importando..." : "Importar Plano de Contas"}
            </button>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-3 text-sm font-bold text-cyan-300 transition hover:bg-cyan-500/15"
            >
              <Plus className="h-4 w-4" />
              Criar Conta
            </button>
          </div>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleImportChange}
        />

        <div className="mt-6 overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0b1424] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#091223] px-5 py-4">
            <p className="text-sm font-bold text-slate-100">Plano de Contas</p>
            <p className="text-sm text-slate-500">
              Exibindo {visibleRows.length} de {totalVisible}
            </p>
          </div>

          {loading ? (
            <div className="flex h-[240px] items-center justify-center gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando plano de contas...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1320px]">
                <div className="grid grid-cols-[150px_120px_70px_80px_minmax(360px,1fr)_170px_210px] border-b border-white/10 bg-[#091223] px-6 py-4 text-[0.72rem] font-black uppercase tracking-[0.24em] text-slate-400">
                  <div>Codigo</div>
                  <div>Cod. Red.</div>
                  <div>Niv</div>
                  <div>Tipo</div>
                  <div>Descricao</div>
                  <div>Apelido</div>
                  <div>Relatorio</div>
                </div>

                <div className="max-h-[62vh] divide-y divide-white/8 overflow-y-auto bg-[#0b1424]">
                  {visibleRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[150px_120px_70px_80px_minmax(360px,1fr)_170px_210px] items-center px-6 py-4 text-sm transition hover:bg-white/5"
                    >
                      <div className="font-bold text-cyan-300">{row.code}</div>
                      <div className="font-semibold text-slate-500">{row.reducedCode}</div>
                      <div className="font-semibold text-slate-500">{row.level}</div>
                      <div>
                        <AccountTypeBadge type={row.type} />
                      </div>
                      <div className={cn("font-semibold text-slate-100", row.level > 1 && "pl-4")}>
                        {row.description}
                      </div>
                      <div className="font-medium text-slate-500">{row.alias}</div>
                      <div className="font-medium text-slate-500">{row.report}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 text-sm text-slate-400">
            <div className="flex items-center gap-3">
              {importedFileName ? (
                <>
                  <span>
                    Arquivo selecionado:{" "}
                    <span className="font-medium text-slate-200">{importedFileName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetRemoteMode}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
                  >
                    Voltar para base do banco
                  </button>
                </>
              ) : (
                <>Base carregada por paginação real para manter o payload leve.</>
              )}
            </div>

            {canLoadMore ? (
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={loadingMore}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingMore ? "Carregando..." : `Carregar mais ${PAGE_SIZE}`}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.98),rgba(10,18,32,0.96))] shadow-[0_30px_120px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white">Criar Conta</h2>
                  <p className="text-sm text-slate-400">
                    Estrutura visual pronta para voce me passar a logica depois
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-6 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Codigo</span>
                  <input
                    value={form.code}
                    onChange={(event) => updateForm("code", formatCode(event.target.value))}
                    placeholder="01.1.01.01.0001"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Cod. Red.</span>
                  <input
                    value={form.reducedCode}
                    onChange={(event) => updateForm("reducedCode", event.target.value)}
                    placeholder="10004"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Nivel</span>
                  <input
                    type="number"
                    min={1}
                    value={form.level}
                    onChange={(event) => updateForm("level", event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Tipo</span>
                  <select
                    value={form.type}
                    onChange={(event) => updateForm("type", event.target.value as "T" | "A")}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none"
                  >
                    <option value="T" className="bg-slate-900">
                      T
                    </option>
                    <option value="A" className="bg-slate-900">
                      A
                    </option>
                  </select>
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-300">Descricao</span>
                  <input
                    value={form.description}
                    onChange={(event) => updateForm("description", event.target.value)}
                    placeholder="Nome da conta"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Apelido</span>
                  <input
                    value={form.alias}
                    onChange={(event) => updateForm("alias", event.target.value)}
                    placeholder="CX"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Relatorio</span>
                  <input
                    value={form.report}
                    onChange={(event) => updateForm("report", event.target.value)}
                    placeholder="Balanco Patrimonial"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-white/8 pt-5">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-slate-300 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-4 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)]"
                >
                  <Plus className="h-4 w-4" />
                  Criar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
