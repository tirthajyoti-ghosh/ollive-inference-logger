import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { Sidebar } from "@/components/layout/sidebar";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ollive — Inference Logger",
  description: "Monitor and manage LLM inference across providers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-background text-foreground">
        {/* Ambient background */}
        <div className="fixed inset-0 bg-dot-grid pointer-events-none" />
        <div className="fixed top-0 left-0 w-[600px] h-[600px] ambient-orb bg-amber/[0.02]" />
        <div className="fixed bottom-0 right-0 w-[400px] h-[400px] ambient-orb bg-[#38bdf8]/[0.015]" style={{ animationDelay: "-7s" }} />

        <Sidebar />
        <main className="flex-1 min-h-screen overflow-y-auto relative">
          {children}
        </main>
      </body>
    </html>
  );
}
