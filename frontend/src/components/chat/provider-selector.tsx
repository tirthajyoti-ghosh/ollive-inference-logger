"use client";

import { useEffect, useState } from "react";
import { getProviders } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProviderSelectorProps {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
}

export function ProviderSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
}: ProviderSelectorProps) {
  const [providers, setProviders] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProviders()
      .then((data) => {
        setProviders(data.providers);
        // Auto-select first provider/model if not set
        const providerKeys = Object.keys(data.providers);
        if (!provider && providerKeys.length > 0) {
          const first = providerKeys[0];
          onProviderChange(first);
          const models = data.providers[first];
          if (models.length > 0) onModelChange(models[0]);
        } else if (provider && !model) {
          const models = data.providers[provider];
          if (models?.length) onModelChange(models[0]);
        }
      })
      .catch(() => {
        // Fallback providers
        setProviders({
          openai: ["gpt-4o", "gpt-4o-mini"],
          anthropic: ["claude-sonnet-4-20250514"],
        });
      })
      .finally(() => setLoading(false));
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProviderChange = (val: string | null) => {
    if (!val) return;
    onProviderChange(val);
    // Auto-select first model for the new provider
    const models = providers[val];
    if (models?.length) onModelChange(models[0]);
  };

  const providerKeys = Object.keys(providers);
  const models = providers[provider] || [];

  if (loading) {
    return (
      <div className="flex gap-2">
        <div className="h-9 w-32 rounded-[9px] animate-pulse" style={{ background: "var(--bg-2)" }} />
        <div className="h-9 w-48 rounded-[9px] animate-pulse" style={{ background: "var(--bg-2)" }} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={provider} onValueChange={handleProviderChange}>
        <SelectTrigger className="input-custom w-36 h-9 text-xs">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          {providerKeys.map((p) => (
            <SelectItem key={p} value={p} className="text-xs">
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={model} onValueChange={(v) => { if (v) onModelChange(v); }}>
        <SelectTrigger className="input-custom w-52 h-9 text-xs">
          <SelectValue placeholder="Model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m} value={m} className="text-xs">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {provider && model && (
        <span className="badge badge-olive text-[10.5px]">
          {provider}/{model}
        </span>
      )}
    </div>
  );
}
