"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import {
  ParametrizationAddButton,
  ParametrizationRemoveButton,
  ParametrizationRemoveManyButton,
} from "@/components/parametrization-actions";
import { cn } from "@/lib/utils";

type DemoKey = "dre" | "patrimonial" | "dfc";

type AccountSnapshot = {
  code: string;
  reducedCode: string | null;
  name: string;
};

type CategoryCard = {
  key: string;
  title: string;
  mappedAccounts: AccountSnapshot[];
  description: string;
};

type GroupSection = {
  title: string;
  cards: CategoryCard[];
};

type DemoSection = {
  key: DemoKey;
  title: string;
  subtitle: string;
  description: string;
  tone: string;
  groups: GroupSection[];
  unmappedAccounts: AccountSnapshot[];
  derivedLines?: string[];
};

function countLabel(count: number) {
  return `${count} conta(s) mapeada(s)`;
}

function formatListLabel(account: AccountSnapshot) {
  const code = account.reducedCode || account.code;
  return `${code} - ${account.name}`;
}

function groupCardTitle(title: string) {
  return title;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSectionColor(index: number) {
  const palette = [
    "border-cyan-500/20 bg-cyan-500/8",
    "border-sky-500/20 bg-sky-500/8",
    "border-blue-500/20 bg-blue-500/8",
    "border-emerald-500/20 bg-emerald-500/8",
    "border-amber-500/20 bg-amber-500/8",
  ];

  return palette[index % palette.length];
}

function snapshotByCode(section: DemoSection, code: string) {
  for (const group of section.groups) {
    for (const card of group.cards) {
      const found = card.mappedAccounts.find((account) => account.code === code);
      if (found) return found;
    }
  }

  return section.unmappedAccounts.find((account) => account.code === code) ?? null;
}

function removeCodesFromSection(section: DemoSection, codes: Set<string>) {
  const groups = section.groups.map((group) => ({
    ...group,
    cards: group.cards.map((card) => ({
      ...card,
      mappedAccounts: card.mappedAccounts.filter((account) => !codes.has(account.code)),
    })),
  }));

  return {
    ...section,
    groups,
    unmappedAccounts: section.unmappedAccounts.filter((account) => !codes.has(account.code)),
  };
}

function appendUniqueAccounts(accounts: AccountSnapshot[], additions: AccountSnapshot[]) {
  const seen = new Set(accounts.map((account) => account.code));
  const result = accounts.slice();
  for (const account of additions) {
    if (seen.has(account.code)) continue;
    seen.add(account.code);
    result.push(account);
  }
  return result;
}

export function ParametrizationWorkspace({
  section: initialSection,
  isOffline,
}: {
  section: DemoSection;
  isOffline: boolean;
}) {
  const [section, setSection] = useState(initialSection);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const unmappedCount = useMemo(() => section.unmappedAccounts.length, [section.unmappedAccounts]);

  function handleAccountSaved(target: string, account: { code: string; reducedCode: string | null; name: string }) {
    const snapshot: AccountSnapshot = {
      code: account.code,
      reducedCode: account.reducedCode,
      name: account.name,
    };

    setSection((current) => {
      const withoutCode = removeCodesFromSection(current, new Set([snapshot.code]));
      return {
        ...withoutCode,
        groups: withoutCode.groups.map((group) => ({
          ...group,
          cards: group.cards.map((card) => {
            if (card.title !== target) return card;
            return {
              ...card,
              mappedAccounts: appendUniqueAccounts(
                card.mappedAccounts.filter((item) => item.code !== snapshot.code),
                [snapshot]
              ),
            };
          }),
        })),
      };
    });
  }

  function handleAccountRemoved(target: string, accountCode: string) {
    setSection((current) => {
      const removed = snapshotByCode(current, accountCode);
      const withoutCode = removeCodesFromSection(current, new Set([accountCode]));

      if (!removed) {
        return withoutCode;
      }

      return {
        ...withoutCode,
        unmappedAccounts: appendUniqueAccounts(withoutCode.unmappedAccounts, [removed]),
        groups: withoutCode.groups.map((group) => ({
          ...group,
          cards: group.cards.map((card) => ({
            ...card,
            mappedAccounts:
              card.title === target
                ? card.mappedAccounts.filter((item) => item.code !== accountCode)
                : card.mappedAccounts,
          })),
        })),
      };
    });
  }

  function handleAccountsRemovedMany(target: string, accountCodes: string[]) {
    const codeSet = new Set(accountCodes);

    setSection((current) => {
      const removedSnapshots = accountCodes
        .map((code) => snapshotByCode(current, code))
        .filter((item): item is AccountSnapshot => Boolean(item));
      const withoutCodes = removeCodesFromSection(current, codeSet);

      return {
        ...withoutCodes,
        unmappedAccounts: appendUniqueAccounts(withoutCodes.unmappedAccounts, removedSnapshots),
        groups: withoutCodes.groups.map((group) => ({
          ...group,
          cards: group.cards.map((card) => ({
            ...card,
            mappedAccounts:
              card.title === target
                ? card.mappedAccounts.filter((item) => !codeSet.has(item.code))
                : card.mappedAccounts,
          })),
        })),
      };
    });
  }

  return (
    <section
      id={section.key}
      className={cn(
        "rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(8,18,32,0.92))] shadow-[0_24px_90px_rgba(0,0,0,0.3)]",
        section.tone
      )}
    >
      <div className="px-5 py-5">
        <div className="space-y-5">
          {section.groups.map((group, index) => (
            <div key={group.title} className="rounded-[1.5rem] border border-white/8 bg-white/3 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                    {group.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Selecione as contas titulo que alimentam este bloco.
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.24em] text-slate-200",
                    resolveSectionColor(index)
                  )}
                >
                  {group.cards.length} itens
                </span>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {group.cards.map((card) => (
                  <article
                    key={card.key}
                    className="rounded-[1.4rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,39,0.98),rgba(8,17,30,0.95))] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-white">{groupCardTitle(card.title)}</h3>
                        <p className="mt-1 text-xs text-slate-500">{countLabel(card.mappedAccounts.length)}</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <ParametrizationAddButton
                          kind={section.key}
                          target={card.title}
                          disabled={isOffline}
                          onSaved={(account) => handleAccountSaved(card.title, account)}
                        />
                        <ParametrizationRemoveManyButton
                          kind={section.key}
                          target={card.title}
                          accountCodes={card.mappedAccounts.map((account) => account.code)}
                          disabled={isOffline || card.mappedAccounts.length === 0}
                          onRemovedMany={(codes) => handleAccountsRemovedMany(card.title, codes)}
                        />
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/6 bg-black/10 p-4">
                      <div className="space-y-3">
                        {card.mappedAccounts.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-500">
                            Nenhuma conta configurada nessa categoria.
                          </div>
                        ) : (
                          card.mappedAccounts.map((account) => (
                            <div
                              key={`${account.code}-${account.name}`}
                              className="rounded-[1.1rem] border border-white/8 bg-[#0b1525] px-4 py-3"
                            >
                              <div className="mb-2 text-[0.58rem] font-black uppercase tracking-[0.32em] text-slate-500">
                                Conta
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 rounded-2xl border border-white/8 bg-[#0f1a2b] px-4 py-3 text-sm text-slate-100">
                                  {formatListLabel(account)}
                                </div>
                                <ParametrizationRemoveButton
                                  kind={section.key}
                                  target={card.title}
                                  accountCode={account.code}
                                  onRemoved={(code) => handleAccountRemoved(card.title, code)}
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        {section.key !== "dre" && (
          <div className="mt-6 rounded-[1.6rem] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(42,35,20,0.96),rgba(32,26,16,0.92))] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
                  Contas nao mapeadas ({unmappedCount})
                </p>
                <p className="mt-1 text-xs text-amber-100/60">
                  Use a base de referencia para classificar rapidamente as contas sem destino.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-200 transition hover:bg-amber-500/15"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Revisar lista
              </button>
            </div>

            <div className="max-h-64 overflow-auto rounded-2xl border border-white/6 bg-black/20 p-4">
              <div className="space-y-3">
                {section.unmappedAccounts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-500">
                    Nenhuma conta configurada nessa categoria.
                  </div>
                ) : (
                  section.unmappedAccounts.map((account) => (
                    <div
                      key={`${account.code}-${account.name}`}
                      className="rounded-[1.1rem] border border-white/8 bg-[#0b1525] px-4 py-3"
                    >
                      <div className="mb-2 text-[0.58rem] font-black uppercase tracking-[0.32em] text-slate-500">
                        Conta
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 rounded-2xl border border-white/8 bg-[#0f1a2b] px-4 py-3 text-sm text-slate-100">
                          {formatListLabel(account)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {section.derivedLines && (
          <div className="mt-6 rounded-[1.6rem] border border-white/8 bg-white/4 p-4">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-slate-300">
              Linhas derivadas nao parametrizadas
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Essas linhas sao calculadas automaticamente pelo sistema.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {section.derivedLines.map((line) => (
                <span
                  key={line}
                  className="rounded-full border border-white/8 bg-black/15 px-3 py-2 text-xs font-semibold text-slate-200"
                >
                  {line}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
