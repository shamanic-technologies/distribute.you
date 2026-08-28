// WHO performs an arrow nobody sells us a campaign for.
//
// A funnel is sold leg by leg. The arrows we automate are campaigns and name their
// acquisition channel; the rest are worked by hand — and "by hand" is two different
// parties, which the table read as one. It said `Done by you` on every unclaimed
// arrow, including the two we do ourselves: a customer who reads that on
// `Sales interest -> Meeting booked` concludes nobody is answering the replies their
// budget just bought, when in fact we answer them.
//
// So an unclaimed arrow states its operator the same way a claimed one states its
// channel: `Via <mark> <name> team`.
//
// The split is by ARROW, not by funnel. Two arrows are ours today because a person on
// our side does them — replying to a sales interest until a meeting is on the calendar,
// then chasing the show-up. Everything else belongs to the brand: closing a deal, and
// the two arrows a lead walks on the brand's own site (a visit into a signup or a
// filled form), where the page is theirs and no one on our side touches it.
//
// TEMPORARY BY CONSTRUCTION, and that is the point of keeping it a closed set: both
// platform arrows are ones we mean to sell as channels (an AI closer answering sales
// interests, a scheduler chasing show-up). The day a channel performs one, the arrow
// arrives with a `featureSlug` and never reaches this catalogue at all — a campaign
// states its channel, and only an arrow no campaign performs asks this question.
//
// Only value imports that carry no "@" alias live here, so this module stays directly
// unit-testable (vitest does not resolve the alias).

/** Who works an arrow no campaign of ours performs. */
export type FunnelLegOperator = "platform" | "customer";

/** The catalogue key: the step the arrow leaves and the step it lands on, in the
 *  producer's own tokens. Byte-equal to `funnelLegMarkKey`, restated rather than
 *  imported so this module stays a plain leaf. */
function key(from: string | null | undefined, to: string): string {
  return `${from ?? ""}->${to}`;
}

/**
 * The arrows OUR team works by hand today.
 *
 * Both are conversation work on a lead our own outreach produced: someone here replies
 * to the sales interest until a meeting is booked, then makes sure it is attended. A
 * brand that bought a reply-led funnel is not expected to do either.
 */
const PLATFORM_LEGS: ReadonlySet<string> = new Set([
  key("conversation", "meeting_booked"),
  key("meeting_booked", "meeting_attended"),
]);

/**
 * Who works this arrow when no campaign performs it.
 *
 * The DEFAULT is the customer, deliberately: an arrow we have not named here is one
 * nobody on our side touches, and claiming it would tell a brand we are doing work they
 * are in fact doing themselves. The wrong direction of this mistake is the expensive
 * one.
 */
export function funnelLegOperator(
  fromKey: string | null | undefined,
  toKey: string,
): FunnelLegOperator {
  return PLATFORM_LEGS.has(key(fromKey, toKey)) ? "platform" : "customer";
}

/** What the second line reads: `Distribute.you team` or `<Brand> team`. */
export function funnelLegOperatorLabel(
  operator: FunnelLegOperator,
  brandName: string | null | undefined,
): string {
  if (operator === "platform") return "Distribute.you team";
  const named = brandName?.trim();
  // A brand whose name has not resolved yet still states WHOSE team it is, in the only
  // words that are true without it. "Done by you" is what this replaces, so falling
  // back to it would reintroduce the sentence on exactly the rows the name is slowest
  // on.
  return named ? `${named} team` : "Your team";
}
