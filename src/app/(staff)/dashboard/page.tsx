"use client";

import { useAuthStore } from "@/stores/useAuthStore";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-bold">TresContas</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {user?.name} · {user?.accounting?.name}
          </span>
          <button
            onClick={logout}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 p-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="mt-2 text-muted-foreground">
          Bem-vindo ao painel da contabilidade.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Clientes Ativos", value: "—" },
            { label: "Movimentações", value: "—" },
            { label: "Tickets Abertos", value: "—" },
            { label: "Documentos", value: "—" },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border bg-card p-6">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-3xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
