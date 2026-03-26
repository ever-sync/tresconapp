"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";

type ParametrizationKind = "dre" | "patrimonial" | "dfc";

type AccountOption = {
  id: string;
  code: string;
  reducedCode: string | null;
  name: string;
  reportCategory: string | null;
  reportType: string | null;
  level: number;
};

type AccountsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function kindLabel(kind: ParametrizationKind) {
  if (kind === "dre") return "DRE";
  if (kind === "patrimonial") return "Patrimonial";
  return "DFC";
}

export function ParametrizationAddButton({
  kind,
  target,
  label = "Adicionar conta",
  disabled = false,
  onSaved,
  onSavedMany,
}: {
  kind: ParametrizationKind;
  target: string;
  label?: string;
  disabled?: boolean;
  onSaved?: (account: AccountOption) => void;
  onSavedMany?: (accounts: AccountOption[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [pagination, setPagination] = useState<AccountsPagination>({
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 1,
  });
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<AccountOption[]>([]);
  const [saving, setSaving] = useState(false);
  const lastToggledIndexRef = useRef<number | null>(null);

  const selectedAccountIds = useMemo(
    () => new Set(selectedAccounts.map((account) => account.id)),
    [selectedAccounts]
  );
  const selectedCount = selectedAccounts.length;
  const primarySelectedAccount = selectedAccounts[0] ?? null;

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAccountsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("kind", kind);
        params.set("target", target);
        params.set("page", String(page));
        params.set("pageSize", "30");
        if (query.trim()) params.set("query", query.trim());

        const response = await fetch(`/api/parametrization/accounts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Nao foi possivel carregar as contas");
        }

        const payload = (await response.json()) as {
          accounts?: AccountOption[];
          pagination?: AccountsPagination;
        };
        setAccounts(payload.accounts ?? []);
        setPagination(
          payload.pagination ?? {
            page,
            pageSize: 30,
            total: payload.accounts?.length ?? 0,
            totalPages: 1,
          }
        );
      } catch (err) {
        if ((err as DOMException)?.name !== "AbortError") {
          console.error(err);
          setAccounts([]);
          setPagination({
            page: 1,
            pageSize: 30,
            total: 0,
            totalPages: 1,
          });
        }
      } finally {
        setAccountsLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [kind, open, page, query, target]);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setPage(1);
    setAccounts([]);
    setPagination({
      page: 1,
      pageSize: 30,
      total: 0,
      totalPages: 1,
    });
    setSelectedAccounts([]);
    lastToggledIndexRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPage(1);
  }, [open, query]);

  function toggleAccount(
    account: AccountOption,
    index: number,
    event?: React.MouseEvent<HTMLButtonElement>
  ) {
    setSelectedAccounts((current) => {
      const currentIds = new Set(current.map((item) => item.id));
      const shouldSelect = !currentIds.has(account.id);

      if (event?.shiftKey && lastToggledIndexRef.current !== null) {
        const start = Math.min(lastToggledIndexRef.current, index);
        const end = Math.max(lastToggledIndexRef.current, index);
        const range = accounts.slice(start, end + 1);

        if (shouldSelect) {
          const next = current.slice();
          for (const item of range) {
            if (!currentIds.has(item.id)) {
              currentIds.add(item.id);
              next.push(item);
            }
          }
          return next;
        }

        const rangeIds = new Set(range.map((item) => item.id));
        return current.filter((item) => !rangeIds.has(item.id));
      }

      if (!shouldSelect) {
        return current.filter((item) => item.id !== account.id);
      }

      return [...current, account];
    });

    lastToggledIndexRef.current = index;
  }

  function removeSelectedAccount(accountId: string) {
    setSelectedAccounts((current) => current.filter((item) => item.id !== accountId));
  }

  function selectVisibleAccounts() {
    setSelectedAccounts((current) => {
      const selectedIds = new Set(current.map((item) => item.id));
      const next = current.slice();

      for (const account of accounts) {
        if (!selectedIds.has(account.id)) {
          selectedIds.add(account.id);
          next.push(account);
        }
      }

      return next;
    });
  }

  function clearVisibleAccounts() {
    const visibleIds = new Set(accounts.map((account) => account.id));
    setSelectedAccounts((current) => current.filter((item) => !visibleIds.has(item.id)));
  }

  async function handleSave() {
    if (selectedAccounts.length === 0) {
      window.alert("Selecione pelo menos uma conta para continuar");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/parametrization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-mappings",
          kind,
          target,
          accountCodes: selectedAccounts.map((account) => account.code),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Nao foi possivel salvar o mapeamento");
      }

      if (onSavedMany) {
        onSavedMany(selectedAccounts);
      } else if (selectedAccounts.length === 1) {
        onSaved?.(selectedAccounts[0]);
      }
      setOpen(false);
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : "Falha ao salvar o mapeamento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen(true);
        }}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="h-3.5 w-3.5" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative z-10 my-auto flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.99),rgba(10,18,32,0.97))] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300/70">
                  {kindLabel(kind)}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  Mapear conta para {target}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Escolha uma conta do plano e grave o DE-PARA nesta categoria.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-5 overflow-hidden px-6 py-6 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="flex min-h-0 flex-col rounded-[1.5rem] border border-white/8 bg-white/4 p-4">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-400">
                  <Search className="h-4 w-4 shrink-0" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por codigo, reduzido ou nome..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    Clique para marcar. Use <span className="font-semibold text-slate-300">Shift</span> para selecionar em faixa.
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={selectVisibleAccounts}
                      disabled={accounts.length === 0}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Selecionar visiveis
                    </button>
                    <button
                      type="button"
                      onClick={clearVisibleAccounts}
                      disabled={accounts.length === 0 || selectedCount === 0}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Limpar visiveis
                    </button>
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {accountsLoading ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-10 text-center text-sm text-slate-500">
                      Carregando contas...
                    </div>
                  ) : accounts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-10 text-center text-sm text-slate-500">
                      Nenhuma conta encontrada.
                    </div>
                  ) : (
                    accounts.map((account, index) => {
                      const active = selectedAccountIds.has(account.id);
                      const selectedIndex = selectedAccounts.findIndex((item) => item.id === account.id);

                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={(event) => toggleAccount(account, index, event)}
                          className={[
                            "w-full rounded-2xl border px-4 py-4 text-left transition",
                            active
                              ? "border-cyan-400/30 bg-cyan-500/10"
                              : "border-white/8 bg-white/4 hover:border-cyan-400/20 hover:bg-white/5",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-bold uppercase tracking-tight text-white">
                                {account.code}
                              </p>
                              <p className="mt-1 text-sm text-slate-300">{account.name}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.24em]">
                                {account.reducedCode && (
                                  <span className="rounded-full border border-white/8 bg-black/10 px-2.5 py-1 text-slate-400">
                                    {account.reducedCode}
                                  </span>
                                )}
                                {account.reportCategory && (
                                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">
                                    {account.reportCategory}
                                  </span>
                                )}
                                {account.reportType && (
                                  <span className="rounded-full border border-white/8 bg-white/4 px-2.5 py-1 text-slate-400">
                                    {account.reportType}
                                  </span>
                                )}
                              </div>
                            </div>

                            {active && (
                              <div className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 px-2 text-cyan-300">
                                {selectedIndex >= 0 ? (
                                  <span className="text-xs font-black">{selectedIndex + 1}</span>
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/8 bg-black/10 px-3 py-3 text-xs text-slate-400">
                  <span>
                    Pagina {pagination.page} de {pagination.totalPages} • {pagination.total} conta(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={accountsLoading || pagination.page <= 1}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-bold uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((current) => Math.min(pagination.totalPages, current + 1))
                      }
                      disabled={accountsLoading || pagination.page >= pagination.totalPages}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-bold uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Proxima
                    </button>
                  </div>
                </div>
              </section>

              <aside className="flex min-h-0 h-full flex-col overflow-hidden rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,39,0.98),rgba(8,17,30,0.95))] p-5">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
                  Selecionadas
                </p>

                {selectedCount > 0 ? (
                  <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
                    <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                        Contas marcadas
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">{selectedCount}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {selectedCount === 1
                          ? "1 conta pronta para ser vinculada."
                          : `${selectedCount} contas prontas para serem vinculadas.`}
                      </p>
                    </div>

                    {primarySelectedAccount ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                            Primeira selecionada
                          </p>
                          <p className="mt-2 text-lg font-black text-white">
                            {primarySelectedAccount.code}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {primarySelectedAccount.name}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                              Reduzido
                            </p>
                            <p className="mt-2 text-sm font-bold text-white">
                              {primarySelectedAccount.reducedCode ?? "-"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                              Nivel
                            </p>
                            <p className="mt-2 text-sm font-bold text-white">
                              {primarySelectedAccount.level}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                        Destino
                      </p>
                      <p className="mt-2 text-sm font-bold text-cyan-300">{target}</p>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/8 bg-black/10 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Lista selecionada
                        </p>
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-cyan-300">
                          {selectedCount} item(ns)
                        </span>
                      </div>

                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {selectedAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white">{account.code}</p>
                              <p className="mt-1 truncate text-sm text-slate-400">{account.name}</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeSelectedAccount(account.id)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-200"
                              aria-label={`Remover ${account.code} da selecao`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-auto border-t border-white/8 pt-4">
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || selectedCount === 0}
                        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {selectedCount === 1
                          ? "Salvar mapeamento"
                          : `Salvar ${selectedCount} mapeamentos`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-10 text-center text-sm text-slate-500">
                    Selecione uma ou mais contas na lista para montar o lote de mapeamento.
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ParametrizationRemoveButton({
  kind,
  target,
  accountCode,
  disabled = false,
  onRemoved,
}: {
  kind: ParametrizationKind;
  target: string;
  accountCode: string;
  disabled?: boolean;
  onRemoved?: (accountCode: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    setLoading(true);
    try {
      const response = await fetch("/api/parametrization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove-mapping",
          kind,
          target,
          accountCode,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Nao foi possivel remover o mapeamento");
      }

      onRemoved?.(accountCode);
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : "Falha ao remover o mapeamento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleRemove()}
      disabled={disabled || loading}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300 transition hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Remover mapeamento"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

export function ParametrizationRemoveManyButton({
  kind,
  target,
  accountCodes,
  label = "Remover tudo",
  disabled = false,
  onRemovedMany,
}: {
  kind: ParametrizationKind;
  target: string;
  accountCodes: string[];
  label?: string;
  disabled?: boolean;
  onRemovedMany?: (accountCodes: string[]) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleRemoveMany() {
    if (accountCodes.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Remover ${accountCodes.length} conta(s) parametrizada(s) de ${target}?`
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/parametrization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove-mappings",
          kind,
          target,
          accountCodes,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Nao foi possivel remover os mapeamentos");
      }

      onRemovedMany?.(accountCodes);
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : "Falha ao remover os mapeamentos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleRemoveMany()}
      disabled={disabled || loading || accountCodes.length === 0}
      className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
