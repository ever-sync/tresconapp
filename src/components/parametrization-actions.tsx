"use client";

import { useEffect, useMemo, useState } from "react";
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
}: {
  kind: ParametrizationKind;
  target: string;
  label?: string;
  disabled?: boolean;
  onSaved?: (account: AccountOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAccountsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("kind", kind);
        if (query.trim()) params.set("query", query.trim());

        const response = await fetch(`/api/parametrization/accounts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Nao foi possivel carregar as contas");
        }

        const payload = (await response.json()) as { accounts?: AccountOption[] };
        setAccounts(payload.accounts ?? []);
      } catch (err) {
        if ((err as DOMException)?.name !== "AbortError") {
          console.error(err);
          setAccounts([]);
        }
      } finally {
        setAccountsLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [kind, open, query]);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setAccounts([]);
    setSelectedAccountId(null);
  }, [open]);

  useEffect(() => {
    if (accounts.length === 0) return;

    const stillVisible = accounts.some((account) => account.id === selectedAccountId);
    if (!stillVisible) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  async function handleSave() {
    if (!selectedAccount) {
      window.alert("Selecione uma conta para continuar");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/parametrization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-mapping",
          kind,
          target,
          accountCode: selectedAccount.code,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Nao foi possivel salvar o mapeamento");
      }

      if (selectedAccount) {
        onSaved?.(selectedAccount);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.99),rgba(10,18,32,0.97))] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
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

            <div className="grid gap-5 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-[1.5rem] border border-white/8 bg-white/4 p-4">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-400">
                  <Search className="h-4 w-4 shrink-0" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por codigo, reduzido ou nome..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                  />
                </div>

                <div className="mt-4 max-h-[56vh] space-y-2 overflow-y-auto pr-1">
                  {accountsLoading ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-10 text-center text-sm text-slate-500">
                      Carregando contas...
                    </div>
                  ) : accounts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-10 text-center text-sm text-slate-500">
                      Nenhuma conta encontrada.
                    </div>
                  ) : (
                    accounts.map((account) => {
                      const active = account.id === selectedAccountId;

                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => setSelectedAccountId(account.id)}
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
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              <aside className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,39,0.98),rgba(8,17,30,0.95))] p-5">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
                  Selecionada
                </p>

                {selectedAccount ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                        Codigo
                      </p>
                      <p className="mt-2 text-lg font-black text-white">{selectedAccount.code}</p>
                      <p className="mt-1 text-sm text-slate-400">{selectedAccount.name}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Reduzido
                        </p>
                        <p className="mt-2 text-sm font-bold text-white">
                          {selectedAccount.reducedCode ?? "-"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Nivel
                        </p>
                        <p className="mt-2 text-sm font-bold text-white">{selectedAccount.level}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                        Destino
                      </p>
                      <p className="mt-2 text-sm font-bold text-cyan-300">{target}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar mapeamento
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-10 text-center text-sm text-slate-500">
                    Selecione uma conta na lista para ver os detalhes.
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
