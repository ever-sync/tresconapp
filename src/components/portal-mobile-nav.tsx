"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/portal", label: "Inicio", icon: LayoutDashboard },
  { href: "/portal/dre", label: "DRE", icon: BarChart3 },
  { href: "/portal/dfc", label: "DFC", icon: FileText },
  { href: "/portal/balanco-patrimonial", label: "Balanco", icon: Landmark },
  { href: "/portal/atendimento", label: "Suporte", icon: LifeBuoy },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-[linear-gradient(180deg,rgba(7,17,33,0.98),rgba(7,16,28,0.98))] px-2 pt-2 shadow-[0_-18px_40px_rgba(0,0,0,0.28)] backdrop-blur md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-bold transition",
                active
                  ? "bg-cyan-500/12 text-cyan-300"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )}
            >
              <Icon className={cn("h-5 w-5", active ? "text-cyan-300" : "text-slate-500")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
