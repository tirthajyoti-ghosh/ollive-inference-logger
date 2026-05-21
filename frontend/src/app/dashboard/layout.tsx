"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/latency", label: "Latency" },
  { href: "/dashboard/throughput", label: "Throughput" },
  { href: "/dashboard/errors", label: "Errors" },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time inference monitoring and analytics
        </p>
      </div>

      {/* Tab navigation */}
      <nav className="flex items-center gap-1 border-b border-border">
        {TABS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
