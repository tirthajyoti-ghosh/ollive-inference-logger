"use client";

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
    <div className="segmented">
      {RANGES.map(({ label, hours: h }) => (
        <button
          key={h}
          className={hours === h ? "active" : ""}
          onClick={() => onChange(h)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
