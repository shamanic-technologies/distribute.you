// THE OUTBOUND LEG RENAME (LOCKED, owner 2026-10-09), read side.
//
// "Lead found" is a normal step, so an OUTBOUND channel's leg starts on the found lead:
//     start_to_conversation   ->  lead_found_to_conversation
//     start_to_website_visit  ->  lead_found_to_website_visit
// for the outbound features ONLY. The same legacy key on any other feature (ads, SEO,
// organic, PR) is NOT renamed (google-ads keeps start_to_website_visit), and sourcing
// keeps start_to_lead_found.
//
// Every backend accepts both spellings as one identity. During wave 2 each service
// migrates on its own day, so this app reads the legacy spelling from some and the new
// one from others. Every join of a leg key read from two services goes through here, so
// the comparison is new-vs-new whatever each producer sent (persisted caches included:
// the join canonicalizes, not the fetch).
//
// features-service publishes the correspondence and each channel's `channelType` on
// `GET /public/channels`; this module is a LOCKED static copy because its callers are
// pure libs with no catalogue in reach. `legCatalogueFromWire` checks the copy against
// the served list and logs loudly on drift. DELETE this module once no backend serves
// a legacy outbound key any more.
//
// Alias-free on purpose (no runtime import at all) so it carries REAL unit tests.

/** The outbound features (features-service `channelType: "outbound"`), LOCKED 2026-10-09. */
export const OUTBOUND_FEATURE_SLUGS: ReadonlySet<string> = new Set([
  "sales-cold-email-outreach",
  "feedback-request-cold-email-outreach",
  "sales-crm-email-outreach",
  "cold-call-outreach",
  "cold-instagram-outreach",
  "cold-linkedin-outreach",
  "cold-reddit-outreach",
  "cold-sms-outreach",
  "cold-whatsapp-outreach",
  "cold-x-outreach",
]);

/** The new outbound leg keys, the spelling this app WRITES. */
export const OUTBOUND_LEG_TO_CONVERSATION = "lead_found_to_conversation";
export const OUTBOUND_LEG_TO_WEBSITE_VISIT = "lead_found_to_website_visit";

/** legacy -> new, outbound only. */
export const OUTBOUND_LEG_KEY_RENAME: Readonly<Record<string, string>> = {
  start_to_conversation: OUTBOUND_LEG_TO_CONVERSATION,
  start_to_website_visit: OUTBOUND_LEG_TO_WEBSITE_VISIT,
};

const LEGACY_OF_NEW: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(OUTBOUND_LEG_KEY_RENAME).map(([legacy, next]) => [next, legacy]),
);

export function isOutboundFeature(featureSlug: string | null | undefined): boolean {
  return !!featureSlug && OUTBOUND_FEATURE_SLUGS.has(featureSlug);
}

/**
 * The one spelling of a (feature, leg) this app compares on: the NEW key for an outbound
 * feature, every other key verbatim (a non-outbound legacy key stays legacy).
 */
export function canonicalLegKey(featureSlug: string | null | undefined, legKey: string): string;
export function canonicalLegKey(featureSlug: string | null | undefined, legKey: string | null | undefined): string | null;
export function canonicalLegKey(featureSlug: string | null | undefined, legKey: string | null | undefined): string | null {
  if (!legKey) return legKey ?? null;
  if (!isOutboundFeature(featureSlug)) return legKey;
  return Object.hasOwn(OUTBOUND_LEG_KEY_RENAME, legKey) ? OUTBOUND_LEG_KEY_RENAME[legKey] : legKey;
}

/** The step a renamed outbound leg starts on. */
export const LEAD_FOUND_STEP = "lead_found";

/**
 * True when a leg starting on `fromKey` is PROACTIVE (it prospects, spends a daily budget):
 * it starts from nothing OR from a found lead. Mirrors features-service
 * `isProactiveTransition`; never read `fromKey === null` alone, because the renamed
 * outbound legs start on `lead_found` once features-service serves the new spelling.
 */
export function isProactiveFrom(fromKey: string | null | undefined): boolean {
  return fromKey == null || fromKey === LEAD_FOUND_STEP;
}

/** The other spelling of a renamed outbound leg key, or null for a key the rename never touched. */
export function legKeyTwin(legKey: string | null | undefined): string | null {
  if (!legKey) return null;
  if (Object.hasOwn(OUTBOUND_LEG_KEY_RENAME, legKey)) return OUTBOUND_LEG_KEY_RENAME[legKey];
  if (Object.hasOwn(LEGACY_OF_NEW, legKey)) return LEGACY_OF_NEW[legKey];
  return null;
}

/**
 * Two leg keys naming the same leg when no feature is in reach (a leg-level read: rates,
 * maturity legs, a leg catalogue). The new spelling exists only for outbound legs, and
 * features-service resolves it slug-free the same way, so twin equality is exact here.
 */
export function sameLegKey(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return a == b;
  return a === b || legKeyTwin(a) === b;
}

/** `slug|legKey` with the canonical spelling: the key of every (feature, leg) map. */
export function featureLegId(featureSlug: string, legKey: string): string {
  return `${featureSlug}|${canonicalLegKey(featureSlug, legKey)}`;
}

/**
 * Drift between the LOCKED copy above and what features-service serves, as one message
 * per mismatch (empty = in step). The caller logs; nothing here throws, because the
 * catalogue still names every leg either way.
 */
export function outboundRenameDrift(
  served: ReadonlyArray<{ legacyLegKey?: unknown; legKey?: unknown }> | null | undefined,
  channelTypes: ReadonlyMap<string, string> | null,
): string[] {
  const out: string[] = [];
  if (served) {
    const pairs = new Map<string, string>();
    for (const c of served) if (typeof c?.legacyLegKey === "string" && typeof c?.legKey === "string") pairs.set(c.legacyLegKey, c.legKey);
    for (const [legacy, next] of Object.entries(OUTBOUND_LEG_KEY_RENAME)) {
      if (pairs.get(legacy) !== next) out.push(`legKeyCorrespondence: ${legacy} -> ${pairs.get(legacy) ?? "absent"}, locked ${next}`);
    }
    for (const [legacy, next] of pairs) {
      if (!Object.hasOwn(OUTBOUND_LEG_KEY_RENAME, legacy)) out.push(`legKeyCorrespondence: unknown pair ${legacy} -> ${next}`);
    }
  }
  // Only channels the public catalogue lists can be judged: a feature it does not publish says nothing.
  for (const [slug, type] of channelTypes ?? []) {
    if ((type === "outbound") !== OUTBOUND_FEATURE_SLUGS.has(slug)) out.push(`channelType ${type} disagrees with the locked list: ${slug}`);
  }
  return out;
}
