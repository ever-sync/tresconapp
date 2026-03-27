"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

import { useClientAuthStore, type ClientAuthUser } from "@/stores/useClientAuthStore";

const PortalClientContext = createContext<ClientAuthUser | null>(null);

export function PortalClientProvider({
  children,
  initialClient,
}: {
  children: ReactNode;
  initialClient: ClientAuthUser | null;
}) {
  const setSession = useClientAuthStore((state) => state.setSession);

  useEffect(() => {
    if (initialClient) {
      setSession(initialClient);
    }
  }, [initialClient, setSession]);

  return (
    <PortalClientContext.Provider value={initialClient}>
      {children}
    </PortalClientContext.Provider>
  );
}

export function usePortalClient() {
  const storeClient = useClientAuthStore((state) => state.client);
  const initialClient = useContext(PortalClientContext);

  return storeClient ?? initialClient;
}
