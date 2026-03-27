"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";

import {
  ParametrizationAddButton,
  ParametrizationRemoveButton,
  ParametrizationRemoveManyButton,
} from "@/components/parametrization-actions";
import { DFC_VISIBLE_DERIVED_TARGETS, isDfcDerivedTarget } from "@/lib/dfc-lines";
import { cn } from "@/lib/utils";

type DemoKey = "dre" | "patrimonial" | "dfc";

type AccountSnapshot = {
  code: string;
  reducedCode: string | null;
  name: string;
};

type AccountGroup = {
  title: string;
  total: number;
  accounts: AccountSnapshot[];
};

type CategoryCard = {
  key: string;
  title: string;
  mappedAccounts: AccountSnapshot[];
  mappedGroups?: AccountGroup[];
  mappedCount: number;
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
  unmappedTotalCount: number;
  derivedLines?: string[];
};

type TargetOption = {
  groupTitle: string;
  title: string;
  key: string;
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
    cards: group.cards.map((card) => {
      const removedCount = card.mappedAccounts.filter((account) => codes.has(account.code)).length;
      return {
        ...card,
        mappedCount: Math.max(0, card.mappedCount - removedCount),
        mappedAccounts: card.mappedAccounts.filter((account) => !codes.has(account.code)),
      };
    }),
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

function firstTarget(section: DemoSection) {
  return section.groups[0]?.cards[0]?.title ?? "";
}

function createResolvedTargets(section: DemoSection) {
  const resolved = new Set<string>();

  for (const group of section.groups) {
    for (const card of group.cards) {
      if (card.mappedCount === 0 || card.mappedAccounts.length > 0) {
        resolved.add(card.title);
      }
    }
  }

  return resolved;
}

function findCardInSection(section: DemoSection, target: string) {
  for (const group of section.groups) {
    for (const card of group.cards) {
      if (card.title === target) {
        return {
          groupTitle: group.title,
          card,
        };
      }
    }
  }

  return null;
}

function replaceCardAccountsInSection(
  section: DemoSection,
  target: string,
  mappedAccounts: AccountSnapshot[],
  mappedCount = mappedAccounts.length,
  mappedGroups?: AccountGroup[]
) {
  return {
    ...section,
    groups: section.groups.map((group) => ({
      ...group,
      cards: group.cards.map((card) =>
        card.title === target
          ? {
              ...card,
              mappedCount,
              mappedAccounts,
              mappedGroups,
            }
          : card
      ),
    })),
  };
}

function clearCardAccountsInSection(section: DemoSection, targets: string[]) {
  const targetSet = new Set(targets);

  return {
    ...section,
    groups: section.groups.map((group) => ({
      ...group,
      cards: group.cards.map((card) =>
        targetSet.has(card.title)
          ? {
              ...card,
              mappedAccounts: [],
              mappedGroups: undefined,
            }
          : card
      ),
    })),
  };
}

export function ParametrizationWorkspace({
  section: initialSection,
  isOffline,
}: {
  section: DemoSection;
  isOffline: boolean;
}) {
  const [section, setSection] = useState(initialSection);
  const [selectedTarget, setSelectedTarget] = useState(firstTarget(initialSection));
  const [resolvedTargets, setResolvedTargets] = useState<Set<string>>(() =>
    createResolvedTargets(initialSection)
  );
  const [loadingTarget, setLoadingTarget] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState(firstTarget(initialSection));
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSection(initialSection);
    setSelectedTarget(firstTarget(initialSection));
    setResolvedTargets(createResolvedTargets(initialSection));
    setLoadingTarget(null);
    setSearchValue(firstTarget(initialSection));
    setPickerOpen(false);
  }, [initialSection]);

  const targetOptions = useMemo<TargetOption[]>(
    () =>
      section.groups.flatMap((group) =>
        group.cards.map((card) => ({
          groupTitle: group.title,
          title: card.title,
          key: card.key,
        }))
      ),
    [section.groups]
  );

  const selectedIndex = useMemo(
    () => targetOptions.findIndex((option) => option.title === selectedTarget),
    [selectedTarget, targetOptions]
  );

  const filteredTargetOptions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return targetOptions;
    }

    return targetOptions.filter((option) =>
      `${option.groupTitle} ${option.title}`.toLowerCase().includes(query)
    );
  }, [searchValue, targetOptions]);

  const visibleGroups = useMemo(() => {
    return section.groups
      .map((group) => ({
        ...group,
        cards: group.cards.filter((card) => card.title === selectedTarget),
      }))
      .filter((group) => group.cards.length > 0);
  }, [section.groups, selectedTarget]);

  const selectedCardInfo = useMemo(
    () => findCardInSection(section, selectedTarget),
    [section, selectedTarget]
  );

  useEffect(() => {
    setSearchValue(selectedTarget);
  }, [selectedTarget]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
        setSearchValue(selectedTarget);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedTarget]);

  useEffect(() => {
    if (!selectedTarget || isOffline || resolvedTargets.has(selectedTarget)) {
      return;
    }

    const selectedCard = selectedCardInfo?.card;
    if (!selectedCard) {
      return;
    }

    if (selectedCard.mappedCount === 0) {
      setResolvedTargets((current) => new Set([...current, selectedTarget]));
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadTargetAccounts() {
      setLoadingTarget(selectedTarget);

      try {
        const params = new URLSearchParams();
        params.set("kind", section.key);
        params.set("target", selectedTarget);

        const response = await fetch(`/api/parametrization/item?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Nao foi possivel carregar as contas do item");
        }

        const payload = (await response.json()) as {
          accounts?: AccountSnapshot[];
          groups?: AccountGroup[];
          total?: number;
        };

        if (!active) {
          return;
        }

        setSection((current) =>
          replaceCardAccountsInSection(
            current,
            selectedTarget,
            payload.accounts ?? [],
            payload.total ?? payload.accounts?.length ?? 0,
            payload.groups
          )
        );
        setResolvedTargets((current) => new Set([...current, selectedTarget]));
      } catch (err) {
        if ((err as DOMException)?.name !== "AbortError") {
          console.error(err);
          if (active) {
            setResolvedTargets((current) => new Set([...current, selectedTarget]));
          }
        }
      } finally {
        if (active) {
          setLoadingTarget(null);
        }
      }
    }

    void loadTargetAccounts();

    return () => {
      active = false;
      controller.abort();
    };
  }, [isOffline, resolvedTargets, section.key, selectedCardInfo, selectedTarget]);

  function handleAccountSaved(
    target: string,
    account: { code: string; reducedCode: string | null; name: string }
  ) {
    const snapshot: AccountSnapshot = {
      code: account.code,
      reducedCode: account.reducedCode,
      name: account.name,
    };

    setResolvedTargets((current) => new Set([...current, target]));
    setSection((current) => {
      const nextResolvedTargets =
        current.key === "dfc" ? DFC_VISIBLE_DERIVED_TARGETS.filter((item) => item !== target) : [];
      const targetAlreadyHadAccount = current.groups.some((group) =>
        group.cards.some(
          (card) =>
            card.title === target && card.mappedAccounts.some((item) => item.code === snapshot.code)
        )
      );
      const withoutCode = removeCodesFromSection(current, new Set([snapshot.code]));
      const invalidatedSection =
        nextResolvedTargets.length > 0
          ? clearCardAccountsInSection(withoutCode, nextResolvedTargets)
          : withoutCode;

      return {
        ...invalidatedSection,
        unmappedTotalCount:
          current.key === "dre"
            ? 0
            : Math.max(
                0,
                current.unmappedTotalCount -
                  (current.unmappedAccounts.some((item) => item.code === snapshot.code) ? 1 : 0)
              ),
        groups: invalidatedSection.groups.map((group) => ({
          ...group,
          cards: group.cards.map((card) => {
            if (card.title !== target) return card;
            return {
              ...card,
              mappedCount: targetAlreadyHadAccount ? card.mappedCount : card.mappedCount + 1,
              mappedAccounts: appendUniqueAccounts(
                card.mappedAccounts.filter((item) => item.code !== snapshot.code),
                [snapshot]
              ),
            };
          }),
        })),
      };
    });
    if (section.key === "dfc") {
      setResolvedTargets((current) => {
        const next = new Set(current);
        DFC_VISIBLE_DERIVED_TARGETS.forEach((item) => {
          if (item !== target) next.delete(item);
        });
        next.add(target);
        return next;
      });
    }
  }

  function handleAccountsSavedMany(
    target: string,
    accounts: { code: string; reducedCode: string | null; name: string }[]
  ) {
    const snapshots = Array.from(
      new Map(
        accounts.map((account) => [
          account.code,
          {
            code: account.code,
            reducedCode: account.reducedCode,
            name: account.name,
          } satisfies AccountSnapshot,
        ])
      ).values()
    );

    if (snapshots.length === 0) {
      return;
    }

    const codeSet = new Set(snapshots.map((account) => account.code));

    setSection((current) => {
      const withoutCodes = removeCodesFromSection(current, codeSet);
      const invalidatedSection =
        current.key === "dfc"
          ? clearCardAccountsInSection(
              withoutCodes,
              DFC_VISIBLE_DERIVED_TARGETS.filter((item) => item !== target)
            )
          : withoutCodes;
      const movedFromUnmapped = current.unmappedAccounts.filter((account) => codeSet.has(account.code)).length;

      return {
        ...invalidatedSection,
        unmappedTotalCount:
          current.key === "dre"
            ? 0
            : Math.max(0, current.unmappedTotalCount - movedFromUnmapped),
        groups: invalidatedSection.groups.map((group) => ({
          ...group,
          cards: group.cards.map((card) => {
            if (card.title !== target) return card;

            return {
              ...card,
              mappedCount: card.mappedCount + snapshots.length,
              mappedAccounts: appendUniqueAccounts(card.mappedAccounts, snapshots),
            };
          }),
        })),
      };
    });
    setResolvedTargets((current) => {
      const next = new Set(current);
      if (section.key === "dfc") {
        DFC_VISIBLE_DERIVED_TARGETS.forEach((item) => {
          if (item !== target) next.delete(item);
        });
      }
      next.add(target);
      return next;
    });
  }

  function handleAccountRemoved(accountCode: string) {
    setSection((current) => {
      const removed = snapshotByCode(current, accountCode);
      const withoutCode = removeCodesFromSection(current, new Set([accountCode]));
      const invalidatedSection =
        current.key === "dfc"
          ? clearCardAccountsInSection(withoutCode, DFC_VISIBLE_DERIVED_TARGETS)
          : withoutCode;

      if (!removed) {
        return invalidatedSection;
      }

      return {
        ...invalidatedSection,
        unmappedTotalCount: current.key === "dre" ? 0 : current.unmappedTotalCount + 1,
        unmappedAccounts: appendUniqueAccounts(invalidatedSection.unmappedAccounts, [removed]),
      };
    });
    if (section.key === "dfc") {
      setResolvedTargets((current) => {
        const next = new Set(current);
        DFC_VISIBLE_DERIVED_TARGETS.forEach((item) => next.delete(item));
        return next;
      });
    }
  }

  function handleAccountsRemovedMany(accountCodes: string[]) {
    const codeSet = new Set(accountCodes);

    setSection((current) => {
      const removedSnapshots = accountCodes
        .map((code) => snapshotByCode(current, code))
        .filter((item): item is AccountSnapshot => Boolean(item));
      const withoutCodes = removeCodesFromSection(current, codeSet);
      const invalidatedSection =
        current.key === "dfc"
          ? clearCardAccountsInSection(withoutCodes, DFC_VISIBLE_DERIVED_TARGETS)
          : withoutCodes;

      return {
        ...invalidatedSection,
        unmappedTotalCount:
          current.key === "dre" ? 0 : current.unmappedTotalCount + removedSnapshots.length,
        unmappedAccounts: appendUniqueAccounts(invalidatedSection.unmappedAccounts, removedSnapshots),
      };
    });
    if (section.key === "dfc") {
      setResolvedTargets((current) => {
        const next = new Set(current);
        DFC_VISIBLE_DERIVED_TARGETS.forEach((item) => next.delete(item));
        return next;
      });
    }
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
        <div className="sticky top-[92px] z-20 mb-5 rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(8,17,30,0.96),rgba(9,18,32,0.92))] p-4 backdrop-blur lg:top-[122px]">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div ref={pickerRef} className="relative block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                Item para configurar
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1a2b] px-4 py-3 text-slate-400 transition focus-within:border-cyan-400/30">
                <Search className="h-4 w-4 shrink-0" />
                <input
                  value={searchValue}
                  onChange={(event) => {
                    setSearchValue(event.target.value);
                    setPickerOpen(true);
                  }}
                  onFocus={() => setPickerOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setPickerOpen(false);
                      setSearchValue(selectedTarget);
                    }
                    if (event.key === "Enter" && filteredTargetOptions.length > 0) {
                      event.preventDefault();
                      setSelectedTarget(filteredTargetOptions[0].title);
                      setSearchValue(filteredTargetOptions[0].title);
                      setPickerOpen(false);
                    }
                  }}
                  placeholder="Buscar item da parametrizacao..."
                  className="w-full bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>

              {pickerOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1728] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                  <div className="max-h-80 overflow-y-auto p-2">
                    {filteredTargetOptions.length === 0 ? (
                      <div className="rounded-xl px-3 py-4 text-sm text-slate-500">
                        Nenhum item encontrado.
                      </div>
                    ) : (
                      filteredTargetOptions.map((option) => {
                        const active = option.title === selectedTarget;
                        return (
                          <button
                            key={`${option.groupTitle}-${option.key}`}
                            type="button"
                            onClick={() => {
                              setSelectedTarget(option.title);
                              setSearchValue(option.title);
                              setPickerOpen(false);
                            }}
                            aria-current={active ? "true" : undefined}
                            className={cn(
                              "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition",
                              active
                                ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]"
                                : "border-transparent text-slate-300 hover:border-white/8 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-bold">{option.title}</div>
                                {active ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/12 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.24em] text-cyan-300">
                                    <Check className="h-3 w-3" />
                                    Atual
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                                {option.groupTitle}
                              </div>
                            </div>
                            {active ? (
                              <div className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.45)]" />
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  selectedIndex > 0 && setSelectedTarget(targetOptions[selectedIndex - 1].title)
                }
                disabled={selectedIndex <= 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() =>
                  selectedIndex >= 0 &&
                  selectedIndex < targetOptions.length - 1 &&
                  setSelectedTarget(targetOptions[selectedIndex + 1].title)
                }
                disabled={selectedIndex < 0 || selectedIndex >= targetOptions.length - 1}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Proximo
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-start rounded-2xl border border-white/8 bg-black/10 px-4 py-3 text-sm text-slate-400 lg:justify-end">
            {selectedIndex >= 0 ? `${selectedIndex + 1} de ${targetOptions.length}` : "Sem itens"}
          </div>
        </div>
        </div>

        <div className="space-y-5">
          {visibleGroups.map((group, index) => (
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
                  {group.cards.length} item
                </span>
              </div>

              <div className="grid gap-4">
                {group.cards.map((card) => {
                  const isLoadingCard =
                    loadingTarget === card.title && card.mappedCount > 0 && card.mappedAccounts.length === 0;
                  const isReadOnlyCard = section.key === "dfc" && isDfcDerivedTarget(card.title);
                  const groupedAccounts =
                    isReadOnlyCard && card.mappedGroups && card.mappedGroups.length > 0;

                  return (
                    <article
                      key={card.key}
                      className="rounded-[1.4rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,22,39,0.98),rgba(8,17,30,0.95))] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-extrabold text-white">
                            {groupCardTitle(card.title)}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">{countLabel(card.mappedCount)}</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {isReadOnlyCard ? (
                            <span className="inline-flex items-center justify-center rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.24em] text-amber-200">
                              Consolidado
                            </span>
                          ) : null}
                          <span className="inline-flex min-w-[3.25rem] items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                            {card.mappedCount}
                          </span>
                          {!isReadOnlyCard ? (
                            <>
                              <ParametrizationAddButton
                                kind={section.key}
                                target={card.title}
                                disabled={isOffline}
                                onSaved={(account) => handleAccountSaved(card.title, account)}
                                onSavedMany={(accounts) => handleAccountsSavedMany(card.title, accounts)}
                              />
                              <ParametrizationRemoveManyButton
                                kind={section.key}
                                target={card.title}
                                accountCodes={card.mappedAccounts.map((account) => account.code)}
                                disabled={isOffline || card.mappedAccounts.length === 0}
                                onRemovedMany={(codes) => handleAccountsRemovedMany(codes)}
                              />
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/6 bg-black/10 p-4">
                        <div className="space-y-3">
                          {isLoadingCard ? (
                            <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Carregando as contas deste item...
                            </div>
                          ) : card.mappedAccounts.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-500">
                              {isReadOnlyCard
                                ? "Nenhuma conta consolidada a partir das linhas vinculadas."
                                : "Nenhuma conta configurada nessa categoria."}
                            </div>
                          ) : groupedAccounts ? (
                            <div className="space-y-4">
                              {card.mappedGroups?.map((group) => (
                                <div
                                  key={`${card.key}-${group.title}`}
                                  className="rounded-[1.1rem] border border-white/8 bg-[#0b1525] px-4 py-4"
                                >
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <div className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-cyan-300">
                                      {group.title}
                                    </div>
                                    <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-cyan-200">
                                      {group.total} conta(s)
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    {group.accounts.map((account) => (
                                      <div
                                        key={`${group.title}-${account.code}-${account.name}`}
                                        className="rounded-2xl border border-white/8 bg-[#0f1a2b] px-4 py-3 text-sm text-slate-100"
                                      >
                                        {formatListLabel(account)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
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
                                  {!isReadOnlyCard ? (
                                    <ParametrizationRemoveButton
                                      kind={section.key}
                                      target={card.title}
                                      accountCode={account.code}
                                      onRemoved={(code) => handleAccountRemoved(code)}
                                    />
                                  ) : null}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

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
