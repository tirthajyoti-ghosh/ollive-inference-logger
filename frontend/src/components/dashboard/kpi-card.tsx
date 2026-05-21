"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  loading,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 hover:bg-accent/20 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
