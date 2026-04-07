"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { NotificationPopover } from "@/components/notification-popover";

const STAFF_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/clientes": "Clientes",
  "/dashboard/relatorios": "Relatórios",
  "/dashboard/documentos": "Documentos",
  "/dashboard/plano-de-contas": "Plano de Contas",
  "/dashboard/parametrizacao": "Parametrizacao",
  "/dashboard/suporte": "Suporte",
  "/dashboard/equipe": "Equipe",
  "/dashboard/auditoria": "Auditoria",
  "/dashboard/ajuda": "Ajuda",
};

export function StaffHeader() {
  const pathname = usePathname();

  const title = useMemo(() => {
    return (
      Object.entries(STAFF_TITLES).find(([route]) =>
        pathname === route || pathname.startsWith(`${route}/`)
      )?.[1] ?? "Contabilidade"
    );
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[linear-gradient(180deg,rgba(8,19,37,0.96),rgba(9,20,38,0.92))] backdrop-blur md:fixed md:left-[var(--staff-sidebar-width)] md:right-0 md:top-0 md:z-50">
      <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6 md:h-[106px]">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.38em] text-cyan-300/70">
            Contabilidade
          </p>
          <div className="mt-2 flex items-center gap-2 md:hidden">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.28em] text-cyan-300">
              Desk
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.28em] text-slate-300">
              Mobile Ops
            </span>
          </div>
          <h1 className="mt-2 truncate text-2xl font-black tracking-tight text-white">
            {title}
          </h1>
        </div>

        <div className="hidden w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-400 md:flex lg:w-auto">
          <Search className="h-4 w-4 shrink-0" />
          <input
            placeholder="Buscar cliente, documento ou conta..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Abrir busca"
          >
            <Search className="h-4 w-4" />
          </button>

          <NotificationPopover title="Contabilidade" audience="staff" />

          <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/8 bg-white/5 px-2.5 py-2 sm:px-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#2dd4ff_0%,#1499ff_48%,#0f6dff_100%)] font-bold text-white">
              A
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Administrador</p>
              <p className="max-w-[10rem] truncate text-xs text-slate-500 sm:max-w-[13rem]">
                Contabilidade Exemplo LTDA
              </p>
            </div>
            <span className="hidden rounded-full bg-cyan-400/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.28em] text-cyan-300 sm:inline-flex">
              Admin
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
