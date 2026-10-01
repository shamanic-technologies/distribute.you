import { z } from "zod";

/**
 * The brand's ONE daily sales budget (beta), billing-service's
 * `/v1/brands/:brandId/sales-budget`. A brand is in "campaigns" mode (each
 * campaign on its own ceiling, the default) or "global" mode (one daily budget
 * for sales, which campaign-service spends on the best-ROI sales path first;
 * legs set off by a step always run while authorised). The mode is READ, never
 * inferred from a null.
 *
 * Alias-free (only zod) so it carries real unit tests. Keep it that way.
 */
export const BrandSalesBudgetSchema = z
  .object({
    brandId: z.string(),
    mode: z.string(),
    // billing serialises cents as a string; coerce, and keep null as null.
    dailyBudgetCents: z.union([z.string(), z.number()]).nullable(),
    updatedAt: z.string().nullable(),
  })
  .passthrough();

export type BrandSalesBudget = z.infer<typeof BrandSalesBudgetSchema>;

export function parseBrandSalesBudget(raw: unknown, where: string): BrandSalesBudget {
  const parsed = BrandSalesBudgetSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[${where}] invalid response shape`, parsed.error.issues, raw);
    throw new Error(`[${where}] invalid response shape`);
  }
  return parsed.data;
}

/** The global budget in whole dollars, or null when the brand is not in global mode. */
export function globalBudgetUsd(b: BrandSalesBudget | undefined | null): number | null {
  if (!b || b.mode !== "global" || b.dailyBudgetCents == null) return null;
  const cents = typeof b.dailyBudgetCents === "number" ? b.dailyBudgetCents : Number(b.dailyBudgetCents);
  if (typeof b.dailyBudgetCents === "string" && b.dailyBudgetCents.trim() === "") return null;
  return Number.isFinite(cents) ? Math.round(cents) / 100 : null;
}

/**
 * What the field holds, as cents to send, or the reason it cannot be sent.
 * A daily budget is whole dollars; 0 is a real answer (spend nothing).
 */
export function parseBudgetInput(text: string): { cents: number } | { error: string } {
  const t = text.trim().replace(/^\$/, "").replace(/,/g, "");
  if (t === "") return { error: "Enter a daily budget in dollars." };
  if (!/^\d+$/.test(t)) return { error: "Whole dollars only." };
  const usd = Number(t);
  if (!Number.isSafeInteger(usd)) return { error: "That amount is too large." };
  return { cents: usd * 100 };
}
