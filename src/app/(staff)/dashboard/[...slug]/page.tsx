import Link from "next/link";

const SECTION_TITLES: Record<string, string> = {
  clientes: "Clientes",
  relatorios: "Relatórios",
  "plano-de-contas": "Plano de Contas",
  documentos: "Documentos",
  parametrizacao: "Parametrização",
  suporte: "Suporte",
  equipe: "Equipe",
  auditoria: "Auditoria",
  ajuda: "Ajuda",
};

function getSectionTitle(slug: string[]) {
  const key = slug.join("/");
  return SECTION_TITLES[key] ?? key.replaceAll("-", " ");
}

export default async function StaffSectionPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const title = getSectionTitle(slug);

  return (
    <div className="space-y-8 p-6 md:p-8">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-500">
          Painel
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Esta seção já está reservada no menu lateral. Podemos conectar os
          dados reais e as ações dessa área em seguida.
        </p>
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-500">
          Área em construção para <span className="font-medium text-slate-900">{title}</span>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
