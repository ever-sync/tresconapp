import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TresContas - Plataforma Contabil",
  description: "Plataforma contabil com portal do cliente integrado",
  applicationName: "TresContas",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TresContas",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/trescontas-mark.png",
    shortcut: "/trescontas-mark.png",
    apple: "/trescontas-mark.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#07111f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
