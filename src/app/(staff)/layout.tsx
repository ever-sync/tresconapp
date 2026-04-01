import { StaffSidebar } from "@/components/staff-sidebar";
import { StaffHeader } from "@/components/staff-header";
import { StaffMobileNav } from "@/components/staff-mobile-nav";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-50">
      <StaffSidebar />
      <main className="min-h-screen min-w-0 bg-[linear-gradient(180deg,#08111f_0%,#091527_45%,#07101c_100%)] pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[max(0.35rem,env(safe-area-inset-top))] text-slate-50 transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:ml-[var(--staff-sidebar-width)] md:pb-0 md:pt-[106px]">
        <StaffHeader />
        {children}
      </main>
      <StaffMobileNav />
    </div>
  );
}
