"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  FileText,
  CircleHelp,
  LayoutDashboard,
  Landmark,
  LifeBuoy,
  LogOut,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TrendingUp,
  BookText,
  BadgeDollarSign,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useClientAuthStore } from "@/stores/useClientAuthStore";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const mainItems: NavItem[] = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/movimentacoes", label: "Movimentações", icon: ArrowRightLeft },
  { href: "/portal/fluxo-de-caixa", label: "Fluxo de Caixa", icon: TrendingUp },
  { href: "/portal/conciliacao-bancaria", label: "Conciliação Bancária", icon: RefreshCw },
  { href: "/portal/dre", label: "DRE", icon: BarChart3 },
  { href: "/portal/dfc", label: "DFC", icon: FileText },
  { href: "/portal/balanco-patrimonial", label: "Balanço Patrimonial", icon: Landmark },
  { href: "/portal/impostos", label: "Impostos", icon: BadgeDollarSign },
  { href: "/portal/guias", label: "Guias", icon: FileCheck2 },
  { href: "/portal/folha-de-pagamento", label: "Folha de Pagamento", icon: ClipboardList },
  { href: "/portal/obrigacoes", label: "Obrigações", icon: ShieldCheck },
  { href: "/portal/documentos", label: "Documentos", icon: FileText },
  { href: "/portal/servicos-contratados", label: "Serviços Contratados", icon: BookText },
  { href: "/portal/atendimento", label: "Atendimento", icon: LifeBuoy },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-none border-y border-transparent px-4 py-4 text-sm font-medium transition-all duration-200",
        active
          ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.16)]"
          : "text-slate-500 hover:bg-white/4 hover:text-slate-100"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function PortalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useClientAuthStore((state) => state.logout);
  const [collapsed, setCollapsed] = useState(false);

  const activeLabel = useMemo(() => {
    const current = mainItems.find((item) => isActivePath(pathname, item.href));
    return current?.label ?? "Dashboard";
  }, [pathname]);

  useEffect(() => {
    // Keep the sidebar open enough to resemble the requested layout.
    setCollapsed(false);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--portal-sidebar-width",
      collapsed ? "92px" : "292px"
    );

    return () => {
      document.documentElement.style.setProperty("--portal-sidebar-width", "292px");
    };
  }, [collapsed]);

  function handleLogout() {
    logout();
    router.push("/client-login");
  }

  return (
    <aside
      className={cn(
        "relative hidden shrink-0 flex-col overflow-hidden border-r border-white/5 bg-[#081325] text-slate-200 shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:fixed md:left-0 md:top-0 md:z-40 md:flex md:h-screen",
        collapsed ? "w-full md:w-[92px]" : "w-full md:w-[292px]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.08),transparent_24%)]" />

      <div className="relative flex min-h-full flex-col py-5">
        <div className="flex items-center justify-between gap-3 px-4 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#2dd4ff_0%,#1499ff_48%,#0f6dff_100%)] text-xl font-semibold text-white shadow-[0_0_30px_rgba(14,165,233,0.45)]">
              T
            </div>
            {!collapsed && (
              <div>
                <p className="text-base font-semibold tracking-tight text-white">
                  TresContas
                </p>
                <p className="text-[0.72rem] uppercase tracking-[0.4em] text-slate-500">
                  Cliente
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-4 pb-3">
            <div className="rounded-2xl border border-white/5 bg-white/3 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Acesso
              </p>
              <p className="mt-1 text-sm font-medium text-slate-100">
                {activeLabel}
              </p>
            </div>
          </div>
        )}

        <nav className="scrollbar-hidden flex-1 space-y-1 overflow-y-auto px-0">
          {mainItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActivePath(pathname, item.href)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="mt-auto space-y-2 px-0 pt-4">
          <div className="px-4 pb-2">
            <Link
              href="/portal/atendimento"
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-500 transition hover:bg-white/5 hover:text-slate-100"
            >
              <CircleHelp className="h-5 w-5 shrink-0 text-slate-500" />
              {!collapsed && <span>Suporte</span>}
            </Link>
          </div>

          {!collapsed && (
            <div className="px-4 pb-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-500 transition hover:bg-white/5 hover:text-slate-100"
              >
                <Settings2 className="h-5 w-5 shrink-0 text-slate-500" />
                <span className="flex-1">Configuração</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 border-t border-white/5 px-4 py-4 text-left text-sm font-medium text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="h-5 w-5 shrink-0 text-rose-400" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
