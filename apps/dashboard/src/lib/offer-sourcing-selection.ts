import { z } from "zod";
import { roiIsGood } from "./format-roi";

/**
 * Which sourcing origins an offer uses (owner 2026-10-07): each Sourcing row is a checkbox,
 * like the offer's sales paths. brand-service stores what the customer STATED (origin
 * slugs, stored as given); until anything is stated, the origins whose served ROI is above
 * break-even are ticked, the same default the sales paths take (`selectedPathKeys`).
 * Alias-free: unit-tested.
 */
/** brand-service GET/PUT `/brands/:brandId/offers/:offerId/selected-sourcing-origins`. */
export const OfferSelectedSourcingSchema = z.object({
  stated: z.boolean(),
  originSlugs: z.array(z.string()).nullable(),
});

export type StatedSourcing = z.infer<typeof OfferSelectedSourcingSchema>;

export interface SelectableOrigin {
  slug: string;
  live: boolean;
  roi: number | null;
}

/** A retired origin serves nothing any more: it can be read, never ticked. */
export function originSelectable(o: Pick<SelectableOrigin, "live">): boolean {
  return o.live;
}

/** The ticked origins: what the customer stated, else every selectable origin returning above break-even. */
export function selectedSourcingSlugs(saved: StatedSourcing, origins: readonly SelectableOrigin[]): ReadonlySet<string> {
  if (saved.stated && saved.originSlugs) return new Set(saved.originSlugs);
  return new Set(origins.filter((o) => originSelectable(o) && roiIsGood(o.roi)).map((o) => o.slug));
}

/** Tick or untick one origin; the full list goes out (the producer replaces the whole list). */
export function toggleSourcing(current: ReadonlySet<string>, slug: string, on: boolean): string[] {
  const next = new Set(current);
  if (on) next.add(slug);
  else next.delete(slug);
  return [...next];
}
