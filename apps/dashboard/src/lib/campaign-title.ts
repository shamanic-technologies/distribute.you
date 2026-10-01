// What a campaign is CALLED, on every surface that names one.
//
// campaign-service stores a `name` on the row, written when the campaign was
// provisioned, and it says nothing reliable about the two facts that distinguish one
// campaign from another under the same offer: the LEG it buys and the CHANNEL it buys
// through. A title is therefore COMPOSED from those two.
//
// Only relative value imports live here, so this module stays directly unit-testable.

/**
 * A feature slug we carry no channel for, prettified. Named as the slug spells itself
 * rather than as a channel we do not carry.
 */
export function channelSlugLabel(featureSlug: string | null): string {
  if (!featureSlug) return "—";
  return featureSlug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

