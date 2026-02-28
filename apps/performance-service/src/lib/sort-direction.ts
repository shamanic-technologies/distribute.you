export type SortKey = "openRate" | "clickRate" | "replyRate" | "costPerOpenCents" | "costPerClickCents" | "costPerReplyCents" | "emailsSent" | "totalCostUsdCents" | "runCount";

/** Cost columns where lower is better → default ascending; everything else → descending */
const COST_KEYS: Set<SortKey> = new Set(["costPerOpenCents", "costPerClickCents", "costPerReplyCents"]);

export const defaultDir = (key: SortKey): "asc" | "desc" => COST_KEYS.has(key) ? "asc" : "desc";
