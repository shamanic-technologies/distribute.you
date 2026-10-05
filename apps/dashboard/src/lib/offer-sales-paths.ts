import { z } from "zod";
import { formatRatePct as formatLegRatePct } from "./brand-conversion-rates";

/**
 * An offer's SALES PATHS (beta): features-service links the legs the customer
 * ticked, from an entry leg to a paying client, and ranks them by ROI
 * (`GET /offers/:offerId/sales-paths`). Every figure is served: the retained
 * rate of each leg and where it came from, the channel chosen for it, the cost
 * per paying client and the ROI. Nothing here divides, sums or ranks.
 *
 * Two scopes: the default (`ticked`) is what we fund and launch first; `catalogue` (the
 * Sales path page) lists every path the catalogue allows x the owner's channel shortlist,
 * with `ticked` per row/leg and `managed` per channel (we run it today or not), priced on
 * a cited market benchmark where nothing is measured.
 *
 * Vocabularies (status, rate source, channel choice) are read as plain STRINGS:
 * a producer vocabulary grows, and a closed enum here would throw the whole
 * section the day it does. The words for the ones we know live below.
 *
 * Alias-free (only zod) so it carries real unit tests. Keep it that way.
 */

const StepSchema = z.object({ key: z.string(), label: z.string() }).passthrough();

const CandidateSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    costPerOutcomeUsd: z.number().nullable(),
    unpricedReason: z.string().nullable().optional(),
  })
  .passthrough();

const LegSchema = z
  .object({
    legKey: z.string(),
    fromStep: StepSchema.nullable(),
    toStep: StepSchema,
    conversionRatePct: z.number().nullable(),
    rateSource: z.string().nullable(),
    rateInputs: z
      .object({
        measured: z
          .object({
            basis: z.string(),
            fromReached: z.number().nullable(),
            toReached: z.number().nullable(),
            ratePct: z.number().nullable(),
            sufficient: z.boolean(),
          })
          .passthrough(),
        customerStatedPct: z.number().nullable(),
        fleetMedian: z.object({ ratePct: z.number().nullable(), brandCount: z.number() }).passthrough(),
        industryDefaultPct: z.number().nullable(),
      })
      .passthrough()
      .nullable(),
    workedBy: z.string(),
    /** Whether the customer ticked the leg (features-service; absent before scope=catalogue shipped). */
    ticked: z.boolean().optional(),
    /** True when the leg starts from a step a lead reached: its campaign takes a MAX budget. */
    reactive: z.boolean().optional(),
    channel: z
      .object({
        slug: z.string().nullable(),
        name: z.string().nullable(),
        trigger: z.string().nullable(),
        /** True when we run this channel today. */
        managed: z.boolean().optional(),
        /** customer = the customer's own team works the leg (your-team-*). */
        operatedBy: z.string().optional(),
        /** The campaign's name (this channel on this leg), one word shared by every client. */
        campaignName: z.string().nullable().optional(),
        /** When the cost is a market benchmark: its cited source, in words. */
        costBenchmarkSource: z.string().nullable().optional(),
        choice: z.string(),
        candidates: z.array(CandidateSchema),
      })
      .passthrough()
      .nullable(),
    outcomesNeededPerPayingClient: z.number().nullable(),
    costPerOutcomeUsd: z.number().nullable(),
    /** Which rung priced the leg: workflow, fleet_measured, default, benchmark. */
    costSource: z.string().nullable().optional(),
    costPerPayingClientUsd: z.number().nullable(),
  })
  .passthrough();

const PathSchema = z
  .object({
    rank: z.number(),
    /** The legs in order, shared by every channel combination over it. */
    pathKey: z.string(),
    /** The row's own identity: the legs with the channel on each leg ours works. */
    combinationKey: z.string(),
    /** The combination's name, the same for every client and never changed (features-service). */
    name: z.string(),
    legKeys: z.array(z.string()),
    steps: z.array(StepSchema),
    entryLegKey: z.string(),
    entryChannelSlug: z.string().nullable(),
    /** Whether the customer ticked every leg of the path. */
    ticked: z.boolean().optional(),
    legs: z.array(LegSchema),
    entryToPayingClientPct: z.number().nullable(),
    lifetimeRevenueUsd: z.number().nullable(),
    costPerPayingClientUsd: z.number().nullable(),
    roi: z.number().nullable(),
    roiUnavailableReason: z.string().nullable(),
  })
  .passthrough();

/** One CAMPAIGN (channel x leg) the listed paths use, with its served ROI (features-service). */
const CampaignSchema = z
  .object({
    campaignKey: z.string(),
    channelSlug: z.string(),
    channelName: z.string(),
    legKey: z.string(),
    campaignName: z.string().nullable(),
    reactive: z.boolean(),
    managed: z.boolean(),
    operatedBy: z.string(),
    pathCount: z.number(),
    /** How many of the offer's TICKED paths use it; 0 = not on a ticked path. */
    selectedPathCount: z.number(),
    /** The best ROI among the ticked paths that run it (null with a reason). */
    roi: z.number().nullable(),
    roiCombinationKey: z.string().nullable(),
    roiUnavailableReason: z.string().nullable(),
  })
  .passthrough();
export type SalesPathCampaign = z.infer<typeof CampaignSchema>;

/**
 * The (i) beside a column whose figure is EXPECTED, worked out from rates rather than
 * measured (owner 2026-10-05: say so on every such column of the Sales path page).
 */
export const EXPECTED_ROI_TIP =
  "Expected, not measured yet. Worked out from each step's rate and what one client is worth.";
export const EXPECTED_COST_PER_CLIENT_TIP =
  "Expected, not measured yet. What one paying client should cost on this path, from each step's rate.";

export const OfferSalesPathsSchema = z
  .object({
    offerId: z.string(),
    brandId: z.string(),
    status: z.string(),
    /** Echo of `?scope=`: ticked (default) or catalogue. */
    scope: z.string().optional(),
    statedAt: z.string().nullable(),
    selectedLegKeys: z.array(z.string()),
    unknownLegKeys: z.array(z.string()),
    lifetimeRevenueUsd: z.number().nullable(),
    paths: z.array(PathSchema),
    /** Every campaign the listed paths use (features-service v0.179.59; absent before it). */
    campaigns: z.array(CampaignSchema).optional(),
  })
  .passthrough();

export type OfferSalesPaths = z.infer<typeof OfferSalesPathsSchema>;
export type SalesPathRow = OfferSalesPaths["paths"][number];
export type SalesPathLeg = SalesPathRow["legs"][number];

export function parseOfferSalesPaths(raw: unknown, where: string): OfferSalesPaths {
  const parsed = OfferSalesPathsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[${where}] invalid response shape`, parsed.error.issues, raw);
    throw new Error(`[${where}] invalid response shape`);
  }
  return parsed.data;
}

/** Why the section holds no path, in the customer's words. Null when paths are served. */
export function salesPathsEmptyReason(status: string): string | null {
  switch (status) {
    case "ok":
      return null;
    case "not_stated":
    case "no_legs_selected":
      return "Tick the legs this offer sells through. Its sales paths appear here.";
    case "no_complete_path":
      return "No ticked legs reach a paying client yet. Tick the legs that lead to one.";
    default:
      return `No sales path to show (${status}).`;
  }
}

/** Where a leg's retained rate came from. An unknown source is shown verbatim. */
export function rateSourceLabel(source: string | null): string {
  switch (source) {
    case "crm_measured":
      return "Measured in your CRM";
    case "measured_on_our_leads":
      return "Measured on our leads";
    case "customer_stated":
      return "Stated by you";
    case "fleet_median":
      return "Median of our clients";
    case "industry_default":
    case "default":
      return "Industry benchmark";
    case null:
      return "—";
    default:
      return source;
  }
}

/** Which rung priced a leg's cost. Null when the leg costs us nothing; an unknown rung is shown verbatim. */
export function costSourceLabel(source: string | null | undefined): string | null {
  switch (source) {
    case null:
    case undefined:
      return null;
    case "workflow":
      return "Our best workflow";
    case "fleet_measured":
      return "Measured across our clients";
    case "default":
      return "Our estimate";
    case "benchmark":
      return "Market benchmark";
    default:
      return source;
  }
}

/** Why a path states no ROI. An unknown reason is shown verbatim. */
export function roiUnavailableLabel(reason: string | null): string | null {
  switch (reason) {
    case null:
      return null;
    case "leg_cost_unavailable":
      return "A leg has no price yet";
    case "zero_conversion_rate":
      return "A leg converts at 0%";
    case "no_lifetime_revenue":
      return "State this offer's lifetime revenue";
    case "no_platform_cost":
      return "Nothing on this path is run by us";
    case "not_on_a_selected_path":
      return "No ticked path uses it";
    case "selected_paths_unavailable":
      return "Could not read your ticked paths";
    default:
      return reason;
  }
}

/** The path read as one line: "Positive reply → Meeting booked → Paid client". */
export function pathTitle(path: SalesPathRow): string {
  return path.steps.map((s) => s.label).join(" → ");
}

/** One link of a path as the row draws it: a channel of ours working a leg (its slug draws its mark), or the step it lands on. */
export type PathLink =
  | { kind: "channel"; name: string; slug: string | null; managed: boolean | undefined }
  | { kind: "step"; label: string };

/**
 * A path read leg by leg: the channel that works each leg (only legs a channel of ours
 * works carry one), then the step the leg lands on. "[Sales Cold Email Outreach] →
 * Positive reply → [AI Booker] → Meeting booked → Paid client". Served names only.
 */
export function pathLinks(path: SalesPathRow): PathLink[] {
  const parts: PathLink[] = [];
  for (const leg of path.legs) {
    if (leg.workedBy !== "human" && leg.channel?.name) parts.push({ kind: "channel", name: leg.channel.name, slug: leg.channel.slug, managed: leg.channel.managed });
    parts.push({ kind: "step", label: leg.toStep.label });
  }
  return parts;
}

/** A percentage as the leg states it: whole, a decimal only below 1%. */
export function formatRatePct(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return formatLegRatePct(pct);
}

/** One step of a path as the campaign page draws it: the leg that lands on it and how many people reached it. */
export interface PathStepReach {
  step: { key: string; label: string };
  /** The leg arriving on the step (its rate kept and the channel working it). */
  leg: SalesPathLeg;
  /** People features-service measured on the step; null when it measured none. */
  reached: number | null;
}

/**
 * Each step of a path with the people measured on it, read off the served legs: a leg's
 * measured `toReached` is its landing step's count; the entry step has no measured leg
 * arriving, so its count is the NEXT leg's measured `fromReached`. Picks served counts,
 * never adds or divides them.
 */
export function pathStepReach(path: SalesPathRow): PathStepReach[] {
  // Destructured: the leg's measured block is features-service's rate input, not the
  // workflow projection flag `tests/workflow-projection-measured.test.ts` keeps in one reader.
  const counted = (leg: SalesPathLeg | undefined) => {
    const { measured } = leg?.rateInputs ?? { measured: null };
    return measured;
  };
  return path.legs.map((leg, i) => {
    const arriving = counted(leg)?.toReached ?? null;
    const leaving = counted(path.legs[i + 1])?.fromReached ?? null;
    return { step: leg.toStep, leg, reached: leg.fromStep ? arriving : leaving };
  });
}
