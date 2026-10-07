import { z } from "zod";
import { roiIsGood } from "./format-roi";

/**
 * What the customer STATES about an offer's sales paths beyond its ticked legs
 * (brand-service, through the gateway):
 *
 *  - the CHANNELS the offer accepts (`/brands/:id/offers/:offerId/channels`). Never
 *    stated (`stated: false`, `channelSlugs: null`) is not the same as stated empty;
 *    features-service reads "never stated" as the channels we run.
 *
 * Alias-free (only zod) so it carries real unit tests.
 */

export const OfferChannelsSchema = z
  .object({
    offerId: z.string(),
    stated: z.boolean(),
    channelSlugs: z.array(z.string()).nullable(),
    statedAt: z.string().nullable(),
  })
  .passthrough();
export type OfferChannels = z.infer<typeof OfferChannelsSchema>;

export function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, where: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[${where}] invalid response shape`, parsed.error.issues, raw);
    throw new Error(`[${where}] invalid response shape`);
  }
  return parsed.data;
}

/**
 * The sales paths the customer TICKED on the offer (brand-service
 * `/brands/:id/offers/:offerId/selected-sales-paths`, features-service combinationKeys).
 * Never stated = the paths returning more than they cost (ROI > 1x) are ticked.
 */
export const OfferSelectedSalesPathsSchema = z
  .object({
    offerId: z.string(),
    stated: z.boolean(),
    combinationKeys: z.array(z.string()).nullable(),
    statedAt: z.string().nullable(),
  })
  .passthrough();
export type OfferSelectedSalesPaths = z.infer<typeof OfferSelectedSalesPathsSchema>;

/** The ticked paths: what the customer stated, else every path with a return above 1x. */
export function selectedPathKeys(
  data: OfferSelectedSalesPaths,
  paths: ReadonlyArray<{ combinationKey: string; roi: number | null }>,
): ReadonlySet<string> {
  if (data.stated && data.combinationKeys) return new Set(data.combinationKeys);
  return new Set(paths.filter((p) => roiIsGood(p.roi)).map((p) => p.combinationKey));
}

/** Tick or untick one path; the full list goes out (the producer replaces the whole list). */
export function togglePath(current: ReadonlySet<string>, key: string, on: boolean): string[] {
  const next = new Set(current);
  if (on) next.add(key);
  else next.delete(key);
  return [...next];
}

/** A channel an offer can accept, as the catalogue publishes it. */
export interface SalesPathChannel {
  slug: string;
  name: string;
  /** We run it today. */
  managed: boolean;
  /** The customer's own team works it (your-team-*). */
  customerOperated: boolean;
  /** The one-line caption printed under the name on a channel card. */
  shortDescription: string | null;
}

/**
 * The channels a sales path can use, in the producer's order: every catalogue channel
 * features-service marks `salesPathEligible`. A channel missing a name or the flags is a
 * producer gap, said out loud and left out rather than guessed.
 */
export function salesPathChannels(
  channels: ReadonlyArray<{ slug: string; name?: string; managed?: boolean; salesPathEligible?: boolean; operatedBy?: string; shortDescription?: string }>,
): SalesPathChannel[] {
  const out: SalesPathChannel[] = [];
  for (const c of channels) {
    if (c.salesPathEligible !== true) continue;
    if (!c.name || c.managed === undefined) {
      console.error("[offer-active-sales-paths] eligible channel served without name or managed flag", c);
      continue;
    }
    if (!c.shortDescription) {
      console.error("[offer-active-sales-paths] eligible channel served without shortDescription", c.slug);
    }
    out.push({
      slug: c.slug,
      name: c.name,
      managed: c.managed,
      customerOperated: c.operatedBy === "customer",
      shortDescription: c.shortDescription ?? null,
    });
  }
  return out;
}

/**
 * Channels we do not run yet that staff may tick in staff mode (owner 2026-10-07: LinkedIn
 * Posting, "Contact us on GA, activable on Staff mode"). A customer keeps the Contact us card.
 */
export const STAFF_ACTIVABLE_CHANNEL_SLUGS: ReadonlySet<string> = new Set(["organic-linkedin-publishing"]);

/** Whether this card ticks on a click (else it opens the contact form). */
export function channelSelectable(c: Pick<SalesPathChannel, "slug" | "managed">, staffMode: boolean): boolean {
  return c.managed || (staffMode && STAFF_ACTIVABLE_CHANNEL_SLUGS.has(c.slug));
}

/** The channels an offer accepts, as a set. Never stated = the channels we run (features-service's reading). */
export function acceptedChannels(data: OfferChannels, channelsWeRun: readonly string[]): ReadonlySet<string> {
  return new Set(data.stated && data.channelSlugs ? data.channelSlugs : channelsWeRun);
}

/** Tick or untick one channel; the full list goes out (the producer replaces the whole list). */
export function toggleChannel(current: ReadonlySet<string>, slug: string, on: boolean): string[] {
  const next = new Set(current);
  if (on) next.add(slug);
  else next.delete(slug);
  return [...next];
}
