"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  LifeBuoy,
  LogOut,
  Settings2,
  ShieldCheck,
  Users2,
  LayoutDashboard,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const mainItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users2 },
  { href: "/dashboard/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/dashboard/plano-de-contas", label: "Plano de Contas", icon: BookText },
  { href: "/dashboard/parametrizacao", label: "Parametrização", icon: Settings2 },
  { href: "/dashboard/documentos", label: "Documentos", icon: FileText },
];

const supportItems: NavItem[] = [
  { href: "/dashboard/suporte", label: "Suporte", icon: LifeBuoy },
];

const configItems: NavItem[] = [
  { href: "/dashboard/equipe", label: "Equipe", icon: Users2 },
  { href: "/dashboard/auditoria", label: "Auditoria", icon: ShieldCheck },
];

const helpItems: NavItem[] = [
  { href: "/dashboard/ajuda", label: "Ajuda", icon: CircleHelp },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  active,
  collapsed,
  badge,
  variant = "default",
  highlighted = false,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: string | number | null;
  variant?: "default" | "sub";
  highlighted?: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl font-medium transition-all duration-200",
        variant === "sub"
          ? collapsed
            ? "justify-center px-0 py-2.5 text-xs"
            : "px-3 py-2.5 text-xs"
          : collapsed
            ? "justify-center px-0 py-3 text-sm"
            : "px-3 py-3 text-sm",
        active
          ? "bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/20 shadow-[0_0_28px_rgba(14,165,233,0.14)]"
          : highlighted
            ? "bg-white/5 text-slate-100 ring-1 ring-white/10"
            : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
      )}
    >
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          variant === "sub" ? "h-4 w-4" : "h-5 w-5",
          active
            ? "text-cyan-300"
            : highlighted
              ? "text-slate-300"
              : "text-slate-500 group-hover:text-slate-300"
        )}
      />
      {!collapsed && <span>{item.label}</span>}
      {!collapsed && badge ? (
        <span className="ml-auto rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.24em] text-cyan-300">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function StaffSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [collapsed, setCollapsed] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [parametrizationStatus, setParametrizationStatus] = useState<{
    drePending: number;
    patrimonialPending: number;
    dfcPending: number;
    totalPending: number;
  } | null>(null);

  const configActive = useMemo(
    () =>
      configItems.some((item) => isActivePath(pathname, item.href)) ||
      pathname.startsWith("/dashboard/configuracao"),
    [pathname]
  );

  const parametrizationBadge =
    parametrizationStatus && parametrizationStatus.totalPending > 0
      ? parametrizationStatus.totalPending.toLocaleString("pt-BR")
      : null;
  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const response = await fetch("/api/parametrization/status", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          drePending: number;
          patrimonialPending: number;
          dfcPending: number;
          totalPending: number;
        };

        if (isMounted) {
          setParametrizationStatus(payload);
        }
      } catch {
        if (isMounted) {
          setParametrizationStatus(null);
        }
      }
    }

    void loadStatus();

    const handleParametrizationChanged = () => {
      void loadStatus();
    };

    window.addEventListener("parametrization:changed", handleParametrizationChanged);

    return () => {
      isMounted = false;
      window.removeEventListener("parametrization:changed", handleParametrizationChanged);
    };
  }, []);

  useEffect(() => {
    if (configActive && !pathname.startsWith("/dashboard/parametrizacao")) {
      setConfigOpen(true);
    }
  }, [configActive, pathname]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--staff-sidebar-width",
      collapsed ? "92px" : "292px"
    );

    return () => {
      document.documentElement.style.setProperty("--staff-sidebar-width", "292px");
    };
  }, [collapsed]);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "scrollbar-hidden relative hidden shrink-0 flex-col overflow-hidden border-r border-white/5 bg-[#091326] text-slate-200 shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:fixed md:left-0 md:top-0 md:z-40 md:flex md:h-screen md:overflow-y-auto",
        collapsed ? "w-full md:w-[92px]" : "w-full md:w-[292px]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.08),transparent_22%)]" />

      <div className="relative flex min-h-full flex-col px-4 py-5">
        <div className={cn("relative mb-8", collapsed ? "flex justify-center" : "flex items-start justify-between gap-3")}>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-[0_0_34px_rgba(244,200,79,0.22)]">
              <Image
                src="/trescontas-mark.png"
                alt="TresContas"
                width={56}
                height={56}
                className="h-14 w-14"
                priority
              />
            </div>
            {!collapsed && (
              <div className="pt-1">
                <p className="text-lg font-semibold tracking-tight text-white">
                  TresContas
                </p>
                <p className="text-[0.7rem] uppercase tracking-[0.42em] text-slate-500">
                  Contabilidade
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#13263e] text-slate-300 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition hover:bg-[#19314f] hover:text-white",
              collapsed ? "absolute right-[-12px] top-1/2 z-20 -translate-y-1/2" : "absolute right-[-12px] top-1 z-20"
            )}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {mainItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActivePath(pathname, item.href)}
              collapsed={collapsed}
              badge={item.href === "/dashboard/parametrizacao" ? parametrizationBadge : null}
            />
          ))}
        </nav>

        <div className="mt-8 space-y-2">
          {supportItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActivePath(pathname, item.href)}
              collapsed={collapsed}
            />
          ))}

          <button
            type="button"
            onClick={() => setConfigOpen((value) => !value)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl py-3 text-left text-sm font-medium transition-all duration-200",
              collapsed ? "justify-center px-0" : "px-3",
              configActive
                ? "bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/20"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
            )}
            aria-expanded={configOpen}
          >
            <Settings2
              className={cn(
                "h-5 w-5 shrink-0",
                configActive ? "text-cyan-300" : "text-slate-500"
              )}
            />
            {!collapsed && <span className="flex-1">Configuração</span>}
            {!collapsed && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  configOpen ? "rotate-180" : "rotate-0"
                )}
              />
            )}
          </button>

          {!collapsed && (
            <div
              className={cn(
                "ml-4 overflow-hidden border-l pl-4 transition-all duration-300 ease-out",
                configOpen
                  ? "max-h-[520px] space-y-3 border-white/10 opacity-100 translate-y-0"
                  : "max-h-0 space-y-0 border-transparent opacity-0 -translate-y-1 pointer-events-none"
              )}
            >
              {configItems.map((item) => (
                <div key={item.href} className="space-y-1">
                  <NavLink
                    item={item}
                    active={isActivePath(pathname, item.href)}
                    collapsed={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto space-y-2 pt-8">
          {helpItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActivePath(pathname, item.href)}
              collapsed={collapsed}
            />
          ))}

          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl py-3 text-left text-sm font-medium text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300",
              collapsed ? "justify-center px-0" : "px-3"
            )}
          >
            <LogOut className="h-5 w-5 shrink-0 text-rose-400" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
