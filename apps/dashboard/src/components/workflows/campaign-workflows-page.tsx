"use client";

/**
 * THE WORKFLOWS A CAMPAIGN'S CHANNEL CAN RUN, and what each one did — at the grain
 * the reader picked.
 *
 * A campaign is (offer x funnel x channel). The channel is worked by a WORKFLOW — the
 * pipeline that finds the people, writes the email and sends it — and until this page
 * the workflow was a word on a settings screen: a customer could not see which ones
 * their channel offers, which one is running, or what the others cost when they ran.
 *
 * ── THREE SECTIONS, BECAUSE ONE LIST ANSWERS THREE QUESTIONS BADLY ───────────────
 *
 *  · RUNNING NOW — what is happening right now. One row, framed in the brand's own
 *    primary, and it appears NOWHERE else: a reader should not find the same row again
 *    further down and have to work out that it is the same one.
 *  · MEASURED — everything that produced at least one sales interest, best (cheapest)
 *    first. This is the section the page exists for.
 *  · NOT MEASURED YET — nothing produced yet, ordered by the outreach that has gone
 *    through it, which is what shows the bar being approached.
 *
 * The membership rule and the comparator live in the alias-free
 * `lib/campaign-workflow-rows`, so they carry real unit tests and flipping the order
 * is one line rather than a hunt through this file.
 *
 * ── FOUR GRAINS, ONE ROW MODEL ───────────────────────────────────────────────────
 *
 * Campaign / Offer / Brand / Global. Only the SOURCE changes — every grain builds the
 * same rows and renders the same columns, so a figure cannot mean two things one tab
 * apart. The grain a tab states IS the parameter its read sends: the campaign grain
 * sends `campaignId`, the offer grain sends `offerId`, the brand grain sends neither
 * (which is what the producer documents the omission as meaning), and the global
 * grain reads the two PUBLIC cross-org endpoints. No grain ever falls back to
 * another one's answer — rendering brand figures under an offer's name is the
 * wrong-scope bug this repo keeps recording, and it is why the offer tab shipped
 * DISABLED until features-service honoured `offerId` on the grouped read (#923 ->
 * v0.162.1). Proven on the wire before wiring it, on a subject where the two scopes
 * MUST differ rather than a single-offer brand where they agree by construction:
 * brand `f4d73dab` returns 31 workflow dynasties at the brand grain and 28 at the
 * offer grain, the three `pr-*` lineages belonging to campaigns that sell another
 * offer. A sibling offer no campaign sells 404s rather than answering with the
 * brand's numbers, and `offerId` beside `campaignId` is a 400 — which the tabs make
 * unreachable, since exactly one grain is active at a time.
 *
 * ── THE REST OF THE RULES, EACH ONE A MISTAKE ALREADY PAID FOR ───────────────────
 *
 *  1. EVERY FIGURE IS SERVED. The cost per sales interest is the producer's own
 *     `cpprCents`, not spend over replies computed here.
 *  2. THE CHANNEL IS THE CAMPAIGN'S OWN (`useScopedFeatureSlug`), never the brand's
 *     sole feature — a campaign on another channel would otherwise list somebody
 *     else's workflows.
 *  3. A PRICE UNDER THE BAR SAYS SO. Fewer than `LEARNING_MIN_OUTCOMES` sales
 *     interests behind a cost and the cell states `Learning` — `Paused` while the
 *     campaign is stopped, because nothing is being measured then.
 *  4. A RETIRED workflow gets NO row. The rows are the channel's catalogue; a lineage
 *     nobody can be put on is not an option, and its money is still in the cards above.
 */

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { MaturityBadge } from "@/components/maturity-badge";
import { LearningTag } from "@/components/learning-tag";
import { WorkflowModelCell, WorkflowTemplateCell } from "@/components/workflows/workflow-cells";
import { formatCentsAsUsdAdaptive, formatUsdAdaptive } from "@/lib/format-number";
import { isLearning } from "@/lib/learning-threshold";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useScopedFeatureSlug } from "@/lib/scoped-feature-slug";
import { useScopePaused } from "@/lib/use-scope-paused";
import { isRevenueFeature } from "@/lib/revenue-feature";
import {
  listChannelWorkflows,
  getFeatureRevenueByWorkflow,
  getBrandRevenueByWorkflow,
  getOfferRevenueByWorkflow,
  getFleetWorkflowCost,
  getFleetWorkflowOutreach,
} from "@/lib/api";
import {
  buildCampaignWorkflowRows,
  buildFleetWorkflowRows,
  resolveRunningWorkflow,
  sectionCampaignWorkflowRows,
  type CampaignWorkflowRow,
} from "@/lib/campaign-workflow-rows";

/**
 * Every column the header states. The skeleton and the empty state span all seven: a
 * `colSpan` is a maximum, and four of the columns fold away below `md`.
 */
const COLUMN_COUNT = 7;

/** The objective the fleet reads are priced on — the outcome this channel sells. */
const FLEET_OBJECTIVE = "positiveReply";

export type WorkflowGrain = "campaign" | "offer" | "brand" | "global";

const GRAINS: { key: WorkflowGrain; label: string }[] = [
  { key: "campaign", label: "Campaign" },
  { key: "offer", label: "Offer" },
  { key: "brand", label: "Brand" },
  { key: "global", label: "Global" },
];

const WORKFLOW_TIP =
  "A workflow is the pipeline that runs this channel: it finds the people, writes the email and sends it. Your campaign runs one at a time, and we switch it for a better one when the numbers say so.";

const MODEL_TIP =
  "The AI model this workflow writes your emails with. Two workflows on the same channel routinely differ only here, which is why a cheaper one appears.";

const TEMPLATE_TIP =
  "The prompt template the emails are written from. The second line is its exact id, version included — that version is what tells two of them apart.";

const OUTCOME_TIP =
  "Sales interests this workflow produced — people who replied wanting to talk. Counted per person, so somebody who replied twice is one.";

const COST_TIP =
  "What one sales interest cost through this workflow. It is what we charged divided by the interests it produced, and we take it from the same place your campaign's own cost card does.";

const INVESTED_TIP =
  "What has been spent through this workflow so far: billed usage plus the holds open on sends already queued. It is the same money the cost beside it divides.";

const OUTREACH_TIP =
  "People this workflow reached out to, counted once each. Bounces and unsubscribes are in it: we queued the email, we sent it, and it was paid for.";

const RUNNING_TIP =
  "The workflow your campaign is running right now. We pick it, and we change it when another one is producing sales interests more cheaply.";

const GRAIN_NOTE: Record<WorkflowGrain, string> = {
  campaign: "Every number below is this campaign's own, not the brand's.",
  offer: "Every number below is this offer's own.",
  brand: "Every number below is this brand's own, across every campaign on this channel.",
  global:
    "Every number below is across every client we run this channel for. It counts what each workflow costs to produce an outcome — including spend we later refunded — so it is a different question from what you were charged.",
};

const SECTION_TIP = {
  running: RUNNING_TIP,
  measured:
    "Workflows that have produced at least one sales interest, cheapest first. A price standing on fewer than ten interests is not stated — it moves by tens of dollars on the next one.",
  notMeasured:
    "Workflows that have not produced a sales interest yet, ordered by how many people they have reached.",
} as const;

function fmtCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

function fmtCents(value: number | null): string {
  return value === null ? "—" : formatCentsAsUsdAdaptive(value);
}

function fmtUsd(value: number | null): string {
  return value === null ? "—" : formatUsdAdaptive(value);
}

/**
 * One section's table. Seven columns at every grain — the SOURCE changes, the columns
 * do not, so a reader comparing two tabs is comparing like with like.
 *
 * The min-width is gated at the SAME breakpoint the folded columns come back at: an
 * unconditional floor re-widens the row on a phone and pushes the columns that DO
 * render off to the right, which reads as the data being missing rather than as it
 * being one swipe away.
 */
function WorkflowTable({
  title,
  tip,
  rows,
  paused,
  running,
  onOpen,
  onPrefetch,
}: {
  title: string;
  tip: string;
  rows: CampaignWorkflowRow[];
  paused: boolean;
  running: boolean;
  onOpen: (row: CampaignWorkflowRow) => void;
  onPrefetch: (row: CampaignWorkflowRow) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-800">
        {title}
        <InfoTooltip tip={tip} placement="top" />
      </h2>
      <div
        className={`rounded-xl border bg-white ${running ? "border-brand-200" : "border-gray-200"}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full table-fixed md:table-auto md:min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3 w-[42%] md:w-[22%]">
                  Workflow <InfoTooltip tip={WORKFLOW_TIP} placement="top" />
                </th>
                <th className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                  LLM <InfoTooltip tip={MODEL_TIP} placement="top" />
                </th>
                <th className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                  Template <InfoTooltip tip={TEMPLATE_TIP} placement="top" />
                </th>
                <th className="w-[22%] md:w-auto px-4 py-3 md:whitespace-nowrap">
                  Sales interests <InfoTooltip tip={OUTCOME_TIP} placement="top" />
                </th>
                <th className="w-[36%] md:w-auto px-4 py-3 md:whitespace-nowrap">
                  Cost per sales interest <InfoTooltip tip={COST_TIP} placement="top" />
                </th>
                <th className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                  $ Invested <InfoTooltip tip={INVESTED_TIP} placement="top" />
                </th>
                <th className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                  Outreach <InfoTooltip tip={OUTREACH_TIP} placement="top" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.workflowDynastySlug}
                  onClick={() => onOpen(row)}
                  onMouseEnter={() => onPrefetch(row)}
                  onFocus={() => onPrefetch(row)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(row);
                    }
                  }}
                  className={`cursor-pointer border-b border-gray-100 last:border-0 transition hover:bg-gray-50 ${
                    row.running ? "bg-brand-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    {/* WRAPS: the pill is `shrink-0` and the name truncates, so in the
                        42%-wide mobile cell a `nowrap` row squeezed the name to ZERO
                        width and the row showed a badge with no workflow at all. */}
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-medium text-gray-900">
                        {row.workflowDynastyName}
                      </span>
                      {row.running && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
                          Running now
                          <InfoTooltip tip={RUNNING_TIP} placement="top" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3">
                    <WorkflowModelCell contentModel={row.contentModel} />
                  </td>
                  <td className="hidden md:table-cell px-4 py-3">
                    <WorkflowTemplateCell contentPromptType={row.contentPromptType} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                    {fmtCount(row.positiveReplies)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                    {row.learning ? <LearningTag paused={paused} /> : fmtCents(row.cpprCents)}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-gray-800">
                    {fmtUsd(row.committedCostUsd)}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-gray-800">
                    {fmtCount(row.outreach)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CampaignWorkflowsPage() {
  const params = useParams();
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const isBeta = useIsBetaUser();
  const [grain, setGrain] = useState<WorkflowGrain>("campaign");

  const orgId = String(params.orgId ?? "");
  const brandId = String(params.brandId ?? "");
  const offerId = String(params.offerId ?? "");
  const campaignId = String(params.id ?? "");

  const { campaign, featureSlug, settled: slugSettled } = useScopedFeatureSlug(campaignId);
  // Null while the campaign read is in flight — never the brand's sole slug as a
  // stand-in, and the `pending` gate below is what the table renders until then.
  const revenueOk = featureSlug !== null && isRevenueFeature(featureSlug);
  const ready = isBeta && Boolean(featureSlug);

  // The channel's catalogue. It decides which rows EXIST at every grain, so it is read
  // once and shared — keyed on the slug, so two campaigns on two channels never share
  // an entry.
  const catalogueQ = useAuthQuery(
    ["workflows", featureSlug ?? "none"],
    () => listChannelWorkflows(featureSlug as string),
    { ...pollOptions, enabled: ready },
  );

  // This CAMPAIGN's money per workflow. The campaign is in the key as well as in the
  // request: a brand-scoped entry answering a campaign-scoped question is the wrong-
  // scope bug wearing a cache key.
  const campaignRevQ = useAuthQuery(
    ["campaignWorkflowRevenue", brandId, campaignId],
    () => getFeatureRevenueByWorkflow(featureSlug as string, brandId, campaignId),
    {
      ...pollOptions,
      enabled: ready && Boolean(brandId) && Boolean(campaignId) && grain === "campaign",
    },
  );

  // The same read at the OFFER grain — the campaigns selling THIS offer, folded per
  // workflow. The offer is in the key as well as in the request, for the same reason
  // the campaign is: a brand entry answering an offer-scoped question is the
  // wrong-scope bug wearing a cache key.
  const offerRevQ = useAuthQuery(
    ["offerWorkflowRevenue", brandId, offerId],
    () => getOfferRevenueByWorkflow(featureSlug as string, brandId, offerId),
    {
      ...pollOptions,
      enabled: ready && Boolean(brandId) && Boolean(offerId) && grain === "offer",
    },
  );

  // The same read at the BRAND grain, under its own key for the same reason.
  const brandRevQ = useAuthQuery(
    ["brandWorkflowRevenue", brandId],
    () => getBrandRevenueByWorkflow(featureSlug as string, brandId),
    { ...pollOptions, enabled: ready && Boolean(brandId) && grain === "brand" },
  );

  // The GLOBAL grain: two PUBLIC cross-org reads, joined on the dynasty. The cost read
  // carries the money and the outcome counts; the ranked read carries the outreach.
  const fleetCostQ = useAuthQuery(
    ["fleetWorkflowCost", featureSlug ?? "none", FLEET_OBJECTIVE],
    () => getFleetWorkflowCost(featureSlug as string, FLEET_OBJECTIVE),
    { ...pollOptions, enabled: ready && grain === "global" },
  );
  const fleetOutreachQ = useAuthQuery(
    ["fleetWorkflowOutreach", featureSlug ?? "none"],
    () => getFleetWorkflowOutreach(featureSlug as string),
    { ...pollOptions, enabled: ready && grain === "global" },
  );

  // A stopped campaign produces nothing, so a thin price there is not "learning" — it
  // is waiting on a restart. Only the CAMPAIGN grain can say that: at offer, brand and
  // global grain the scope spans campaigns and the word would describe none of them.
  const { paused: campaignPaused } = useScopePaused(brandId, { campaignId, enabled: isBeta });
  const paused = grain === "campaign" && campaignPaused;

  // WHICH workflow is running is a fact about the CAMPAIGN, so it is resolved ONCE from
  // every source the page holds — never per grain. campaign-service states a VERSIONED
  // slug and the catalogue carries only each dynasty's CURRENT version, so a campaign
  // pinned to an older one is nameable only by a revenue group's folded `workflowSlugs`
  // — and the global grain holds no groups at all. Resolving per grain therefore lost
  // the running row on that tab alone.
  const running = useMemo(
    () =>
      resolveRunningWorkflow(campaign?.workflowSlug ?? null, catalogueQ.data ?? [], [
        campaignRevQ.data ?? [],
        offerRevQ.data ?? [],
        brandRevQ.data ?? [],
      ]),
    [campaign?.workflowSlug, catalogueQ.data, campaignRevQ.data, offerRevQ.data, brandRevQ.data],
  );

  const rows = useMemo(() => {
    const catalogue = catalogueQ.data ?? [];
    if (grain === "global") {
      return buildFleetWorkflowRows({
        catalogue,
        fleet: fleetCostQ.data ?? [],
        outreach: fleetOutreachQ.data ?? [],
        running,
        isLearning,
      });
    }
    const scoped =
      grain === "brand" ? brandRevQ.data : grain === "offer" ? offerRevQ.data : campaignRevQ.data;
    return buildCampaignWorkflowRows({
      catalogue,
      groups: scoped ?? [],
      running,
      isLearning,
    });
  }, [
    grain,
    catalogueQ.data,
    campaignRevQ.data,
    offerRevQ.data,
    brandRevQ.data,
    fleetCostQ.data,
    fleetOutreachQ.data,
    running,
  ]);

  const sections = useMemo(() => sectionCampaignWorkflowRows(rows), [rows]);

  // Reveal on SETTLE (resolved OR errored). A failing read paints the empty state,
  // never an eternal skeleton — and the reads settle independently, so a slow
  // catalogue does not hold the money hostage.
  const figuresPending =
    grain === "global"
      ? (fleetCostQ.isPending && !fleetCostQ.isError) ||
        (fleetOutreachQ.isPending && !fleetOutreachQ.isError)
      : grain === "brand"
        ? brandRevQ.isPending && !brandRevQ.isError
        : grain === "offer"
          ? offerRevQ.isPending && !offerRevQ.isError
          : campaignRevQ.isPending && !campaignRevQ.isError;
  const pending =
    !slugSettled || (catalogueQ.isPending && !catalogueQ.isError) || figuresPending;

  if (!isBeta) {
    return (
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
          <h1 className="text-base font-medium text-gray-900">Not available</h1>
          <p className="mt-1 text-sm text-gray-500">
            This page is still in beta and is not open on your account yet.
          </p>
        </div>
      </div>
    );
  }

  const open = (row: CampaignWorkflowRow) =>
    `/orgs/${orgId}/brands/${brandId}/offers/${offerId}/campaigns/${campaignId}/workflows/${encodeURIComponent(row.workflowDynastySlug)}`;
  const onOpen = (row: CampaignWorkflowRow) => router.push(open(row));
  const onPrefetch = (row: CampaignWorkflowRow) => prefetch(open(row));

  const empty = !pending && revenueOk && rows.length === 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-medium text-gray-900">Workflows</h1>
          <MaturityBadge level="beta" />
          <InfoTooltip tip={WORKFLOW_TIP} placement="top" />
        </div>
        <p className="mt-1 text-sm text-gray-500">{GRAIN_NOTE[grain]}</p>
      </div>

      {/* THE GRAIN IS A CHOICE, not four pages. Every tab renders the same columns off
          the same row model, so the only thing that moves is the population — which is
          what makes "is this workflow better for me than for everyone" answerable by
          switching one tab. */}
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-brand-200 bg-brand-50 p-1">
        {GRAINS.map((g) => {
          const active = grain === g.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setGrain(g.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-white font-medium text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {pending && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <Skeleton className="h-40 w-full rounded" />
        </div>
      )}

      {!pending && !revenueOk && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          This channel does not run workflows.
        </div>
      )}

      {empty && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          This channel offers no workflow yet.
        </div>
      )}

      {!pending && revenueOk && rows.length > 0 && (
        <div className="space-y-6">
          <WorkflowTable
            title="Running now"
            tip={SECTION_TIP.running}
            rows={sections.running}
            paused={paused}
            running
            onOpen={onOpen}
            onPrefetch={onPrefetch}
          />
          <WorkflowTable
            title="Measured"
            tip={SECTION_TIP.measured}
            rows={sections.measured}
            paused={paused}
            running={false}
            onOpen={onOpen}
            onPrefetch={onPrefetch}
          />
          <WorkflowTable
            title="Not measured yet"
            tip={SECTION_TIP.notMeasured}
            rows={sections.notMeasured}
            paused={paused}
            running={false}
            onOpen={onOpen}
            onPrefetch={onPrefetch}
          />
        </div>
      )}
    </div>
  );
}
