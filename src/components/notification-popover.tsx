"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, FileText, ShieldCheck, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type NotificationKind = "arquivos" | "sistema";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
};

type NotificationPopoverProps = {
  title: string;
  audience: "staff" | "client";
  accentClassName?: string;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function kindLabel(kind: NotificationKind) {
  return kind === "arquivos" ? "Arquivos" : "Sistema";
}

function kindIcon(kind: NotificationKind) {
  return kind === "arquivos" ? FileText : Sparkles;
}

export function NotificationPopover({
  title,
  audience,
  accentClassName = "text-cyan-300",
}: NotificationPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<NotificationKind>("arquivos");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/notifications?audience=${encodeURIComponent(audience)}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load notifications");
        }

        const payload = (await response.json()) as {
          notifications?: NotificationItem[];
        };

        if (active) {
          setNotifications(payload.notifications ?? []);
        }
      } catch {
        if (active) {
          setNotifications([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadNotifications();

    return () => {
      active = false;
    };
  }, [audience]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.unread).length,
    [notifications]
  );

  const visibleItems = useMemo(
    () => notifications.filter((item) => item.kind === activeKind),
    [activeKind, notifications]
  );

  async function markAsRead(id: string) {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: false } : item))
    );

    try {
      await fetch(
        `/api/notifications/${id}?audience=${encodeURIComponent(audience)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_read: true }),
        }
      );
    } catch {
      // Optimistic update: the next refresh will resync the badge.
    }
  }

  async function markAllVisibleAsRead() {
    const unreadVisible = visibleItems.filter((item) => item.unread);

    setNotifications((current) =>
      current.map((item) =>
        item.kind === activeKind ? { ...item, unread: false } : item
      )
    );

    await Promise.all(
      unreadVisible.map((item) =>
        fetch(
          `/api/notifications/${item.id}?audience=${encodeURIComponent(audience)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ is_read: true }),
          }
        )
      )
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white",
          open && "border-cyan-400/30 bg-cyan-500/10",
          accentClassName
        )}
        aria-label={`Abrir notificacoes de ${title}`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-[390px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,22,40,0.99),rgba(8,18,32,0.97))] shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
          <div className="flex items-start justify-between gap-4 border-b border-white/8 px-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
                {title}
              </p>
              <h3 className="mt-1 text-base font-bold text-white">Notificacoes</h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2 border-b border-white/8 px-4 py-3">
            {(["arquivos", "sistema"] as NotificationKind[]).map((kind) => {
              const count = notifications.filter((item) => item.kind === kind).length;
              const active = activeKind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setActiveKind(kind)}
                  className={cn(
                    "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "border-cyan-400/30 bg-cyan-500/12 text-cyan-300"
                      : "border-white/8 bg-white/4 text-slate-400 hover:bg-white/8 hover:text-slate-100"
                  )}
                >
                  {kindLabel(kind)}{" "}
                  <span className="ml-1 text-xs opacity-80">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-white/10 bg-white/3 px-5 py-10 text-center text-sm text-slate-500">
                <ShieldCheck className="mb-3 h-5 w-5 text-slate-500" />
                Carregando notificacoes...
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-white/10 bg-white/3 px-5 py-10 text-center text-sm text-slate-500">
                <ShieldCheck className="mb-3 h-5 w-5 text-slate-500" />
                Nenhuma notificacao nesta aba.
              </div>
            ) : (
              visibleItems.map((item) => {
                const Icon = kindIcon(item.kind);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      void markAsRead(item.id);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[1.3rem] border px-4 py-4 text-left transition",
                      item.unread
                        ? "border-cyan-400/18 bg-cyan-500/8"
                        : "border-white/6 bg-white/3 hover:bg-white/5"
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-cyan-300">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-bold text-white">
                          {item.title}
                        </p>
                        {item.unread && (
                          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {item.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>{formatTime(item.timestamp)}</span>
                        <span className="inline-flex items-center gap-1">
                          <CheckCheck className="h-3.5 w-3.5" />
                          Marcar lida
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 text-xs text-slate-500">
            <span>{unreadCount} nao lida(s)</span>
            <button
              type="button"
              onClick={() => {
                void markAllVisibleAsRead();
              }}
              className="font-semibold text-cyan-300 transition hover:text-cyan-200"
            >
              Marcar aba como lida
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
