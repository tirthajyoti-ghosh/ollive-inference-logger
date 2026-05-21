"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart3, Timer, Gauge, AlertCircle } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/dashboard/latency", label: "Latency", icon: Timer },
  { href: "/dashboard/throughput", label: "Throughput", icon: Gauge },
  { href: "/dashboard/errors", label: "Errors", icon: AlertCircle },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Real-time inference monitoring and analytics
        </p>
      </div>

      {/* Tab navigation */}
      <nav className="flex items-center gap-1 glass rounded-2xl p-1.5 animate-fade-up stagger-1 w-fit">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200",
                active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
