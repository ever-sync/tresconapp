"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building,
  Building2,
  FileText,
  Globe2,
  LayoutGrid,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserRound,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ClientCard = {
  id: string;
  name: string;
  cnpj: string;
  industry: string;
  active: boolean;
};

const initialClients: ClientCard[] = [
  {
    id: "1",
    name: "COCA COLA FEMSA BRASIL LTDA",
    cnpj: "56216638000119",
    industry: "Comércio varejista de mercadorias em lojas de conveniência",
    active: true,
  },
  {
    id: "2",
    name: "RAPHAEL DOS SANTOS REGO DESENVOLVIMENTO DE SOFTWARE LTDA",
    cnpj: "58747123000170",
    industry: "Web design",
    active: true,
  },
  {
    id: "3",
    name: "Tech Solutions SA",
    cnpj: "98765432000188",
    industry: "Tecnologia",
    active: true,
  },
];

type ModalForm = {
  companyName: string;
  cnpj: string;
  industry: string;
  taxRegime: string;
  address: string;
  email: string;
  phone: string;
  representativeName: string;
  accessEmail: string;
  password: string;
};

const blankForm: ModalForm = {
  companyName: "",
  cnpj: "",
  industry: "",
  taxRegime: "Simples Nacional",
  address: "",
  email: "admin@teste.com",
  phone: "",
  representativeName: "",
  accessEmail: "",
  password: "",
};

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return digits.replace(/^(\d{2})(\d+)/, "($1) $2");
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  return digits.replace(/^(\d{2})(\d{5})(\d+)/, "($1) $2-$3");
}

function ClientCardView({
  client,
  onToggle,
}: {
  client: ClientCard;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.92))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-extrabold uppercase tracking-tight text-white">
            {client.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{client.industry}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
        <ShieldCheck className="h-4 w-4" />
        <span>CNPJ: {client.cnpj}</span>
      </div>

      <div className="mt-5 border-t border-white/6 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase",
              client.active
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                : "border-slate-500/20 bg-slate-500/10 text-slate-500"
            )}
          >
            {client.active ? "Ativo" : "Inativo"}
          </span>

          <div className="flex items-center gap-2">
            <Link
              href="/portal"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300 transition hover:bg-cyan-500/15"
              aria-label={`Acessar cliente ${client.name}`}
            >
              <Globe2 className="h-3.5 w-3.5" />
              Acessar cliente
            </Link>

            <button
              type="button"
              onClick={() => onToggle(client.id)}
              className="text-cyan-300 transition hover:text-cyan-200"
              aria-label={client.active ? "Desativar cliente" : "Ativar cliente"}
            >
              {client.active ? (
                <ToggleRight className="h-8 w-8" />
              ) : (
                <ToggleLeft className="h-8 w-8" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
  full = false,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block space-y-2", full && "sm:col-span-2")}>
      <span className="text-sm font-semibold text-slate-300">{label}</span>
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:border-cyan-400/30">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 shrink-0 text-cyan-300" />
          <div className="w-full">{children}</div>
        </div>
      </div>
    </label>
  );
}

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientCard[]>(initialClients);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ModalForm>(blankForm);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return clients;

    return clients.filter((client) =>
      [client.name, client.cnpj, client.industry]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [clients, query]);

  function updateForm<K extends keyof ModalForm>(key: K, value: ModalForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function closeModal() {
    setModalOpen(false);
    setForm(blankForm);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setClients((current) => [
      {
        id: crypto.randomUUID(),
        name: form.companyName || "Nova Empresa",
        cnpj: form.cnpj.replace(/\D/g, ""),
        industry: form.industry || "Sem segmento",
        active: true,
      },
      ...current,
    ]);

    closeModal();
  }

  function toggleClient(id: string) {
    setClients((current) =>
      current.map((client) =>
        client.id === id ? { ...client, active: !client.active } : client
      )
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#2dd4ff_0%,#1499ff_48%,#0f6dff_100%)] text-2xl font-semibold text-white shadow-[0_0_30px_rgba(14,165,233,0.45)]">
              T
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">
                TresContas
              </p>
              <p className="text-[0.72rem] uppercase tracking-[0.4em] text-slate-500">
                Contabilidade
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-500">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente, CNPJ..."
                className="w-64 bg-transparent text-sm outline-none placeholder:text-slate-600"
              />
            </div>

            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>

            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <Settings2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)]"
            >
              <Plus className="h-4 w-4" />
              Novo Cliente
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Lista de Clientes
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gerencie todos os seus clientes
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <ClientCardView key={client.id} client={client} onToggle={toggleClient} />
          ))}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.98),rgba(10,18,32,0.96))] shadow-[0_30px_120px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white">
                    Novo Cliente
                  </h2>
                  <p className="text-sm text-slate-400">
                    Cadastre uma nova empresa no sistema
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 px-6 py-6">
              <section className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                    <Building className="h-4 w-4" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Dados da Empresa</h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Razão Social" icon={Building2}>
                    <input
                      value={form.companyName}
                      onChange={(event) => updateForm("companyName", event.target.value)}
                      placeholder="Nome da Empresa"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>

                  <Field label="CNPJ" icon={BriefcaseBusiness}>
                    <input
                      value={form.cnpj}
                      onChange={(event) => updateForm("cnpj", formatCnpj(event.target.value))}
                      placeholder="00.000.000/0001-00"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>

                  <Field label="Setor/Ramo" icon={Globe2}>
                    <input
                      value={form.industry}
                      onChange={(event) => updateForm("industry", event.target.value)}
                      placeholder="Ex: Tecnologia"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>

                  <Field label="Regime Tributário" icon={FileText}>
                    <select
                      value={form.taxRegime}
                      onChange={(event) => updateForm("taxRegime", event.target.value)}
                      className="w-full bg-transparent text-sm text-slate-200 outline-none"
                    >
                      <option value="Simples Nacional" className="bg-slate-900">
                        Simples Nacional
                      </option>
                      <option value="Lucro Presumido" className="bg-slate-900">
                        Lucro Presumido
                      </option>
                      <option value="Lucro Real" className="bg-slate-900">
                        Lucro Real
                      </option>
                      <option value="MEI" className="bg-slate-900">
                        MEI
                      </option>
                    </select>
                  </Field>
                </div>
              </section>

              <section className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-cyan-300">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Localização e Contato</h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Endereço Completo" icon={MapPin} full>
                    <input
                      value={form.address}
                      onChange={(event) => updateForm("address", event.target.value)}
                      placeholder="Rua, Número, Bairro, Cidade - UF"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>

                  <Field label="Email da Empresa" icon={Mail}>
                    <input
                      value={form.email}
                      onChange={(event) => updateForm("email", event.target.value)}
                      placeholder="admin@teste.com"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>

                  <Field label="Telefone" icon={Phone}>
                    <input
                      value={form.phone}
                      onChange={(event) => updateForm("phone", formatPhone(event.target.value))}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Acesso do Cliente</h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome do Representante" icon={UserRound}>
                    <input
                      value={form.representativeName}
                      onChange={(event) => updateForm("representativeName", event.target.value)}
                      placeholder="Nome do Sócio/Gestor"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>

                  <Field label="Email de Acesso" icon={Mail}>
                    <input
                      value={form.accessEmail}
                      onChange={(event) => updateForm("accessEmail", event.target.value)}
                      placeholder="email@representante.com"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>

                  <Field label="Senha do Cliente *" icon={ShieldCheck} full>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => updateForm("password", event.target.value)}
                      placeholder="••••••"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-4 border-t border-white/8 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-slate-300 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-4 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)]"
                >
                  <BadgeCheck className="h-4 w-4" />
                  Finalizar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
