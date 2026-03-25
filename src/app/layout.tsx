import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TresContas — Plataforma Contábil",
  description: "Plataforma contábil com portal do cliente integrado",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
