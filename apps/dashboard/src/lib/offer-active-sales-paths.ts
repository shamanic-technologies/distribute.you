import { z } from "zod";

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

/** A channel an offer can accept, as the catalogue publishes it. */
export interface SalesPathChannel {
  slug: string;
  name: string;
  /** We run it today. */
  managed: boolean;
  /** The customer's own team works it (your-team-*). */
  customerOperated: boolean;
}

/**
 * The channels a sales path can use, in the producer's order: every catalogue channel
 * features-service marks `salesPathEligible`. A channel missing a name or the flags is a
 * producer gap, said out loud and left out rather than guessed.
 */
export function salesPathChannels(
  channels: ReadonlyArray<{ slug: string; name?: string; managed?: boolean; salesPathEligible?: boolean; operatedBy?: string }>,
): SalesPathChannel[] {
  const out: SalesPathChannel[] = [];
  for (const c of channels) {
    if (c.salesPathEligible !== true) continue;
    if (!c.name || c.managed === undefined) {
      console.error("[offer-active-sales-paths] eligible channel served without name or managed flag", c);
      continue;
    }
    out.push({ slug: c.slug, name: c.name, managed: c.managed, customerOperated: c.operatedBy === "customer" });
  }
  return out;
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
