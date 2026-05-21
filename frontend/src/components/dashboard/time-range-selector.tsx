"use client";

import { Button } from "@/components/ui/button";
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
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {RANGES.map(({ label, hours: h }) => (
        <Button
          key={h}
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-3 text-xs font-medium rounded-md",
            hours === h
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(h)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
