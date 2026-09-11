"use client";

/**
 * THE WORKFLOWS A CAMPAIGN'S CHANNEL CAN RUN, and what each one did for THIS campaign.
 *
 * A campaign is (offer x funnel x channel). The channel is worked by a WORKFLOW — the
 * pipeline that finds the people, writes the email and sends it — and until this page
 * the workflow was a word on a settings screen: a customer could not see which ones
 * their channel offers, which one is running, or what the others cost when they ran.
 *
 * Four rules the table holds, each one a mistake this repo has already paid for:
 *
 *  1. EVERY FIGURE IS SERVED. The cost per sales interest is features-service's own
 *     `cpprCents` for that workflow, not spend over replies computed here. A browser
 *     ratio drifts from the producer the moment either side changes scope.
 *
 *  2. IT IS CAMPAIGN-SCOPED, at the read. `getFeatureRevenueByWorkflow` sends the
 *     campaign; without it the same endpoint answers for the whole BRAND and the page
 *     would print a brand-grain figure under a campaign's name.
 *
 *  3. THE CHANNEL IS THE CAMPAIGN'S OWN (`useScopedFeatureSlug`), never the brand's
 *     sole feature. A campaign on any other channel would otherwise list a different
 *     channel's workflows and read as if the page were about somebody else's money.
 *
 *  4. A PRICE UNDER THE BAR SAYS SO. Fewer than `LEARNING_MIN_OUTCOMES` sales
 *     interests behind a cost and the cell states `Learning` instead of a number that
 *     moves by tens of dollars on the next one — `Paused` while the campaign is
 *     stopped, because nothing is being measured then.
 */

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { ProviderLogo } from "@/components/provider-logo";
import { workflowModelMark } from "@/lib/workflow-model-marks";
import { MaturityBadge } from "@/components/maturity-badge";
import { LearningTag } from "@/components/learning-tag";
import { formatCentsAsUsdAdaptive, formatUsdAdaptive } from "@/lib/format-number";
import { isLearning } from "@/lib/learning-threshold";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useScopedFeatureSlug } from "@/lib/scoped-feature-slug";
import { useScopePaused } from "@/lib/use-scope-paused";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { listChannelWorkflows, getFeatureRevenueByWorkflow } from "@/lib/api";
import {
  buildCampaignWorkflowRows,
  type CampaignWorkflowRow,
} from "@/lib/campaign-workflow-rows";

/**
 * Every column the header states. The skeleton and the empty state span all five:
 * a `colSpan` is a maximum, and two of the columns fold away below `md`.
 */
const COLUMN_COUNT = 5;

const WORKFLOW_TIP =
  "A workflow is the pipeline that runs this channel: it finds the people, writes the email and sends it. Your campaign runs one at a time, and we switch it for a better one when the numbers say so.";

const OUTCOME_TIP =
  "Sales interests this workflow produced for this campaign — people who replied wanting to talk. Counted per person, so somebody who replied twice is one.";

const COST_TIP =
  "What one sales interest cost through this workflow, on this campaign. It is what we charged you divided by the interests it produced, and we take it from the same place your campaign's own cost card does.";

const INVESTED_TIP =
  "What this campaign has spent through this workflow so far: billed usage plus the holds open on sends already queued. It is the same money the cost beside it divides.";

const OUTREACH_TIP =
  "People this workflow reached out to for this campaign, counted once each. Bounces and unsubscribes are in it: we queued the email, we sent it, and it was paid for.";

const RUNNING_TIP =
  "The workflow your campaign is running right now. We pick it, and we change it when another one is producing sales interests more cheaply.";

const RETIRED_TIP =
  "This workflow ran for you and we no longer offer it. Its numbers are still yours, so the row stays.";

const SCOPE_NOTE =
  "Every number on this page is this campaign's own, not the brand's.";

const MODEL_TIP =
  "The AI model this workflow writes your emails with, and the prompt template it writes them from. Two workflows on the same channel routinely differ only here, which is why a cheaper one appears.";

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
 * The identity cell: what this workflow calls on, and what it is called.
 *
 * The PROVIDERS are the gateway's own `requiredProviders`, which carry a domain for
 * logo lookup — the one visual identity workflow-service actually states. A provider
 * with no domain draws no logo (`ProviderLogo` returns null): a mark we would have to
 * invent is worse than none, which is the rule the channel marks already follow.
 *
 * The MODEL and the TEMPLATE are the subline, and they REPLACED the channel and the
 * audience type that used to sit there. That is the point of the line rather than a
 * trim: this page is scoped to ONE channel, so every row read the same `email ·
 * cold-outreach` and the line distinguished nothing — while the model and the template
 * are routinely the ONLY thing two rows differ by, and therefore the whole reason one
 * of them produces a sales interest more cheaply.
 *
 * Both come off workflow-service's own derivation (`contentModel` /
 * `contentPromptType`, v0.45.7), never a DAG this surface parses. A model it states
 * none for reads `—`; an alias the marks catalogue does not know renders its own text
 * with NO logo, because a provider mark we would have to invent would attribute a
 * customer's spend to the wrong company. The template is printed VERBATIM — it is the
 * only template identity on the wire, and prettifying it would invent a name.
 */
export function WorkflowIdentity({ row }: { row: CampaignWorkflowRow }) {
  const model = workflowModelMark(row.contentModel);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {/* THE MODEL'S PROVIDER LEADS, at the same size as the rest and set apart from
          them. The stack behind it is `requiredProviders` — what the workflow CALLS
          (the lead database, the sending platform) — which is a different fact from
          who WRITES the email, and the writing is what two rows differ by. A row
          stating no model simply starts at the stack. */}
      {(model?.providerDomain || row.providers.length > 0) && (
        <span className="flex shrink-0 items-center gap-1.5">
          <ProviderLogo domain={model?.providerDomain ?? null} size={18} className="rounded-sm" />
          {/* FOLDS AWAY BELOW `md`, and that is the same rule the columns follow: in
              the 46%-wide mobile cell two mark stacks cost 24px of the name's width
              and spill the cell (measured on a Pixel 7). These marks are also the
              LEAST differentiating thing on the page — every workflow of one channel
              calls the same lead database and the same sender — so they are what a
              phone gives up, and the model, which differs row to row, is what it keeps. */}
          {row.providers.length > 0 && (
            <span className="hidden shrink-0 -space-x-1 md:flex">
              {row.providers.slice(0, 3).map((p) => (
                <ProviderLogo
                  key={p.domain ?? p.name}
                  domain={p.domain}
                  size={18}
                  className="rounded-sm ring-2 ring-white"
                />
              ))}
            </span>
          )}
        </span>
      )}
      <div className="min-w-0">
        {/* WRAPS, and that is the fix for a real defect: the pill is `shrink-0` and
            the name is `truncate`, so in the 46%-wide mobile cell the name was squeezed
            to ZERO width — the row rendered a "Running now" badge and no workflow at
            all. Measured on a Pixel 7: 0px before, readable after. */}
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
          {row.retired && !row.running && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
              Retired
              <InfoTooltip tip={RETIRED_TIP} placement="top" />
            </span>
          )}
        </div>
        {/* WRAPS for the same reason the line above it does: in the 46%-wide mobile
            cell a model label and a template chip do not fit side by side, and a
            `truncate` on either would squeeze the other to nothing. */}
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          {model ? (
            <span className="truncate text-[11px] text-gray-500">{model.label}</span>
          ) : (
            <span className="text-[11px] text-gray-400">—</span>
          )}
          {row.contentPromptType && (
            /* BREAKS rather than truncates or holds its width: the longest template
               (`blind-discovery-email-v26`) is wider than the 46%-wide mobile cell,
               and `shrink-0` made it spill the cell — measured on a Pixel 7. A
               truncation would eat the VERSION, which is the part that tells two
               templates apart, so it wraps mid-token instead and stays readable. */
            <span className="min-w-0 break-all rounded bg-gray-100 px-1.5 py-px font-mono text-[10px] text-gray-500">
              {row.contentPromptType}
            </span>
          )}
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

  const orgId = String(params.orgId ?? "");
  const brandId = String(params.brandId ?? "");
  const offerId = String(params.offerId ?? "");
  const campaignId = String(params.id ?? "");

  const { campaign, featureSlug, settled: slugSettled } = useScopedFeatureSlug(campaignId);
  // Null while the campaign read is in flight — never the brand's sole slug as a
  // stand-in, and the `pending` gate below is what the table renders until then.
  const revenueOk = featureSlug !== null && isRevenueFeature(featureSlug);

  // The channel's catalogue. Keyed on the slug, so two campaigns on two channels never
  // share an entry — and byte-equal to the key any future channel surface would poll.
  const catalogueQ = useAuthQuery(
    ["workflows", featureSlug ?? "none"],
    () => listChannelWorkflows(featureSlug as string),
    { ...pollOptions, enabled: isBeta && Boolean(featureSlug) },
  );

  // This CAMPAIGN's money per workflow. The campaign is in the key as well as in the
  // request: a brand-scoped entry answering a campaign-scoped question is the wrong-
  // scope bug wearing a cache key.
  const revenueQ = useAuthQuery(
    ["campaignWorkflowRevenue", brandId, campaignId],
    () => getFeatureRevenueByWorkflow(featureSlug as string, brandId, campaignId),
    { ...pollOptions, enabled: isBeta && Boolean(featureSlug) && Boolean(brandId) && Boolean(campaignId) },
  );

  // A stopped campaign produces nothing, so a thin price there is not "learning" — it
  // is waiting on a restart. Same derivation every other campaign surface reads.
  const { paused } = useScopePaused(brandId, { campaignId, enabled: isBeta });

  const rows = useMemo(
    () =>
      buildCampaignWorkflowRows({
        catalogue: catalogueQ.data ?? [],
        groups: revenueQ.data ?? [],
        campaignWorkflowSlug: campaign?.workflowSlug ?? null,
        isLearning,
      }),
    [catalogueQ.data, revenueQ.data, campaign?.workflowSlug],
  );

  // Reveal on SETTLE (resolved OR errored). A failing read paints the empty state,
  // never an eternal skeleton — and the two reads settle independently, so a slow
  // catalogue does not hold the money hostage.
  const pending =
    !slugSettled ||
    (catalogueQ.isPending && !catalogueQ.isError) ||
    (revenueQ.isPending && !revenueQ.isError);

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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-medium text-gray-900">Workflows</h1>
          <MaturityBadge level="beta" />
          <InfoTooltip tip={WORKFLOW_TIP} placement="top" />
        </div>
        <p className="mt-1 text-sm text-gray-500">{SCOPE_NOTE}</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          {/* The min-width is gated at the SAME breakpoint the folded columns come
              back at. An unconditional floor would re-widen the row on a phone and
              push the three columns that DO render off to the right, which reads as
              the data being missing rather than as it being one swipe away. */}
          <table className="w-full table-fixed md:table-auto md:min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3 w-[46%] md:w-[40%]">
                  Workflow <InfoTooltip tip={MODEL_TIP} placement="top" />
                </th>
                <th className="w-[22%] md:w-auto px-4 py-3 md:whitespace-nowrap">
                  Sales interests <InfoTooltip tip={OUTCOME_TIP} placement="top" />
                </th>
                <th className="w-[32%] md:w-auto px-4 py-3 md:whitespace-nowrap">
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
              {pending && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="px-4 py-6">
                    <Skeleton className="h-24 w-full rounded" />
                  </td>
                </tr>
              )}
              {!pending && !revenueOk && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="px-4 py-8 text-center text-sm text-gray-500">
                    This channel does not run workflows.
                  </td>
                </tr>
              )}
              {!pending && revenueOk && rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="px-4 py-8 text-center text-sm text-gray-500">
                    No workflow has run this campaign yet.
                  </td>
                </tr>
              )}
              {!pending &&
                revenueOk &&
                rows.map((row) => (
                  <tr
                    key={row.workflowDynastySlug}
                    onClick={() => router.push(open(row))}
                    onMouseEnter={() => prefetch(open(row))}
                    onFocus={() => prefetch(open(row))}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(open(row));
                      }
                    }}
                    className={`cursor-pointer border-b border-gray-100 last:border-0 transition hover:bg-gray-50 ${
                      row.running ? "bg-brand-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <WorkflowIdentity row={row} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                      {fmtCount(row.positiveReplies)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                      {row.learning ? (
                        <LearningTag paused={paused} />
                      ) : (
                        fmtCents(row.cpprCents)
                      )}
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
