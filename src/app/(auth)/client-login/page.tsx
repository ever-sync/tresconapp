"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  FolderKanban,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { PwaInstallButton } from "@/components/pwa-install-button";
import { useClientAuthStore } from "@/stores/useClientAuthStore";

const highlights = [
  {
    title: "Financeiro em um lugar",
    description: "DRE, DFC, balanco e documentos organizados no mesmo portal.",
    icon: Building2,
  },
  {
    title: "Acesso com seguranca",
    description: "Ambiente privado para consulta de dados e arquivos do seu negocio.",
    icon: ShieldCheck,
  },
  {
    title: "Rotina mais simples",
    description: "Consulta rapida de indicadores, relatorios e atendimento com a contabilidade.",
    icon: FolderKanban,
  },
];

export default function ClientLoginPage() {
  const router = useRouter();
  const setSession = useClientAuthStore((s) => s.setSession);
  const [cnpj, setCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function formatCnpj(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cnpjFromQuery = params.get("cnpj");
    if (cnpjFromQuery) {
      setCnpj(formatCnpj(cnpjFromQuery));
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: cnpj.replace(/\D/g, ""), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao fazer login");
        return;
      }

      setSession({
        id: data.client.id,
        name: data.client.name,
        cnpj: data.client.cnpj,
        email: data.client.email,
        accounting_id: data.client.accounting_id,
        accounting: data.accounting,
      });

      router.push("/portal");
    } catch {
      setError("Erro de conexao");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.18),transparent_34%),linear-gradient(180deg,#08111f_0%,#0a1628_46%,#091221_100%)]" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1.08fr_540px]">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,24,44,0.9),rgba(8,17,31,0.72))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.35)] sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_38%)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-3 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                Portal do Cliente
              </div>

              <div className="mt-8 max-w-2xl">
                <p className="text-sm font-bold uppercase tracking-[0.26em] text-slate-400">
                  TresContas
                </p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
                  Uma entrada mais profissional para acompanhar a saude financeira da empresa.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                  Consulte demonstrativos, documentos e indicadores em um ambiente pensado para dar
                  visao executiva e acesso rapido ao que importa no dia a dia.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-cyan-400/15 bg-cyan-500/8 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200/80">Portal</p>
                  <p className="mt-3 text-3xl font-black text-white">24h</p>
                  <p className="mt-2 text-sm text-slate-300">Acesso continuo aos dados do cliente.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Leitura</p>
                  <p className="mt-3 text-3xl font-black text-white">Clara</p>
                  <p className="mt-2 text-sm text-slate-300">Indicadores e relatorios em um fluxo unico.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Contato</p>
                  <p className="mt-3 text-3xl font-black text-white">Direto</p>
                  <p className="mt-2 text-sm text-slate-300">Mais proximidade com a contabilidade da conta.</p>
                </div>
              </div>

              <div className="mt-10 grid gap-4">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="flex items-start gap-4 rounded-[1.5rem] border border-white/8 bg-white/[0.04] px-5 py-5"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] text-white shadow-[0_16px_34px_rgba(14,165,233,0.28)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,22,40,0.96),rgba(9,17,31,0.94))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.38)] sm:p-8 lg:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#22d3ee_0%,#0c8bff_55%,#0b63ff_100%)]" />

            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] shadow-[0_16px_36px_rgba(14,165,233,0.28)]">
                <LockKeyhole className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300/70">
                  Acesso do cliente
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-white">
                  Entrar no portal
                </h2>
              </div>
            </div>

            <p className="mt-6 text-sm leading-6 text-slate-400">
              Use o CNPJ e a senha cadastrada para acessar seus demonstrativos, documentos e o canal
              direto com a contabilidade.
            </p>

            <div className="mt-6">
              <PwaInstallButton compact />
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              <div className="space-y-2">
                <label
                  htmlFor="cnpj"
                  className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-slate-500"
                >
                  CNPJ
                </label>
                <input
                  id="cnpj"
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  required
                  placeholder="00.000.000/0000-00"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/35 focus:bg-white/[0.07]"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-slate-500"
                >
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Digite sua senha"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/35 focus:bg-white/[0.07]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3.5 text-sm font-black text-white shadow-[0_18px_48px_rgba(25,182,255,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Entrando..." : "Acessar portal"}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>

            <div className="mt-8 grid gap-3 rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-5 text-sm text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness className="h-4 w-4 text-cyan-300" />
                  <span>Login da contabilidade</span>
                </div>
                <Link href="/login" className="font-semibold text-cyan-300 transition hover:text-cyan-200">
                  Ir para escritorio
                </Link>
              </div>
              <div className="h-px bg-white/8" />
              <div className="flex items-center justify-between gap-3">
                <span>Precisa de suporte para acesso?</span>
                <Link href="/portal/atendimento" className="font-semibold text-cyan-300 transition hover:text-cyan-200">
                  Atendimento
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
