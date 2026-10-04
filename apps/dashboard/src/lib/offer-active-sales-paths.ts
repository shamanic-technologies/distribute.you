import { z } from "zod";

/**
 * What the customer STATES about an offer's sales paths beyond its ticked legs
 * (brand-service, through the gateway):
 *
 *  - the CHANNELS the offer accepts (`/brands/:id/offers/:offerId/channels`). Never
 *    stated (`stated: false`, `channelSlugs: null`) is not the same as stated empty;
 *    features-service reads "never stated" as the channels we run.
 *  - the sales paths the customer ACTIVATED (`/brands/:id/offers/:offerId/active-sales-paths`),
 *    at most one per ENTRY (channel x entry leg). Activating a path whose entry another
 *    active path holds answers 409 `SALES_PATH_ENTRY_TAKEN` with that holder, and the
 *    customer is offered to replace it (`replace: true`, atomic on the producer).
 *
 * No money here: budgets are billing-service's. Alias-free (only zod) so it carries
 * real unit tests.
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

export const ActiveSalesPathSchema = z
  .object({
    id: z.string(),
    combinationKey: z.string(),
    entryChannelSlug: z.string(),
    entryLegKey: z.string(),
    status: z.string(),
    activatedAt: z.string(),
  })
  .passthrough();
export type ActiveSalesPath = z.infer<typeof ActiveSalesPathSchema>;

export const OfferActiveSalesPathsSchema = z
  .object({ offerId: z.string(), activeSalesPaths: z.array(ActiveSalesPathSchema) })
  .passthrough();
export type OfferActiveSalesPaths = z.infer<typeof OfferActiveSalesPathsSchema>;

export const ActivateSalesPathResponseSchema = z
  .object({
    activated: z.boolean(),
    activeSalesPath: ActiveSalesPathSchema,
    replaced: ActiveSalesPathSchema.nullable(),
  })
  .passthrough();
export type ActivateSalesPathResponse = z.infer<typeof ActivateSalesPathResponseSchema>;

export function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, where: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[${where}] invalid response shape`, parsed.error.issues, raw);
    throw new Error(`[${where}] invalid response shape`);
  }
  return parsed.data;
}

/** The entry a sales path row starts with: the channel on its entry leg. Null when no channel of ours enters it. */
export function entryOf(path: { entryLegKey: string; entryChannelSlug: string | null }): {
  entryChannelSlug: string;
  entryLegKey: string;
} | null {
  return path.entryChannelSlug ? { entryChannelSlug: path.entryChannelSlug, entryLegKey: path.entryLegKey } : null;
}

/** The active path holding the same entry as `path`, other than `path` itself. */
export function entryHolder(
  path: { combinationKey: string; entryLegKey: string; entryChannelSlug: string | null },
  active: readonly ActiveSalesPath[],
): ActiveSalesPath | null {
  const e = entryOf(path);
  if (!e) return null;
  return (
    active.find(
      (a) =>
        a.combinationKey !== path.combinationKey &&
        a.entryChannelSlug === e.entryChannelSlug &&
        a.entryLegKey === e.entryLegKey,
    ) ?? null
  );
}

/** The 409 the producer answers when the entry is taken: the holder it names, or null for any other error. */
export function takenEntryHolder(err: unknown): ActiveSalesPath | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { status?: unknown; body?: Record<string, unknown> };
  if (e.status !== 409 || e.body?.code !== "SALES_PATH_ENTRY_TAKEN") return null;
  const parsed = ActiveSalesPathSchema.safeParse(e.body.activeSalesPath);
  return parsed.success ? parsed.data : null;
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
