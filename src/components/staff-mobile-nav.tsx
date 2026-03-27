"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookText,
  FileText,
  LayoutDashboard,
  Settings2,
  Users2,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users2 },
  { href: "/dashboard/plano-de-contas", label: "Plano", icon: BookText },
  { href: "/dashboard/parametrizacao", label: "Param.", icon: Settings2 },
  { href: "/dashboard/documentos", label: "Docs", icon: FileText },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StaffMobileNav() {
  const pathname = usePathname();

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 md:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <nav className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,19,37,0.96),rgba(7,16,28,0.94))] px-2 py-2 shadow-[0_-18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-[1.35rem] px-2 py-2.5 text-[0.68rem] font-bold transition",
                active
                  ? "bg-[linear-gradient(180deg,rgba(20,60,120,0.92),rgba(8,38,62,0.96))] text-cyan-100 shadow-[0_12px_30px_rgba(8,38,62,0.35)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-2xl transition",
                  active ? "bg-white/10 text-cyan-100" : "bg-white/0 text-slate-500"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
      </nav>
    </div>
  );
}
