"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneMode());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const canInstall = useMemo(() => !installed && deferredPrompt !== null, [deferredPrompt, installed]);

  async function handleInstall() {
    if (!deferredPrompt) {
      return;
    }

    setInstalling(true);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  }

  if (installed) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100",
          className
        )}
      >
        <Smartphone className="h-4 w-4" />
        App instalado
      </div>
    );
  }

  if (!canInstall) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void handleInstall()}
      disabled={installing}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-slate-100 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60",
        compact && "w-full",
        className
      )}
    >
      <Download className="h-4 w-4" />
      {installing ? "Preparando instalacao..." : "Instalar app"}
    </button>
  );
}
