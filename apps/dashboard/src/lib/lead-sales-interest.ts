/**
 * Did THIS scope produce a sales interest?
 *
 * A sales interest is the first thing a campaign is bought for: the prospect replied
 * positively, or they came to the site. Both are facts the delivery layer observed,
 * so this reads them and decides nothing else.
 *
 * The evidence is whatever the CALLER states, which is what makes the answer scoped:
 * a campaign card carries that campaign's own delivery row, the brand roll-up carries
 * every campaign's. Handing one scope's evidence to another would answer a wider
 * question under a narrower name.
 *
 * Alias-free on purpose — it carries real unit tests. Keep it that way.
 */
export interface SalesInterestEvidence {
  /** The classifier's reading of the reply we received, when there was one. */
  replyClassification?: "positive" | "negative" | "neutral" | null;
  /** When they first came to the site. A website visit IS the interest. */
  firstClickedAt?: string | null;
}

export function hasSalesInterest(evidence: SalesInterestEvidence | null | undefined): boolean {
  if (!evidence) return false;
  // A NEGATIVE or NEUTRAL reply is not an interest, and an absent classification is
  // "we could not tell" rather than a yes — neither unlocks anything.
  if (evidence.replyClassification === "positive") return true;
  // An empty string is the wire's way of saying no instant, not a visit.
  return typeof evidence.firstClickedAt === "string" && evidence.firstClickedAt.length > 0;
}
