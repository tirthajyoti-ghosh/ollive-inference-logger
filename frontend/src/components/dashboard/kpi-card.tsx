"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  glowColor?: string;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  glowColor = "rgba(245,158,11,0.06)",
  loading,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <Skeleton className="h-3 w-20 bg-white/5" />
            <Skeleton className="h-8 w-28 bg-white/5" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="glass-card rounded-2xl p-5 animate-fade-up group"
      style={{ boxShadow: `0 0 40px -12px ${glowColor}` }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            {label}
          </p>
          <p className="text-[26px] font-bold tracking-tight mt-1.5 metric-value font-mono text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${iconColor} bg-current/[0.08] transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
    </div>
  );
}
