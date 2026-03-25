"use client";

import { useClientAuthStore } from "@/stores/useClientAuthStore";

export default function PortalPage() {
  const client = useClientAuthStore((s) => s.client);
  const logout = useClientAuthStore((s) => s.logout);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-bold">Portal do Cliente</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{client?.name}</span>
          <button
            onClick={logout}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 p-6">
        <h2 className="text-2xl font-bold">Seus Dados Financeiros</h2>
        <p className="mt-2 text-muted-foreground">
          Visualize DRE, DFC e documentos da sua empresa.
        </p>
      </main>
    </div>
  );
}
