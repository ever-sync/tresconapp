"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";

import { PwaInstallButton } from "@/components/pwa-install-button";
import { useClientAuthStore } from "@/stores/useClientAuthStore";

export default function ClientLoginPage() {
  const router = useRouter();
  const setSession = useClientAuthStore((s) => s.setSession);
  const [cnpj, setCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
      <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <section className="relative w-full max-w-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,22,40,0.96),rgba(9,17,31,0.94))] p-7 shadow-[0_30px_120px_rgba(0,0,0,0.38)] sm:p-9 lg:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2dd4bf_0%,#14b8a6_55%,#0f766e_100%)]" />

            <div className="rounded-[1.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_34%),linear-gradient(180deg,rgba(11,43,63,0.92),rgba(9,31,46,0.88))] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl shadow-[0_0_30px_rgba(244,200,79,0.22)]">
                  <Image
                    src="/trescontas-mark.png"
                    alt="TresContas"
                    width={48}
                    height={48}
                    className="h-12 w-12"
                    priority
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold leading-none tracking-tight text-white sm:text-[1.75rem]">
                    TresContas
                  </p>
                  <p className="mt-1 text-[0.68rem] uppercase tracking-[0.38em] text-slate-400">
                    Contabilidade
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-teal-300/80">Acesso do cliente</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-white">Entrar no portal do cliente</h2>
              </div>
            </div>

            <p className="mt-7 text-[1.02rem] leading-7 text-slate-400">
              Use o CNPJ e a senha cadastrada para acessar seus demonstrativos, documentos e o canal
              direto com a contabilidade.
            </p>

            <div className="mt-7">
              <PwaInstallButton compact />
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              <div className="space-y-2.5">
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
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400/35 focus:bg-white/[0.07]"
                />
              </div>

              <div className="space-y-2.5">
                <label
                  htmlFor="password"
                  className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-slate-500"
                >
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Digite sua senha"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 pr-12 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400/35 focus:bg-white/[0.07]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-200"
                    aria-label={showPassword ? "Ocultar senha" : "Visualizar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#2dd4bf_0%,#14b8a6_55%,#0f766e_100%)] px-5 py-3.5 text-sm font-black text-white shadow-[0_18px_48px_rgba(20,184,166,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Entrando..." : "Acessar portal"}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>

            <div className="mt-10 grid gap-3 rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-5 text-sm text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <span>Login da contabilidade</span>
                <Link href="/login" className="font-semibold text-teal-300 transition hover:text-teal-200">
                  Ir para escritorio
                </Link>
              </div>
            </div>
        </section>
      </div>
    </div>
  );
}
