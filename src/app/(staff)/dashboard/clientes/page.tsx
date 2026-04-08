"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  BriefcaseBusiness,
  Building,
  Building2,
  Circle,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  LayoutGrid,
  List,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ClientRecord = {
  id: string;
  name: string;
  cnpj: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  address: string | null;
  status: string;
  tax_regime: string | null;
  representative_name: string | null;
  representative_email: string | null;
  active: boolean;
};

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

type PasswordRequirement = {
  label: string;
  met: boolean;
};

type CnpjLookupPayload = {
  error?: string;
  companyName?: string;
  industry?: string;
  email?: string;
  phone?: string;
  address?: string;
};

type CnpjLookupFailure = {
  message: string;
  expiresAt: number;
};

const CNPJ_LOOKUP_FAILURE_TTL_MS = 30 * 1000;

const blankForm: ModalForm = {
  companyName: "",
  cnpj: "",
  industry: "",
  taxRegime: "Simples Nacional",
  address: "",
  email: "",
  phone: "",
  representativeName: "",
  accessEmail: "",
  password: "",
};

const regimeLabels: Record<string, string> = {
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  mei: "MEI",
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

function labelForTaxRegime(value: string | null | undefined) {
  if (!value) return "Simples Nacional";
  return regimeLabels[value] ?? value;
}

function formFromClient(client: ClientRecord): ModalForm {
  return {
    companyName: client.name,
    cnpj: formatCnpj(client.cnpj),
    industry: client.industry ?? "",
    taxRegime: labelForTaxRegime(client.tax_regime),
    address: client.address ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    representativeName: client.representative_name ?? "",
    accessEmail: client.representative_email ?? "",
    password: "",
  };
}

function ClientCardView({
  client,
  onToggle,
  onEdit,
  onDelete,
  deleting,
}: {
  client: ClientRecord;
  onToggle: (client: ClientRecord) => void;
  onEdit: (client: ClientRecord) => void;
  onDelete: (client: ClientRecord) => void;
  deleting: boolean;
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
          <p className="mt-1 text-sm text-slate-500">{client.industry || "Sem segmento"}</p>
          <p className="mt-2 text-xs text-slate-400">
            {client.representative_name || "Sem responsavel"} •{" "}
            {client.representative_email || "Sem email de acesso"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase",
              client.active
                ? "border-blue-400/30 bg-blue-500/10 text-blue-300"
                : "border-slate-300/25 bg-slate-200/10 text-slate-300"
            )}
          >
            {client.active ? "Ativo" : "Desativado"}
          </span>
          <button
            type="button"
            onClick={() => onToggle(client)}
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

      <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
        <ShieldCheck className="h-4 w-4" />
        <span>CNPJ: {formatCnpj(client.cnpj)}</span>
      </div>

      <div className="mt-5 border-t border-white/6 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/api/auth/staff-client-access?clientId=${encodeURIComponent(client.id)}`}
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
              onClick={() => onEdit(client)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/10"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Editar cliente
            </button>

            <button
              type="button"
              onClick={() => onDelete(client)}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Excluir
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

function ClientListRow({
  client,
  onToggle,
  onEdit,
  onDelete,
  deleting,
}: {
  client: ClientRecord;
  onToggle: (client: ClientRecord) => void;
  onEdit: (client: ClientRecord) => void;
  onDelete: (client: ClientRecord) => void;
  deleting: boolean;
}) {
  return (
    <div className="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.35fr)_auto_auto] xl:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
          <Building2 className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-extrabold uppercase tracking-tight text-white">
            {client.name}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400 xl:hidden">
            <span className="inline-flex items-center gap-2">
              {client.industry || "Sem segmento"}
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              CNPJ: {formatCnpj(client.cnpj)}
            </span>
          </div>
        </div>
      </div>

      <div className="hidden text-sm text-slate-300 xl:block">
        {client.industry || "Sem segmento"}
      </div>

      <div className="hidden items-center gap-2 text-sm text-slate-300 xl:flex">
        <ShieldCheck className="h-4 w-4 text-slate-500" />
        <span>{formatCnpj(client.cnpj)}</span>
      </div>

      <div className="flex items-center gap-3 xl:justify-self-start">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em]",
            client.active
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
              : "border-slate-300/20 bg-slate-200/10 text-slate-300"
          )}
        >
          {client.active ? "Ativo" : "Desativado"}
        </span>

        <button
          type="button"
          onClick={() => onToggle(client)}
          className="shrink-0 text-cyan-300 transition hover:text-cyan-200"
          aria-label={client.active ? "Desativar cliente" : "Ativar cliente"}
        >
          {client.active ? (
            <ToggleRight className="h-8 w-8" />
          ) : (
            <ToggleLeft className="h-8 w-8" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 xl:justify-self-end">
        <Link
          href={`/api/auth/staff-client-access?clientId=${encodeURIComponent(client.id)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300 transition hover:bg-cyan-500/15"
          aria-label={`Acessar cliente ${client.name}`}
          title="Acessar cliente"
        >
          <Globe2 className="h-4 w-4" />
        </Link>

        <button
          type="button"
          onClick={() => onEdit(client)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
          aria-label={`Editar cliente ${client.name}`}
          title="Editar cliente"
        >
          <Edit3 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => onDelete(client)}
          disabled={deleting}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Excluir cliente ${client.name}`}
          title="Excluir cliente"
        >
          {deleting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
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
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [form, setForm] = useState<ModalForm>(blankForm);
  const [showPassword, setShowPassword] = useState(false);
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupMessage, setCnpjLookupMessage] = useState<string | null>(null);
  const [lastLookupCnpj, setLastLookupCnpj] = useState("");
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const cnpjLookupCacheRef = useRef<Map<string, CnpjLookupPayload>>(new Map());
  const cnpjLookupFailureRef = useRef<Map<string, CnpjLookupFailure>>(new Map());
  const cnpjLookupAbortRef = useRef<AbortController | null>(null);
  const cnpjLookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    async function loadClients() {
      setLoading(true);
      try {
        const response = await fetch("/api/clients", { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar clientes");
        const payload = (await response.json()) as { clients?: ClientRecord[] };
        if (active) {
          setClients(payload.clients ?? []);
        }
      } catch (err) {
        if (active) {
          setClients([]);
          window.alert(err instanceof Error ? err.message : "Falha ao carregar clientes");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadClients();

    return () => {
      active = false;
    };
  }, []);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return clients;

    return clients.filter((client) =>
      [
        client.name,
        client.cnpj,
        client.industry ?? "",
        client.representative_name ?? "",
        client.representative_email ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [clients, query]);

  function updateForm<K extends keyof ModalForm>(key: K, value: ModalForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const passwordRequirements = useMemo<PasswordRequirement[]>(
    () => [
      { label: "Minimo de 8 caracteres", met: form.password.length >= 8 },
      { label: "Pelo menos 1 letra maiuscula", met: /[A-Z]/.test(form.password) },
      { label: "Pelo menos 1 letra minuscula", met: /[a-z]/.test(form.password) },
      { label: "Pelo menos 1 numero", met: /[0-9]/.test(form.password) },
    ],
    [form.password]
  );

  const passwordStrengthReady = passwordRequirements.every((item) => item.met);

  const clearScheduledCnpjLookup = useCallback(() => {
    if (!cnpjLookupTimeoutRef.current) return;

    clearTimeout(cnpjLookupTimeoutRef.current);
    cnpjLookupTimeoutRef.current = null;
  }, []);

  const applyCnpjLookupPayload = useCallback((payload: CnpjLookupPayload) => {
    setForm((current) => ({
      ...current,
      companyName: current.companyName || payload.companyName || "",
      industry: current.industry || payload.industry || "",
      email: current.email || payload.email || "",
      phone: current.phone || formatPhone(payload.phone || ""),
      address: current.address || payload.address || "",
    }));
    setCnpjLookupMessage(
      payload.companyName
        ? `Dados preenchidos automaticamente para ${payload.companyName}.`
        : "Dados do CNPJ carregados automaticamente."
    );
  }, []);

  const lookupCnpj = useCallback(async (rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "");

    if (digits.length !== 14 || digits === lastLookupCnpj) {
      return;
    }

    const recentFailure = cnpjLookupFailureRef.current.get(digits);
    if (recentFailure) {
      if (recentFailure.expiresAt > Date.now()) {
        setCnpjLookupMessage(recentFailure.message);
        setCnpjLookupLoading(false);
        return;
      }

      cnpjLookupFailureRef.current.delete(digits);
    }

    const cached = cnpjLookupCacheRef.current.get(digits);
    if (cached) {
      applyCnpjLookupPayload(cached);
      setLastLookupCnpj(digits);
      setCnpjLookupLoading(false);
      return;
    }

    cnpjLookupAbortRef.current?.abort();
    const controller = new AbortController();
    cnpjLookupAbortRef.current = controller;

    setCnpjLookupLoading(true);
    setCnpjLookupMessage(null);

    try {
      const response = await fetch(`/api/cnpj/${digits}`, {
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as CnpjLookupPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel consultar o CNPJ");
      }

      cnpjLookupCacheRef.current.set(digits, payload);
      cnpjLookupFailureRef.current.delete(digits);
      applyCnpjLookupPayload(payload);
      setLastLookupCnpj(digits);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const message =
        err instanceof Error ? err.message : "Nao foi possivel consultar o CNPJ agora.";

      cnpjLookupFailureRef.current.set(digits, {
        message,
        expiresAt: Date.now() + CNPJ_LOOKUP_FAILURE_TTL_MS,
      });
      setCnpjLookupMessage(message);
    } finally {
      if (cnpjLookupAbortRef.current === controller) {
        cnpjLookupAbortRef.current = null;
      }

      if (!controller.signal.aborted) {
        setCnpjLookupLoading(false);
      }
    }
  }, [applyCnpjLookupPayload, lastLookupCnpj]);

  useEffect(() => {
    if (!modalOpen) return;

    const digits = form.cnpj.replace(/\D/g, "");
    clearScheduledCnpjLookup();

    if (digits.length !== 14) {
      cnpjLookupAbortRef.current?.abort();
      setCnpjLookupLoading(false);
      return;
    }

    cnpjLookupTimeoutRef.current = setTimeout(() => {
      cnpjLookupTimeoutRef.current = null;
      void lookupCnpj(digits);
    }, 250);

    return clearScheduledCnpjLookup;
  }, [clearScheduledCnpjLookup, form.cnpj, lookupCnpj, modalOpen]);

  function closeModal() {
    clearScheduledCnpjLookup();
    cnpjLookupAbortRef.current?.abort();
    cnpjLookupAbortRef.current = null;
    setModalOpen(false);
    setEditingClientId(null);
    setForm(blankForm);
    setShowPassword(false);
    setCnpjLookupLoading(false);
    setCnpjLookupMessage(null);
    setLastLookupCnpj("");
  }

  function openCreateModal() {
    clearScheduledCnpjLookup();
    cnpjLookupAbortRef.current?.abort();
    cnpjLookupAbortRef.current = null;
    setEditingClientId(null);
    setForm(blankForm);
    setShowPassword(false);
    setCnpjLookupLoading(false);
    setCnpjLookupMessage(null);
    setLastLookupCnpj("");
    setModalOpen(true);
  }

  function openEditModal(client: ClientRecord) {
    clearScheduledCnpjLookup();
    cnpjLookupAbortRef.current?.abort();
    cnpjLookupAbortRef.current = null;
    setEditingClientId(client.id);
    setForm(formFromClient(client));
    setShowPassword(false);
    setCnpjLookupLoading(false);
    setCnpjLookupMessage(null);
    setLastLookupCnpj(client.cnpj.replace(/\D/g, ""));
    setModalOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        companyName: form.companyName,
        cnpj: form.cnpj.replace(/\D/g, ""),
        industry: form.industry,
        taxRegime: form.taxRegime,
        address: form.address,
        email: form.email,
        phone: form.phone,
        representativeName: form.representativeName,
        accessEmail: form.accessEmail,
        password: form.password,
      };

      const response = await fetch(
        editingClientId ? `/api/clients/${editingClientId}` : "/api/clients",
        {
          method: editingClientId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = (await response.json()) as {
        error?: string;
        client?: ClientRecord;
      };

      if (!response.ok || !result.client) {
        throw new Error(result.error || "Nao foi possivel salvar o cliente");
      }

      setClients((current) => {
        if (editingClientId) {
          return current.map((client) =>
            client.id === result.client!.id ? result.client! : client
          );
        }
        return [result.client!, ...current];
      });

      closeModal();
      window.alert(editingClientId ? "Cliente atualizado com sucesso." : "Cliente cadastrado com sucesso.");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Nao foi possivel salvar o cliente");
    } finally {
      setSaving(false);
    }
  }

  async function toggleClient(client: ClientRecord) {
    const nextStatus = client.active ? "inactive" : "active";

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const result = (await response.json()) as {
        error?: string;
        client?: ClientRecord;
      };

      if (!response.ok || !result.client) {
        throw new Error(result.error || "Nao foi possivel atualizar o status");
      }

      setClients((current) =>
        current.map((item) => (item.id === result.client!.id ? result.client! : item))
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Nao foi possivel atualizar o status");
    }
  }

  async function deleteClient(client: ClientRecord) {
    const confirmed = window.confirm(
      `Excluir a empresa ${client.name} e todos os dados vinculados a ela? Esta acao nao podera ser desfeita.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingClientId(client.id);

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as {
        error?: string;
        deleted?: boolean;
      };

      if (!response.ok || !result.deleted) {
        throw new Error(result.error || "Nao foi possivel excluir o cliente");
      }

      setClients((current) => current.filter((item) => item.id !== client.id));
      window.alert(`Cliente ${client.name} excluido com sucesso.`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Nao foi possivel excluir o cliente");
    } finally {
      setDeletingClientId(null);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.9))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">
                Lista de Clientes
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Gerencie todos os seus clientes e os acessos do portal
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

            <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition",
                  viewMode === "list"
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                )}
                aria-label="Exibir em lista"
                aria-pressed={viewMode === "list"}
              >
                <List className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition",
                  viewMode === "grid"
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                )}
                aria-label="Exibir em grade"
                aria-pressed={viewMode === "grid"}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Configuracoes da lista"
            >
              <Settings2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)]"
            >
              <Plus className="h-4 w-4" />
              Novo Cliente
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {loading ? (
          <div className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,32,0.92))] p-8 text-center text-sm text-slate-400">
            Carregando clientes...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(12,22,40,0.9),rgba(10,18,32,0.84))] p-8 text-center">
            <p className="text-sm font-semibold text-slate-300">Nenhum cliente encontrado.</p>
            <p className="mt-2 text-sm text-slate-500">
              Ajuste a busca ou cadastre um novo cliente para continuar.
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,40,0.97),rgba(10,18,32,0.93))] shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
            <div className="hidden border-b border-white/6 px-5 py-3 xl:grid xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.35fr)_auto_auto] xl:items-center">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">
                Cliente
              </div>
              <div className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">
                Segmento
              </div>
              <div className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">
                CNPJ
              </div>
              <div className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">
                Status
              </div>
              <div className="text-right text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">
                Acoes
              </div>
            </div>

            <div className="divide-y divide-white/6">
              {filteredClients.map((client) => (
                <ClientListRow
                  key={client.id}
                  client={client}
                  onToggle={toggleClient}
                  onEdit={openEditModal}
                  onDelete={deleteClient}
                  deleting={deletingClientId === client.id}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <ClientCardView
                key={client.id}
                client={client}
                onToggle={toggleClient}
                onEdit={openEditModal}
                onDelete={deleteClient}
                deleting={deletingClientId === client.id}
              />
            ))}
          </div>
        )}
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
                    {editingClientId ? "Editar Cliente" : "Novo Cliente"}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {editingClientId
                      ? "Atualize os dados da empresa e do acesso do portal"
                      : "Cadastre uma nova empresa no sistema"}
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
                  <Field label="Razao Social" icon={Building2}>
                    <input
                      value={form.companyName}
                      onChange={(event) => updateForm("companyName", event.target.value)}
                      placeholder="Nome da Empresa"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>

	                  <Field label="CNPJ" icon={BriefcaseBusiness}>
	                    <div className="space-y-2">
	                      <input
	                        value={form.cnpj}
	                        onChange={(event) => {
	                          const nextValue = formatCnpj(event.target.value);
	                          updateForm("cnpj", nextValue);
	                          setCnpjLookupMessage(null);
	                          if (nextValue.replace(/\D/g, "").length < 14) {
	                            setLastLookupCnpj("");
	                          }
	                        }}
	                        onBlur={(event) => {
	                          clearScheduledCnpjLookup();
	                          void lookupCnpj(event.target.value);
	                        }}
	                        placeholder="00.000.000/0001-00"
	                        className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
	                      />
	                      <div className="flex min-h-5 items-center gap-2 text-[0.68rem]">
	                        {cnpjLookupLoading ? (
	                          <>
	                            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-300" />
	                            <span className="text-cyan-300">Consultando CNPJ...</span>
	                          </>
	                        ) : cnpjLookupMessage ? (
	                          <span
	                            className={cn(
	                              "font-semibold",
	                              cnpjLookupMessage.startsWith("Dados")
	                                ? "text-emerald-300"
	                                : "text-amber-300"
	                            )}
	                          >
	                            {cnpjLookupMessage}
	                          </span>
	                        ) : (
	                          <span className="text-slate-500">
	                            Ao informar o CNPJ completo, os dados da empresa serao preenchidos automaticamente.
	                          </span>
	                        )}
	                      </div>
	                    </div>
	                  </Field>

                  <Field label="Setor/Ramo" icon={Globe2}>
                    <input
                      value={form.industry}
                      onChange={(event) => updateForm("industry", event.target.value)}
                      placeholder="Ex: Tecnologia"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>

                  <Field label="Regime Tributario" icon={FileText}>
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
                  <h3 className="text-lg font-bold text-white">Localizacao e Contato</h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Endereco Completo" icon={MapPin} full>
                    <input
                      value={form.address}
                      onChange={(event) => updateForm("address", event.target.value)}
                      placeholder="Rua, Numero, Bairro, Cidade - UF"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </Field>

                  <Field label="Email da Empresa" icon={Mail}>
                    <input
                      value={form.email}
                      onChange={(event) => updateForm("email", event.target.value)}
                      placeholder="empresa@cliente.com"
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
                  <h3 className="text-lg font-bold text-white">Criador de Acesso</h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome do Representante" icon={UserRound}>
                    <input
                      value={form.representativeName}
                      onChange={(event) => updateForm("representativeName", event.target.value)}
                      placeholder="Nome do Socio/Gestor"
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

                  <Field
                    label={editingClientId ? "Nova Senha do Cliente" : "Senha do Cliente *"}
                    icon={ShieldCheck}
                    full
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(event) => updateForm("password", event.target.value)}
                          placeholder={
                            editingClientId
                              ? "Preencha apenas se quiser trocar"
                              : "Digite uma senha forte"
                          }
                          className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {(!editingClientId || form.password.length > 0) && (
                        <div className="rounded-2xl border border-white/8 bg-[#0f1a2b] px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">
                              Forca da senha
                            </p>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.18em]",
                                passwordStrengthReady
                                  ? "border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                                  : "border border-amber-400/20 bg-amber-500/10 text-amber-300"
                              )}
                            >
                              {passwordStrengthReady ? "Senha forte" : "Ajustar senha"}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {passwordRequirements.map((item) => (
                              <div key={item.label} className="flex items-center gap-2 text-sm">
                                {item.met ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                                ) : (
                                  <Circle className="h-4 w-4 text-slate-500" />
                                )}
                                <span className={item.met ? "text-emerald-100" : "text-slate-400"}>
                                  {item.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] px-5 py-4 text-sm font-bold text-white shadow-[0_18px_48px_rgba(25,182,255,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <BadgeCheck className="h-4 w-4" />
                  {saving
                    ? "Salvando..."
                    : editingClientId
                      ? "Salvar Alteracoes"
                      : "Finalizar Cadastro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
