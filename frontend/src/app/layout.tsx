import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { Sidebar } from "@/components/layout/sidebar";
import { BackendGate } from "@/components/layout/backend-gate";
import "./globals.css";

const geist = Geist({
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
    <html lang="en" className={`${geist.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex">
        <BackendGate>
          <Sidebar />
          <main className="flex-1 min-h-screen overflow-y-auto">{children}</main>
        </BackendGate>
      </body>
    </html>
  );
}
