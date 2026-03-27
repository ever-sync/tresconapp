import { PortalSidebar } from "@/components/portal-sidebar";
import { PortalHeader } from "@/components/portal-header";
import { PortalMobileNav } from "@/components/portal-mobile-nav";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#071225] text-slate-50">
      <PortalSidebar />
      <main className="min-w-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_28%),linear-gradient(180deg,#0a172a_0%,#07111f_100%)] pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[max(0.35rem,env(safe-area-inset-top))] text-slate-50 transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:ml-[var(--portal-sidebar-width)] md:pb-0 md:pt-[106px]">
        <PortalHeader />
        {children}
      </main>
      <PortalMobileNav />
    </div>
  );
}
