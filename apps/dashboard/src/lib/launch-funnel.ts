// Which sales funnel the campaign created at the end of onboarding sells.
//
// A campaign runs ONE sales funnel: it is paced on that funnel's own daily
// ceiling in billing and priced on that funnel's own economics, so campaign-service
// refuses to create a sales campaign that states none. Nothing infers it, here or
// there.
//
// The customer routinely funds SEVERAL funnels a few seconds earlier, and only one
// campaign is created from the browser: campaign-service provisions the rest, one
// per funded funnel, on its next tick. So this picks one funded funnel, and the
// pick has to be DETERMINISTIC — re-running the same launch must always name the
// same funnel, or a retry creates a second campaign for a second funnel.
//
// Only relative value imports live here, so this module stays directly
// unit-testable (vitest does not resolve the "@" alias).

import {
  SALES_FUNNELS,
  canonicalSalesFunnelKey,
  normalizeSalesFunnelKey,
  type CanonicalSalesFunnelKey,
  type SalesFunnelKey,
} from "./sales-funnels";

/** What each funnel is funded with, in whole dollars per day, keyed by funnel. */
export type FunnelBudgetMap = Record<string, number>;

/**
 * The funded funnel this launch's campaign states, in the canonical spelling.
 *
 * Order of the pick, and it never leaves the funded set:
 *   1. the funnel the customer marked primary, when they funded it — it is the
 *      one they said they optimize for first;
 *   2. otherwise the first funded funnel in catalogue order, which is stable
 *      across renders, reloads and the Stripe round-trip.
 *
 * Returns null when NOTHING is funded. That is a launch with no funnel in hand,
 * which is a bug to surface rather than a funnel to invent — the caller states
 * it plainly instead of sending a plausible-looking default the customer never
 * funded and billing never paces.
 */
export function fundedLaunchFunnelKey(
  funnelBudgets: FunnelBudgetMap,
  primaryFunnelKey: string | null,
): CanonicalSalesFunnelKey | null {
  const funded = new Set<SalesFunnelKey>();
  for (const [key, usd] of Object.entries(funnelBudgets)) {
    if (!(usd > 0)) continue;
    const normalized = safeNormalize(key);
    if (normalized) funded.add(normalized);
  }
  if (funded.size === 0) return null;

  const primary = primaryFunnelKey ? safeNormalize(primaryFunnelKey) : null;
  if (primary && funded.has(primary)) return canonicalSalesFunnelKey(primary);

  const firstInCatalogue = SALES_FUNNELS.find((f) => funded.has(f.key));
  return firstInCatalogue ? canonicalSalesFunnelKey(firstInCatalogue.key) : null;
}

/**
 * A funnel key we cannot name reads as absent, never as a fifth funnel.
 *
 * The map survives a Stripe round-trip through session storage, so a key written
 * by an older build (or hand-edited) can reach here; `normalizeSalesFunnelKey`
 * throws on a spelling neither catalogue lists, and a throw on the launch path
 * would strand a customer who has already paid.
 */
function safeNormalize(key: string): SalesFunnelKey | null {
  try {
    return normalizeSalesFunnelKey(key as SalesFunnelKey);
  } catch {
    console.error(`[dashboard] launch carries an unnamable sales funnel key: ${key}`);
    return null;
  }
}
