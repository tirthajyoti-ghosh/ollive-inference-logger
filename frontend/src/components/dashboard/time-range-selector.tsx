"use client";

import { cn } from "@/lib/utils";

const RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
] as const;

interface TimeRangeSelectorProps {
  hours: number;
  onChange: (hours: number) => void;
}

export function TimeRangeSelector({ hours, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="glass rounded-xl p-1 flex items-center gap-0.5">
      {RANGES.map(({ label, hours: h }) => (
        <button
          key={h}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all",
            hours === h
              ? "bg-primary/10 text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(h)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
