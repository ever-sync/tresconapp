"use client";

import Image from "next/image";
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
  LayoutDashboard,
  Landmark,
  LifeBuoy,
  LogOut,
  RefreshCw,
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
  disabled?: boolean;
};

const mainItems: NavItem[] = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/movimentacoes", label: "Movimentações", icon: ArrowRightLeft, disabled: true },
  { href: "/portal/fluxo-de-caixa", label: "Fluxo de Caixa", icon: TrendingUp, disabled: true },
  { href: "/portal/conciliacao-bancaria", label: "Conciliação Bancária", icon: RefreshCw, disabled: true },
  { href: "/portal/dre", label: "DRE", icon: BarChart3 },
  { href: "/portal/dfc", label: "DFC", icon: FileText },
  { href: "/portal/balanco-patrimonial", label: "Balanço Patrimonial", icon: Landmark },
  { href: "/portal/impostos", label: "Impostos", icon: BadgeDollarSign, disabled: true },
  { href: "/portal/guias", label: "Guias", icon: FileCheck2, disabled: true },
  { href: "/portal/folha-de-pagamento", label: "Folha de Pagamento", icon: ClipboardList, disabled: true },
  { href: "/portal/obrigacoes", label: "Obrigações", icon: ShieldCheck, disabled: true },
  { href: "/portal/documentos", label: "Documentos", icon: FileText },
  { href: "/portal/servicos-contratados", label: "Serviços Contratados", icon: BookText, disabled: true },
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
  const isDisabled = Boolean(item.disabled);

  const content = (
    <>
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          active ? "text-cyan-300" : isDisabled ? "text-slate-500" : "text-slate-500 group-hover:text-slate-300"
        )}
      />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {!collapsed && isDisabled ? (
        <span className="ml-2 shrink-0 whitespace-nowrap rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-slate-300">
          Em breve
        </span>
      ) : null}
    </>
  );

  if (isDisabled) {
    return (
      <div
        aria-disabled="true"
        className={cn(
          "group flex min-w-0 items-center gap-3 rounded-2xl border text-sm font-medium transition-all duration-200",
          collapsed ? "justify-center px-0 py-3.5" : "px-3.5 py-3.5",
          "cursor-not-allowed border-white/8 bg-white/[0.03] text-slate-500 opacity-75"
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-2xl border text-sm font-medium transition-all duration-200",
        collapsed ? "justify-center px-0 py-3.5" : "px-3.5 py-3.5",
        active
          ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-300 shadow-[0_0_28px_rgba(14,165,233,0.14)]"
          : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-100"
      )}
    >
      {content}
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
        <div className={cn("relative px-4 pb-5", collapsed ? "flex justify-center" : "flex items-center justify-between gap-3")}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl shadow-[0_0_30px_rgba(244,200,79,0.22)]">
              <Image
                src="/trescontas-mark.png"
                alt="TresContas"
                width={48}
                height={48}
                className="h-12 w-12"
                priority
              />
            </div>
            {!collapsed && (
              <div>
                <p className="text-base font-semibold tracking-tight text-white">
                  TresContas
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#13263e] text-slate-300 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition hover:bg-[#19314f] hover:text-white",
              collapsed ? "absolute right-[-12px] top-1/2 z-20 -translate-y-1/2" : "absolute right-[-12px] top-6 z-20"
            )}
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

        <nav className="scrollbar-hidden flex-1 space-y-2 overflow-y-auto px-4">
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
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-3 border-t border-white/5 py-4 text-left text-sm font-medium text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300",
              collapsed ? "justify-center px-0" : "px-4"
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
