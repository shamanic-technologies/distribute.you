import type { StatsRegistryEntry } from "@/lib/api";

export function formatStatValue(value: number | null | undefined, entry: StatsRegistryEntry | undefined): string {
  if (value === null || value === undefined) return "\u2014";
  if (!entry) return String(value);

  switch (entry.type) {
    case "count":
      return value.toLocaleString();
    case "rate":
      if (value === 0) return "\u2014";
      return `${(value * 100).toFixed(1)}%`;
    case "currency":
      if (value === 0) return "\u2014";
      return `$${(value / 100).toFixed(2)}`;
    default:
      return String(value);
  }
}

export function sortDirectionForType(type: StatsRegistryEntry["type"] | undefined): "asc" | "desc" {
  return type === "currency" ? "asc" : "desc";
}
