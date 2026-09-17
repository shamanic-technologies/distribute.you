// TURNING A PAID SELECTION INTO A BRAND THAT RUNS.
//
// Money is taken before there is a brand: the visitor pays per funnel, and only
// then is asked for their website. So this is the step where the two halves meet
// -- the brand is created, and every funnel they PAID for gets its daily budget
// written against it, per channel.
//
// A BUDGET IS PER (brand, funnel, channel). billing keys it on that triple, so a
// funnel bought through three channels is three writes, each carrying that
// channel's own day rate. Writing the funnel's summed rate once would fund one
// channel with the money meant for three and leave the other two at zero.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

export interface FundableChannel {
  slug: string;
  dailyOperatingCostCents: number;
}

export interface FundableFunnel {
  key: string;
  channels: FundableChannel[];
}

/** One budget write: what billing needs to key the row. */
export interface BudgetWrite {
  funnelKey: string;
  featureSlug: string;
  dailyBudgetCents: number;
}

/**
 * The writes to make once the brand exists.
 *
 * ONLY the funnels that were actually paid for. A funnel the visitor skipped was
 * dropped from the selection rather than deferred, and funding one they never
 * bought would start spending their money on something they declined.
 *
 * A channel whose day rate is ZERO is still written. That zero is a STATEMENT --
 * it is how a customer-operated channel says nobody of ours is on it -- and
 * omitting the row would leave the pair unfunded and therefore unrunnable, which
 * is a different thing from free.
 */
export function budgetWrites(funnels: FundableFunnel[], paidKeys: string[]): BudgetWrite[] {
  const paid = new Set(paidKeys);
  const out: BudgetWrite[] = [];
  for (const f of funnels) {
    if (!paid.has(f.key)) continue;
    for (const c of f.channels) {
      out.push({
        funnelKey: f.key,
        featureSlug: c.slug,
        dailyBudgetCents: c.dailyOperatingCostCents,
      });
    }
  }
  return out;
}

/** What the brand will spend a day once every write lands. Stated to the
 *  customer on the way out, so the first invoice is never a surprise. */
export function totalDailyCents(writes: BudgetWrite[]): number {
  return writes.reduce((sum, w) => sum + w.dailyBudgetCents, 0);
}

/**
 * Whether a write is worth attempting at all.
 *
 * An empty plan means the visitor paid for funnels whose channels the catalogue
 * no longer sells -- so the brand would be created with nothing behind it. That
 * is a state to SURFACE, never to paper over by creating the brand anyway.
 */
export function planIsRunnable(writes: BudgetWrite[]): boolean {
  return writes.length > 0;
}
