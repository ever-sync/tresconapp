"use client";

import { create } from "zustand";

export interface StaffAuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatar_url?: string;
  mfa_enabled: boolean;
  accounting_id: string;
  accounting: {
    id: string;
    name: string;
    cnpj: string;
    plan: string;
  };
}

interface AuthStore {
  user: StaffAuthUser | null;
  status: "unknown" | "authenticated" | "anonymous";
  setSession: (user: StaffAuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  status: "unknown",

  setSession: (user) => set({ user, status: "authenticated" }),

  logout: () => {
    set({ user: null, status: "anonymous" });
    // Call logout API
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  },
}));
