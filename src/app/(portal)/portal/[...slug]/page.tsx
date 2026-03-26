import Link from "next/link";

const SECTION_TITLES: Record<string, string> = {
  movimentacoes: "Movimentações",
  "fluxo-de-caixa": "Fluxo de Caixa",
  "conciliacao-bancaria": "Conciliação Bancária",
  dre: "DRE",
  dfc: "DFC",
  "balanco-patrimonial": "Balanço Patrimonial",
  impostos: "Impostos",
  guias: "Guias",
  "folha-de-pagamento": "Folha de Pagamento",
  obrigacoes: "Obrigações",
  documentos: "Documentos",
  "servicos-contratados": "Serviços Contratados",
  atendimento: "Atendimento",
};

function getSectionTitle(slug: string[]) {
  const key = slug.join("/");
  return SECTION_TITLES[key] ?? key.replaceAll("-", " ");
}

export default function PortalSectionPage({
  params,
}: {
  params: { slug: string[] };
}) {
  const title = getSectionTitle(params.slug);

  return (
    <div className="space-y-8 p-6 md:p-8">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-500">
          Portal do Cliente
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Esta área já está pronta na navegação lateral. Podemos conectar os
          dados e as ações específicas desta seção na próxima etapa.
        </p>
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-500">
          Conteúdo em construção para{" "}
          <span className="font-medium text-slate-900">{title}</span>.
        </p>
        <div className="mt-6">
          <Link
            href="/portal"
            className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
