"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";

import { PwaInstallButton } from "@/components/pwa-install-button";
import { useAuthStore } from "@/stores/useAuthStore";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao fazer login");
        return;
      }

      setSession({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        mfa_enabled: false,
        accounting_id: data.user.accounting_id,
        accounting: data.accounting,
      });

      router.push("/dashboard");
    } catch {
      setError("Erro de conexao");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.2),transparent_34%),linear-gradient(180deg,#08111f_0%,#0a1628_46%,#091221_100%)]" />
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <section className="relative w-full max-w-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,22,40,0.96),rgba(9,17,31,0.94))] p-7 shadow-[0_30px_120px_rgba(0,0,0,0.38)] sm:p-9 lg:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#22d3ee_0%,#0c8bff_55%,#0b63ff_100%)]" />

            <div className="rounded-[1.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_34%),linear-gradient(180deg,rgba(11,43,63,0.92),rgba(9,31,46,0.88))] px-4 py-3 sm:px-5">
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
                <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300/70">Acesso da equipe</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-white">Entrar na plataforma</h2>
              </div>
            </div>

            <p className="mt-7 text-[1.02rem] leading-7 text-slate-400">
              Use seu email corporativo para acessar clientes, parametrizacoes e demonstrativos do escritorio.
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
                <label htmlFor="email" className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-slate-500">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/35 focus:bg-white/[0.07]"
                />
              </div>

              <div className="space-y-2.5">
                <label htmlFor="password" className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-slate-500">
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
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 pr-12 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/35 focus:bg-white/[0.07]"
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
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3.5 text-sm font-black text-white shadow-[0_18px_48px_rgba(25,182,255,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Entrando..." : "Entrar no painel"}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>

            <div className="mt-10 grid gap-3 rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-5 text-sm text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <span>Login do cliente</span>
                <Link href="/client-login" className="font-semibold text-cyan-300 transition hover:text-cyan-200">
                  Ir para portal do cliente
                </Link>
              </div>
            </div>
        </section>
      </div>
    </div>
  );
}
