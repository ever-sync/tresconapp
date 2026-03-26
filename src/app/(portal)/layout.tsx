import { PortalSidebar } from "@/components/portal-sidebar";
import { PortalHeader } from "@/components/portal-header";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#071225] text-slate-50 md:flex">
      <PortalSidebar />
      <main className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_28%),linear-gradient(180deg,#0a172a_0%,#07111f_100%)] text-slate-50">
        <PortalHeader />
        {children}
      </main>
    </div>
  );
}
