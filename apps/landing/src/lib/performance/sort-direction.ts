export type SortKey = "openRate" | "clickRate" | "replyRate" | "costPerOpenCents" | "costPerClickCents" | "costPerReplyCents" | "emailsSent" | "totalCostUsdCents" | "runCount";

const COST_KEYS: Set<SortKey> = new Set(["costPerOpenCents", "costPerClickCents", "costPerReplyCents"]);

export const defaultDir = (key: SortKey): "asc" | "desc" => COST_KEYS.has(key) ? "asc" : "desc";

export function compareForSort(
  av: number | string | null | undefined,
  bv: number | string | null | undefined,
  dir: "asc" | "desc",
): number {
  const a = Number(av ?? 0);
  const b = Number(bv ?? 0);
  const aZero = a === 0;
  const bZero = b === 0;
  if (aZero && bZero) return 0;
  if (aZero) return 1;
  if (bZero) return -1;
  return dir === "desc" ? b - a : a - b;
}
