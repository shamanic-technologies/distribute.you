"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useAuthQuery } from "@/lib/use-auth-query";
import { DashboardPage } from "@/components/dashboard-page";
import { Skeleton } from "@/components/skeleton";
import { MaturityBadge } from "@/components/maturity-badge";
import { pollOptions } from "@/lib/query-options";
import {
  fetchFeatureCandidates,
  getBrandProfile,
  getBrandSalesEconomics,
  getWorkflowProjection,
  listAudiences,
  listWorkflowExamples,
} from "@/lib/api";
import {
  goalForOptimizationGoal,
  modelAvatar,
  objectiveForOptimizationGoal,
  OFFER_LEVERS,
  offerLeverValue,
  outcomeNoun,
  projectionCostKey,
  selectBestModelEvidence,
} from "@/lib/strategy-model";

/** USD number → "$X.XX" / "—" / "<$0.01". */
function formatUsd(usd: number | null | undefined): string {
  if (usd == null) return "-";
  if (usd <= 0) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A percentage value already in % units → "X.X%" / "—". */
function formatPct(pct: number | null | undefined): string {
  if (pct == null) return "-";
  return `${pct.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  pending,
  hint,
}: {
  label: string;
  value: string;
  pending?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      {pending ? (
        <Skeleton className="mt-1.5 h-6 w-20" />
      ) : (
        <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      )}
      {hint ? <p className="mt-1 text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
}

/** Whole-page beta gate: non-beta users see this instead of the page body. The
 *  beta badge rides the sidebar nav entry; this is the in-page fallback. */
function NotAvailable() {
  return (
    <DashboardPage width="narrow">
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Strategy</h1>
        <p className="mt-2 text-sm text-gray-500">
          This page is in beta and is not available on your account yet.
        </p>
      </div>
    </DashboardPage>
  );
}

export function StrategyPage() {
  const featureSlug = useSoleFeatureSlug();
  const isBeta = useIsBetaUser();
  const revenueOk = isRevenueFeature(featureSlug);

  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;

  const [examplesOpen, setExamplesOpen] = useState(false);

  // Objective + conversion economics for the brand (drives the goal mapping).
  const { data: econData, isPending: econPending } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
    { ...pollOptions, enabled: revenueOk && !!brandId },
  );
  const econ = econData?.salesEconomics ?? null;
  // Default to the meetings objective until the saved economics resolve.
  const optimizationGoal = econ?.optimizationGoal ?? "sales_meetings";
  const goal = goalForOptimizationGoal(optimizationGoal);
  const objective = objectiveForOptimizationGoal(optimizationGoal);
  const costKey = projectionCostKey(optimizationGoal);
  const noun = outcomeNoun(optimizationGoal);

  // Ranked workflows + recommended pick + brand-level projected cost per outcome.
  const { data: projection, isPending: projPending } = useAuthQuery(
    ["workflowProjection", featureSlug, brandId, objective, "strategy"],
    () => getWorkflowProjection({ featureSlug, brandId, objective }),
    { ...pollOptions, enabled: revenueOk && !!brandId },
  );

  // Candidate evidence set (cross-org / brand-goal / per-audience grain ladder).
  const { data: candidatesData, isPending: candPending } = useAuthQuery(
    ["featureCandidates", featureSlug, brandId, goal],
    () => fetchFeatureCandidates(featureSlug, { brandId, goal }),
    { ...pollOptions, enabled: revenueOk && !!brandId },
  );

  // Active audiences — to label the per-audience evidence rows by name + avatar.
  const { data: audiencesData } = useAuthQuery(
    ["audiences", brandId, "active"],
    () => listAudiences(brandId, { status: "active" }),
    { ...pollOptions, enabled: revenueOk && !!brandId },
  );

  // Brand profile — the offer fields we optimise conversion against. Same data as
  // the Brand Profile editor in settings; here it's a read view.
  const { data: profileData, isPending: profilePending } = useAuthQuery(
    ["brandProfile", brandId],
    () => getBrandProfile(brandId),
    { ...pollOptions, enabled: revenueOk && !!brandId },
  );
  const profileFields = profileData?.current?.fields ?? null;
  const brandProfileHref = `/orgs/${orgId}/brands/${brandId}/brand-profile`;

  // Best model = the recommended workflow (lowest cost per outcome), else the
  // first ranked workflow.
  const workflows = projection?.workflows ?? [];
  const bestSlug =
    projection?.recommendedWorkflowDynastySlug ??
    workflows[0]?.workflowDynastySlug ??
    null;
  const bestWf = workflows.find((w) => w.workflowDynastySlug === bestSlug) ?? null;
  const bestName = bestWf?.workflowDynastyName ?? bestSlug ?? "-";
  const brandCostPerOutcome = bestWf ? (bestWf[costKey] ?? null) : null;
  const roiMultiple = bestWf?.roiMultiple ?? null;
  const avatar = bestSlug ? modelAvatar(bestSlug) : { emoji: "✨", color: "#6366f1" };

  const evidence = selectBestModelEvidence(candidatesData?.candidates ?? [], bestSlug);
  const audienceName = (audienceId: string): string =>
    audiencesData?.audiences.find((a) => a.id === audienceId)?.name ?? "Audience";

  // Example emails for the best model — fetched on demand (drawer), cascade
  // brand → org → global; empty is a clean "no examples yet" state.
  const { data: examplesData, isPending: examplesPending } = useAuthQuery(
    ["workflowExamples", bestSlug, brandId, "strategy"],
    () => listWorkflowExamples(bestSlug as string, brandId, 3),
    { ...pollOptions, enabled: examplesOpen && !!bestSlug && !!brandId },
  );

  if (!isBeta) return <NotAvailable />;

  return (
    <DashboardPage>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Strategy</h1>
            <MaturityBadge level="beta" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            How we run cold outreach for this brand, and which model performs best.
          </p>
        </div>

        {/* Agency framing banner */}
        <section className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          <p className="text-sm font-semibold text-brand-800">
            Cold email sales outreach, run for you
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-brand-700">
            We send cold sales emails to your prospects on your behalf, from our own
            warmed sending domains. The outreach is signed in our name and we speak
            to each prospect as our marketing agency. You set the goal and the budget.
            We find the prospects, write the emails, send them, and forward the warm replies.
          </p>
        </section>

        {/* Objective + conversion metrics recap */}
        <Card
          title="The plan"
          subtitle="Your objective and the conversion rates we optimise against."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Objective"
              pending={econPending}
              value={optimizationGoal === "signups" ? "Signups" : "Sales meetings"}
            />
            <Stat
              label="Lifetime revenue / client"
              pending={econPending}
              value={econ ? formatUsd(econ.lifetimeRevenueUsd) : "-"}
            />
            <Stat
              label={optimizationGoal === "signups" ? "Visit → signup" : "Reply → meeting"}
              pending={econPending}
              value={formatPct(
                optimizationGoal === "signups" ? econ?.visitToSignupPct : econ?.replyToMeetingPct,
              )}
            />
            <Stat
              label={optimizationGoal === "signups" ? "Signup → paid" : "Meeting → close"}
              pending={econPending}
              value={formatPct(
                optimizationGoal === "signups" ? econ?.signupToPaidClientPct : econ?.meetingToClosePct,
              )}
            />
          </div>
          {!econPending && !econ ? (
            <p className="mt-3 text-xs text-gray-400">
              No saved conversion economics yet. We use cross-brand averages until this
              brand builds its own history.
            </p>
          ) : null}
        </Card>

        {/* What we use to optimise conversion — the offer, read from Brand Profile */}
        <Card
          title="What we use to optimize your conversion"
          subtitle="Your offer through the Alex Hormozi value equation. We write the emails around these. Edit them in Brand Profile."
        >
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-500"
              aria-hidden
            >
              AH
            </span>
            <p className="text-xs text-gray-500">
              The stronger and clearer these are, the better each email converts. Anything
              marked not set is worth filling in.
            </p>
          </div>

          {profilePending ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
              {OFFER_LEVERS.map((lever) => {
                const lines = offerLeverValue(profileFields, lever.key);
                return (
                  <li key={lever.key} className="px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {lever.label}
                    </p>
                    {lines.length === 0 ? (
                      <p className="mt-1 text-sm text-gray-400">
                        Not set yet.{" "}
                        <Link href={brandProfileHref} className="text-brand-600 hover:underline">
                          Add in Brand Profile
                        </Link>
                      </p>
                    ) : lines.length === 1 ? (
                      <p className="mt-1 text-sm text-gray-700">{lines[0]}</p>
                    ) : (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-gray-700">
                        {lines.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3">
            <Link
              href={brandProfileHref}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Edit your offer in Brand Profile
            </Link>
          </div>
        </Card>

        {/* Best model */}
        <Card
          title="Your best model"
          subtitle={`The workflow with the lowest cost per ${noun} right now.`}
        >
          {projPending ? (
            <div className="space-y-4">
              <Skeleton className="h-14 w-full" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </div>
          ) : !bestWf ? (
            <p className="text-sm text-gray-500">
              No model has enough data yet. Once outreach runs, the best model appears here.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Identity row */}
              <div className="flex items-center gap-4">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl"
                  style={{ backgroundColor: `${avatar.color}1a`, border: `2px solid ${avatar.color}` }}
                  aria-hidden
                >
                  {avatar.emoji}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-lg font-semibold text-gray-900">{bestName}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Best
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {roiMultiple != null
                      ? `Projected ${roiMultiple.toLocaleString("en-US", { maximumFractionDigits: 1 })}× lifetime return on each dollar`
                      : "Selected automatically on each run from live performance"}
                  </p>
                </div>
              </div>

              {/* Expected $ per outcome — three levels */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat
                  label={`Cross-org cost / ${noun}`}
                  pending={candPending}
                  value={formatUsd(evidence.crossOrg?.costPerOutcomeUsd)}
                  hint="Across every brand we run this model for"
                />
                <Stat
                  label={`This brand cost / ${noun}`}
                  value={formatUsd(brandCostPerOutcome)}
                  hint="Projected from this brand's own economics"
                />
                <Stat
                  label="Active audiences"
                  pending={candPending}
                  value={String(evidence.audiences.length)}
                  hint="With their own per-audience cost below"
                />
              </div>

              {/* Per-audience $ per outcome */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Cost per {noun}, by audience
                </p>
                {candPending ? (
                  <div className="mt-2 space-y-2">
                    {[0, 1].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : evidence.audiences.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">
                    No per-audience performance yet. Every audience starts from the
                    cross-org cost above and earns its own number as we run it.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
                    {evidence.audiences.map((c) => (
                      <li
                        key={`${c.audienceId}-${c.workflow.workflowDynastySlug}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <span className="min-w-0 truncate text-sm text-gray-700">
                          {audienceName(c.audienceId as string)}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-gray-900">
                          {formatUsd(c.costPerOutcomeUsd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Example emails */}
              <div>
                <button
                  type="button"
                  onClick={() => setExamplesOpen((v) => !v)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  disabled={!bestSlug}
                >
                  {examplesOpen ? "Hide example emails" : "See example emails"}
                </button>
                {examplesOpen ? (
                  <div className="mt-3 space-y-3">
                    {examplesPending ? (
                      [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)
                    ) : (examplesData?.examples ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No example emails for this model yet.
                      </p>
                    ) : (
                      examplesData?.examples.map((ex) => (
                        <div key={ex.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {ex.subject ?? "(no subject)"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-400">From: distribute.you</p>
                          {ex.bodyText ? (
                            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-600 line-clamp-6">
                              {ex.bodyText}
                            </p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </Card>

        {/* Reassessment explainer */}
        <Card
          title="How we pick the best model"
          subtitle="It is reassessed on every run, never frozen."
        >
          <ol className="space-y-3 text-sm text-gray-600">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                1
              </span>
              <span>
                We start from the cross-org numbers: how each model performs across every
                brand we run it for. That is the safe default on day one.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                2
              </span>
              <span>
                As we run for this brand, we overwrite those numbers with this brand's own
                results, then with each audience's own results. The more we run, the more
                the choice reflects what actually works for you.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                3
              </span>
              <span>
                We pick audiences the same way: we favour the cheapest cost per {noun}, but
                spread contact across all of them around that best pick. So every audience
                keeps getting contacted while we converge on the most efficient ones.
              </span>
            </li>
          </ol>
        </Card>
      </div>
    </DashboardPage>
  );
}
