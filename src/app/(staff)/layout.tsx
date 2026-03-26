import { StaffSidebar } from "@/components/staff-sidebar";
import { StaffHeader } from "@/components/staff-header";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 md:flex">
      <StaffSidebar />
      <main className="min-w-0 flex-1 bg-[linear-gradient(180deg,#08111f_0%,#091527_45%,#07101c_100%)] text-slate-50">
        <StaffHeader />
        {children}
      </main>
    </div>
  );
}
