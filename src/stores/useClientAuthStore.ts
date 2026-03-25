"use client";

import { create } from "zustand";

export interface ClientAuthUser {
  id: string;
  name: string;
  cnpj: string;
  email?: string;
  accounting_id: string;
  accounting: {
    id: string;
    name: string;
  };
}

interface ClientAuthStore {
  client: ClientAuthUser | null;
  status: "unknown" | "authenticated" | "anonymous";
  setSession: (client: ClientAuthUser) => void;
  logout: () => void;
}

export const useClientAuthStore = create<ClientAuthStore>((set) => ({
  client: null,
  status: "unknown",

  setSession: (client) => set({ client, status: "authenticated" }),

  logout: () => {
    set({ client: null, status: "anonymous" });
    fetch("/api/auth/client-logout", { method: "POST" }).catch(() => {});
  },
}));
