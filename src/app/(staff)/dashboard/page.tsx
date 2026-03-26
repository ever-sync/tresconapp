export default function DashboardPage() {
  return (
    <div className="space-y-8 p-6 md:p-8">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-500">
          Painel
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Dashboard
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Acompanhe a operação da contabilidade e acesse os principais módulos
          a partir da navegação lateral.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Clientes Ativos", value: "—" },
          { label: "Movimentações", value: "—" },
          { label: "Tickets Abertos", value: "—" },
          { label: "Documentos", value: "—" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {card.value}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
