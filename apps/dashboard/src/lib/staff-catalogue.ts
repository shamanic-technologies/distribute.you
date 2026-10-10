/**
 * THE BUSINESS OBJECTS, as features-service's agent catalogue serves them (owner 2026-10-10,
 * "chat first"; features-service PR #1482, read through the gateway's staff-only
 * `/v1/catalogue/*`): Steps, Sales Paths, Channels, Pipes (channel x leg), Sales Funnels
 * (a path with one pipe per leg) and Workflows (per pipe). Staff mode gives each a section
 * under the GA nav: an overview, the ONGOING ones, a page per object.
 *
 * Every figure (cost, ROI, status, value) is the producer's, fleet-wide. What this module
 * decides is only which objects are ONGOING for the selected offer: used by at least one of
 * its ON campaigns. That is an identity join on keys both sides serve (a campaign IS a pipe
 * today, `<channel slug>|<leg key>`; a funnel id IS the offer read's `combinationKey`, and
 * the funnel serves its own `salesPathId`), never a figure.
 *
 * Alias-free (zod and relative imports only) so it carries real unit tests.
 */
import { z } from "zod";
import { featureLegId } from "./outbound-leg-key";

/** The objects with a catalogue overview + page here, in the producer's path spelling. */
export const CATALOGUE_OBJECTS = ["steps", "sales-paths", "channels", "pipes", "sales-funnels"] as const;
export type CatalogueObject = (typeof CATALOGUE_OBJECTS)[number];
/** Workflows are read per pipe and keep their own pages (`/workflows`). */
export type CatalogueReadObject = CatalogueObject | "workflows";

export function isCatalogueObject(s: string | null | undefined): s is CatalogueObject {
  return !!s && (CATALOGUE_OBJECTS as readonly string[]).includes(s);
}

/** How each object is named: the section title, one, many, and the one line saying what it is. */
export const CATALOGUE_OBJECT_LABELS: Record<CatalogueObject, { title: string; one: string; many: string; what: string }> = {
  steps: { title: "Steps", one: "step", many: "steps", what: "A thing a buyer reaches, from a lead found to a paid client." },
  "sales-paths": { title: "Sales Paths", one: "sales path", many: "sales paths", what: "A series of steps to a paying client, with no channel yet." },
  channels: { title: "Channels", one: "channel", many: "channels", what: "Who does the work: our software, our team or the client's team." },
  pipes: { title: "Pipes", one: "pipe", many: "pipes", what: "One channel working one leg, from one step to the next." },
  "sales-funnels": { title: "Sales Funnels", one: "sales funnel", many: "sales funnels", what: "A sales path with a pipe on every leg." },
};

/** The producer's cost unit, in words. */
export function costUnitLabel(unit: string | null | undefined): string {
  if (unit === "per_outcome") return "Cost per outcome";
  if (unit === "per_paying_client") return "Cost per paying client";
  console.error("[staff-catalogue] unknown cost unit", { unit });
  return "Cost";
}

/** The producer's status word, capitalised (never renamed). */
export function catalogueStatusLabel(status: string): string {
  if (status === "customer_time") return "Customer time";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

// ─── Wire shapes (features-service `src/lib/openapi.ts` catalogue section) ───────────────

const StatusSchema = z.string();
const Econ = {
  costUsd: z.number().nullable(),
  roi: z.number().nullable(),
  status: StatusSchema,
};

/** One list row, every object: the fields this app reads, everything else kept. */
export const CatalogueRowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    icon: z.string().optional(),
    line: z.string(),
    ...Econ,
    color: z.string().optional(),
    face: z.string().optional(),
    valueUsd: z.number().nullable().optional(),
    mode: z.string().optional(),
    draft: z.boolean().optional(),
    declared: z.boolean().optional(),
  })
  .passthrough();
export type CatalogueRow = z.infer<typeof CatalogueRowSchema>;

export const CataloguePageSchema = z
  .object({
    object: z.string(),
    costUnit: z.string(),
    order: z.string(),
    total: z.number(),
    truncated: z.boolean(),
    rows: z.array(CatalogueRowSchema),
    pipeId: z.string().optional(),
  })
  .passthrough();
export type CataloguePage = z.infer<typeof CataloguePageSchema>;

const EconDetail = { ...Econ, learningReason: z.string().nullable(), costUnit: z.string() };

export const CatalogueStepSchema = z
  .object({
    object: z.literal("step"),
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    description: z.string(),
    line: z.string(),
    declared: z.boolean(),
    producedBy: z.string().nullable(),
    valueUsd: z.number().nullable(),
    valueVia: z.object({ toStep: z.string(), toStepName: z.string(), ratePct: z.number() }).passthrough().nullable(),
    valueBasis: z.string(),
    lifetimeRevenueUsd: z.number().nullable(),
    ...EconDetail,
    producingPipeIds: z.array(z.string()),
    salesPathCount: z.number(),
  })
  .passthrough();

export const CatalogueSalesPathSchema = z
  .object({
    object: z.literal("sales_path"),
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
    line: z.string(),
    steps: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
    legs: z.array(
      z
        .object({ legKey: z.string(), ratePct: z.number().nullable(), rateSource: z.string().nullable(), pipeIds: z.array(z.string()) })
        .passthrough(),
    ),
    ...EconDetail,
    bestSalesFunnelId: z.string().nullable(),
    salesFunnelCount: z.number(),
    lifetimeRevenueUsd: z.number().nullable(),
  })
  .passthrough();

const PipeRowSchema = CatalogueRowSchema;

export const CatalogueChannelSchema = z
  .object({
    object: z.literal("channel"),
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    line: z.string(),
    description: z.string(),
    channelType: z.string(),
    operatedBy: z.string(),
    performedBy: z.string(),
    managed: z.boolean(),
    ...EconDetail,
    bestPipeId: z.string().nullable(),
    pipes: z.array(PipeRowSchema),
  })
  .passthrough();

export const CataloguePipeSchema = z
  .object({
    object: z.literal("pipe"),
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
    line: z.string(),
    channelSlug: z.string(),
    channelName: z.string(),
    legKey: z.string(),
    fromStep: z.string().nullable(),
    toStep: z.string(),
    mode: z.string(),
    triggerId: z.string().nullable(),
    operatedBy: z.string(),
    managed: z.boolean(),
    draft: z.boolean(),
    ...EconDetail,
    toStepValueUsd: z.number().nullable(),
    bestWorkflowSlug: z.string().nullable(),
    measuredBasis: z.string().nullable(),
    conversionRatePct: z.number().nullable(),
  })
  .passthrough();

export const CatalogueFunnelSchema = z
  .object({
    object: z.literal("sales_funnel"),
    id: z.string(),
    name: z.string(),
    face: z.object({ svgPath: z.string() }).passthrough(),
    line: z.string(),
    salesPathId: z.string(),
    salesPathName: z.string().nullable(),
    legs: z.array(
      z
        .object({
          legKey: z.string(),
          ratePct: z.number().nullable(),
          outcomesNeededPerPayingClient: z.number().nullable(),
          pipe: z
            .object({ id: z.string(), name: z.string().nullable(), line: z.string(), mode: z.string(), ...Econ })
            .passthrough()
            .nullable(),
        })
        .passthrough(),
    ),
    ...EconDetail,
    lifetimeRevenueUsd: z.number().nullable(),
    draft: z.boolean(),
  })
  .passthrough();

export const CatalogueWorkflowSchema = z
  .object({
    object: z.literal("workflow"),
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
    pipeId: z.string(),
    rank: z.number(),
    assignment: z.string(),
    selectable: z.boolean(),
    isMature: z.boolean().nullable(),
    basis: z.string(),
    outcomes: z.number(),
    contacted: z.number(),
    spentUsd: z.number(),
    conversionRatePct: z.number().nullable(),
    holdsTheMoney: z.boolean(),
    ...EconDetail,
  })
  .passthrough();

export type CatalogueStep = z.infer<typeof CatalogueStepSchema>;
export type CatalogueSalesPath = z.infer<typeof CatalogueSalesPathSchema>;
export type CatalogueChannel = z.infer<typeof CatalogueChannelSchema>;
export type CataloguePipe = z.infer<typeof CataloguePipeSchema>;
export type CatalogueFunnel = z.infer<typeof CatalogueFunnelSchema>;
export type CatalogueWorkflow = z.infer<typeof CatalogueWorkflowSchema>;

export interface CatalogueDetailByObject {
  steps: CatalogueStep;
  "sales-paths": CatalogueSalesPath;
  channels: CatalogueChannel;
  pipes: CataloguePipe;
  "sales-funnels": CatalogueFunnel;
  workflows: CatalogueWorkflow;
}

export const CATALOGUE_DETAIL_SCHEMAS: { [K in CatalogueReadObject]: z.ZodType<CatalogueDetailByObject[K]> } = {
  steps: CatalogueStepSchema,
  "sales-paths": CatalogueSalesPathSchema,
  channels: CatalogueChannelSchema,
  pipes: CataloguePipeSchema,
  "sales-funnels": CatalogueFunnelSchema,
  workflows: CatalogueWorkflowSchema,
};

/**
 * A served face path (`/public/catalogue/faces/Zenith.svg`) as this app's URL: the gateway
 * proxies features-service's public faces under `/v1`, and the browser reaches the gateway
 * through `/api/v1`. Null for anything that is not a face path (logged).
 */
export function catalogueFaceSrc(face: string | null | undefined): string | null {
  if (!face) return null;
  if (!face.startsWith("/public/catalogue/faces/")) {
    console.error("[staff-catalogue] unexpected face path", { face });
    return null;
  }
  return `/api/v1${face}`;
}

// ─── Ongoing: what the selected offer's ON campaigns use ─────────────────────────────────

/** One ON campaign, as the join needs it. */
export interface OnCampaignKey {
  featureSlug: string | null | undefined;
  legKey: string | null | undefined;
}

/** One served path of the offer's sales-paths read (features-service), as the join needs it. */
export interface OfferPathKey {
  combinationKey: string;
  ticked?: boolean;
  legs: Array<{ legKey: string; channel?: { slug: string | null } | null }>;
}

/** The pipe ids the ON campaigns ARE (`<channel slug>|<leg key>`, new outbound spelling), in order, once each. */
export function ongoingPipeIds(campaigns: OnCampaignKey[]): string[] {
  const out: string[] = [];
  for (const c of campaigns) {
    if (!c.featureSlug || !c.legKey) continue;
    const id = featureLegId(c.featureSlug, c.legKey);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * A funnel id (`<leg>@<channel slug>+<leg>...`, a bare leg where no channel works it) in the
 * spelling the catalogue serves: each channel's leg canonical (the outbound rename), so a
 * key stored before the rename still names the same funnel.
 */
export function canonicalFunnelId(combinationKey: string): string {
  return combinationKey
    .split("+")
    .map((part) => {
      const at = part.indexOf("@");
      if (at === -1) return part;
      const slug = part.slice(at + 1);
      return `${featureLegId(slug, part.slice(0, at)).split("|")[1]}@${slug}`;
    })
    .join("+");
}

/**
 * The offer's sales funnels that are ongoing: TICKED (the offer runs that funnel) and with
 * at least one leg worked by an ON campaign. Served order kept, catalogue spelling. Their
 * sales paths are read off each funnel's served `salesPathId`.
 */
export function ongoingFunnelIds(paths: OfferPathKey[], pipeIds: string[]): string[] {
  const on = new Set(pipeIds);
  const out: string[] = [];
  for (const p of paths) {
    if (!p.ticked) continue;
    const uses = p.legs.some((l) => !!l.channel?.slug && on.has(featureLegId(l.channel.slug, l.legKey)));
    if (!uses) continue;
    const id = canonicalFunnelId(p.combinationKey);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** The channels and steps the ongoing pipes use, read off the pipes' own served fields. Sales paths: off the funnels'. */
export function ongoingChannelsAndSteps(pipes: Array<Pick<CataloguePipe, "channelSlug" | "fromStep" | "toStep">>): {
  channelIds: string[];
  stepIds: string[];
} {
  const channelIds: string[] = [];
  const stepIds: string[] = [];
  for (const p of pipes) {
    if (!channelIds.includes(p.channelSlug)) channelIds.push(p.channelSlug);
    for (const s of [p.fromStep, p.toStep]) if (s && !stepIds.includes(s)) stepIds.push(s);
  }
  return { channelIds, stepIds };
}
