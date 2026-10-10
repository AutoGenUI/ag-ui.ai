import type { Metadata } from "next";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });


export async function generateMetadata(): Promise<Metadata> {
  const base = new URL("https://ag-ui.ai");
  return {
    metadataBase: base,
    title: { default: "AG-UI.AI — Generative UI intelligence", template: "%s · AG-UI.AI" },
    description: "Independent, source-linked news, research and perspectives on Generative UI.",
    applicationName: "AG-UI.AI",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${geist.variable} ${geistMono.variable}`}><body className="antialiased"><TooltipProvider>{children}</TooltipProvider></body></html>;
}
