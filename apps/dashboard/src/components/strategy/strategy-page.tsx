"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDownIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { EmailSignature } from "@/components/email-signature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useAuthQuery } from "@/lib/use-auth-query";
import { DashboardPage } from "@/components/dashboard-page";
import { Skeleton } from "@/components/skeleton";
import { pollOptions } from "@/lib/query-options";
import {
  fetchFeatureCandidates,
  getBrandProfile,
  getBrandSalesEconomics,
  getWorkflowProjection,
  listAudiences,
  listWorkflowExamples,
} from "@/lib/api";
import type { WorkflowExampleEmail } from "@/lib/api";
import {
  buildAudienceMetricRows,
  goalForOptimizationGoal,
  modelAvatar,
  objectiveForOptimizationGoal,
  OFFER_LEVERS,
  offerLeverValue,
  outcomeNoun,
  projectionCostKey,
  selectBestModelEvidence,
} from "@/lib/strategy-model";
import type { AudienceMetricProvenance } from "@/lib/strategy-model";
import { MetricLabel } from "@/components/visibility/metric-info";

/** USD number → "$X.XX" (two decimals) / "—". */
function formatUsd(usd: number | null | undefined): string {
  if (usd == null) return "-";
  if (usd <= 0) return "$0.00";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A percentage value already in % units → "X%" / "X.Y%" (one decimal, trailing zero dropped) / "—". */
function formatPct(pct: number | null | undefined): string {
  if (pct == null) return "-";
  return `${pct.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

/** A lifetime-return multiple → "X.X×" / "—". */
function formatRoi(x: number | null | undefined): string {
  if (x == null) return "-";
  return `${x.toLocaleString("en-US", { maximumFractionDigits: 1 })}×`;
}

/** Human label for which fallback rung supplied an audience's metrics. */
const PROVENANCE_LABEL: Record<AudienceMetricProvenance, string> = {
  own: "Your data",
  brand: "Brand average",
  crossOrg: "Cross-org average",
};

function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Top-right "Edit" text link for a card header. */
function EditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="text-xs font-medium text-brand-600 hover:underline whitespace-nowrap"
    >
      Edit
    </Link>
  );
}

/**
 * One example email rendered as an expandable card: collapsed shows the lead +
 * subject + first body lines; expanded shows the full sequence (initial email +
 * each follow-up, with its delay) plus the static outbound signature. Mirrors the
 * admin campaigns/new "See example emails" card so the user sees the real output,
 * follow-ups included. From line is always distribute.you (agency-domain model).
 */
function ExampleEmailCard({
  email,
  expanded,
  onToggle,
}: {
  email: WorkflowExampleEmail;
  expanded: boolean;
  onToggle: () => void;
}) {
  const firstBody = email.sequence?.[0]?.bodyText ?? email.bodyText;
  const steps =
    email.sequence && email.sequence.length > 0
      ? email.sequence
      : firstBody
        ? [{ step: 1, bodyText: firstBody, bodyHtml: "", daysSinceLastStep: 0 }]
        : [];
  const lead =
    [email.leadFirstName, email.leadLastName].filter(Boolean).join(" ") || "Lead";
  const otherSource = email.scope === "org" || email.scope === "global";
  const sourceLabel =
    email.brandName || (email.scope === "org" ? "another brand" : "another workspace");

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-gray-300"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-gray-800">
          {lead}
          {email.leadCompany ? ` · ${email.leadCompany}` : ""}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {otherSource ? (
            <span
              title="Example from another brand / workspace, shown so you can preview this model"
              className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700"
            >
              Example · {sourceLabel}
            </span>
          ) : null}
          {steps.length > 0 ? (
            <ChevronDownIcon
              className={`h-3.5 w-3.5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          ) : null}
        </span>
      </div>
      {email.subject ? (
        <div className="mt-1 truncate text-xs font-semibold text-gray-700">{email.subject}</div>
      ) : null}
      <p className="mt-0.5 text-[11px] text-gray-400">From: distribute.you</p>
      {!expanded && firstBody ? (
        <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] text-gray-500">
          {firstBody}
        </div>
      ) : null}
      {expanded ? (
        <div className="mt-2 space-y-2">
          {steps.map((s) => (
            <div key={s.step} className="border-t border-gray-100 pt-2">
              {steps.length > 1 ? (
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {s.step === 1
                    ? "Initial email"
                    : `Follow-up ${s.step - 1}${s.daysSinceLastStep ? ` · ${s.daysSinceLastStep} day${s.daysSinceLastStep === 1 ? "" : "s"} later` : ""}`}
                </div>
              ) : null}
              <div className="mt-0.5 whitespace-pre-wrap text-[11px] text-gray-600">{s.bodyText}</div>
              {s.bodyText ? <EmailSignature className="text-[11px] text-gray-500" /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function Stat({
  label,
  value,
  pending,
  hint,
  tooltip,
}: {
  label: string;
  value: string;
  pending?: boolean;
  hint?: string;
  tooltip?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {label}
        {tooltip ? (
          <InformationCircleIcon
            className="h-3.5 w-3.5 shrink-0 cursor-help text-gray-300"
            title={tooltip}
          />
        ) : null}
      </p>
      {pending ? (
        <Skeleton className="mt-1.5 h-6 w-20" />
      ) : (
        <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      )}
      {hint ? <p className="mt-1 text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
}

export function StrategyPage() {
  const featureSlug = useSoleFeatureSlug();
  const revenueOk = isRevenueFeature(featureSlug);

  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;

  const [examplesOpen, setExamplesOpen] = useState(false);
  const [expandedExampleId, setExpandedExampleId] = useState<string | null>(null);

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
    // budgetUsd:1 populates `projection` (and its budget-invariant `cacPct`) so the
    // "Projected cost of acquisition" stat renders the CAC% instead of "-".
    () => getWorkflowProjection({ featureSlug, brandId, objective, budgetUsd: 1 }),
    { ...pollOptions, enabled: revenueOk && !!brandId },
  );

  // Candidate evidence set (cross-org / brand-goal / per-audience grain ladder).
  const { data: candidatesData, isPending: candPending } = useAuthQuery(
    ["featureCandidates", featureSlug, brandId, goal],
    () => fetchFeatureCandidates(featureSlug, { brandId, goal }),
    { ...pollOptions, enabled: revenueOk && !!brandId },
  );

  // Active audiences — the brand's full active set. Every one is shown in the best
  // model's per-audience list (with its own cost where it has run evidence, else the
  // cross-org cost), so the count never undercounts to "only audiences with evidence".
  const { data: audiencesData, isPending: audiencesPending } = useAuthQuery(
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
  const settingsHref = `/orgs/${orgId}/brands/${brandId}/settings`;

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

  // Every active audience gets a row with its four metrics (CPC / CPS / ROI / CAC),
  // each read from its own per-audience candidate where it has run evidence, else the
  // brand-average → cross-org fallback. Pure display join — every value stays
  // server-provided (no client-side metric math).
  const activeAudiences = audiencesData?.audiences ?? [];
  const audienceRows = buildAudienceMetricRows(activeAudiences, evidence);

  // Example emails for the best model — fetched on demand (drawer), cascade
  // brand → org → global; empty is a clean "no examples yet" state.
  const { data: examplesData, isPending: examplesPending } = useAuthQuery(
    ["workflowExamples", bestSlug, brandId, "strategy"],
    () => listWorkflowExamples(bestSlug as string, brandId, 3),
    { ...pollOptions, enabled: examplesOpen && !!bestSlug && !!brandId },
  );

  return (
    <DashboardPage>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Strategy</h1>
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
          action={<EditLink href={settingsHref} />}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Objective"
              pending={econPending}
              value={
                optimizationGoal === "signups"
                  ? "Signups"
                  : optimizationGoal === "website_visits"
                    ? "Website visits"
                    : optimizationGoal === "positive_replies"
                      ? "Positive replies"
                      : "Sales meetings"
              }
            />
            <Stat
              label="Lifetime revenue / client"
              pending={econPending}
              value={econ ? formatUsd(econ.lifetimeRevenueUsd) : "-"}
            />
            <Stat
              label={
                optimizationGoal === "signups"
                  ? "Visit → signup"
                  : optimizationGoal === "website_visits"
                    ? "Website visit → paid"
                    : optimizationGoal === "positive_replies"
                      ? "Positive reply → paid"
                      : "Reply → meeting"
              }
              pending={econPending}
              value={formatPct(
                optimizationGoal === "signups"
                  ? econ?.visitToSignupPct
                  : optimizationGoal === "website_visits"
                    ? econ?.visitToPaidClientPct
                    : optimizationGoal === "positive_replies"
                      ? econ?.replyToPaidClientPct
                      : econ?.replyToMeetingPct,
              )}
            />
            {/* The two-step goals show a second conversion; the single-step beta goals
                (website_visits / positive_replies) go straight to paid, so no row 2. */}
            {(optimizationGoal === "signups" || optimizationGoal === "sales_meetings") && (
              <Stat
                label={optimizationGoal === "signups" ? "Signup → paid" : "Meeting → close"}
                pending={econPending}
                value={formatPct(
                  optimizationGoal === "signups"
                    ? econ?.signupToPaidClientPct
                    : econ?.meetingToClosePct,
                )}
              />
            )}
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
          action={<EditLink href={brandProfileHref} />}
        >
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <img
              src="/alex-hormozi.png"
              alt="Alex Hormozi"
              className="h-9 w-9 shrink-0 rounded-full border border-gray-300 object-cover"
            />
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
                      <MetricLabel text={lever.label} tip={lever.tip} placement="top" />
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

              {/* This brand's projected economics — all five are served fields */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                <Stat
                  label="This brand cost / click"
                  value={formatUsd(bestWf.clickUsd)}
                  tooltip="Cost per click - what we pay on average for one prospect to click through to your site."
                  hint="Projected from this brand's own economics"
                />
                <Stat
                  label={`This brand cost / ${noun}`}
                  value={formatUsd(brandCostPerOutcome)}
                  tooltip={`Cost per ${noun} - what we pay on average for one ${noun}.`}
                  hint="Projected from this brand's own economics"
                />
                <Stat
                  label="This brand cost / paid client"
                  value={formatUsd(bestWf.costPerCloseUsd)}
                  tooltip="Cost per paid client - what we pay on average to win one paying client."
                  hint="Projected from this brand's own economics"
                />
                <Stat
                  label="Projected lifetime revenue on each dollar spent"
                  value={
                    roiMultiple != null
                      ? `${roiMultiple.toLocaleString("en-US", { maximumFractionDigits: 1 })}×`
                      : "-"
                  }
                  hint="Lifetime revenue of a paid client per dollar of outreach spend"
                />
                <Stat
                  label="Projected cost of acquisition"
                  value={formatPct(bestWf.projection?.cacPct)}
                  tooltip="Cost to acquire a paid client divided by the lifetime revenue of a paid client"
                  hint="Share of a client's lifetime revenue spent to acquire them"
                />
              </div>

              {/* Per-audience metrics — CPC / CPS / ROI / CAC */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Estimates by audience
                </p>
                {candPending || audiencesPending ? (
                  <div className="mt-2 space-y-2">
                    {[0, 1].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : audienceRows.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">
                    No active audience yet. Once you activate an audience it appears here
                    with its estimates.
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full min-w-[600px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-2.5 text-left font-semibold">Audience</th>
                          <th className="px-4 py-2.5 text-right font-semibold">
                            <span className="inline-flex items-center justify-end gap-1">
                              <MetricLabel
                                text="CPC"
                                tip="Cost per click - what we pay on average for one prospect to click through to your site."
                              />
                            </span>
                          </th>
                          <th className="px-4 py-2.5 text-right font-semibold">
                            <span className="inline-flex items-center justify-end gap-1">
                              <MetricLabel
                                text={optimizationGoal === "signups" ? "CPS" : `Cost / ${noun}`}
                                tip={`Cost per ${noun} - what we pay on average for one ${noun}.`}
                              />
                            </span>
                          </th>
                          <th className="px-4 py-2.5 text-right font-semibold">
                            <span className="inline-flex items-center justify-end gap-1">
                              <MetricLabel
                                text="ROI"
                                tip="Return on investment - dollars of lifetime revenue back for every dollar spent."
                              />
                            </span>
                          </th>
                          <th className="px-4 py-2.5 text-right font-semibold">
                            <span className="inline-flex items-center justify-end gap-1">
                              <MetricLabel
                                text="CAC"
                                tip="Customer acquisition cost - share of a paying client's lifetime revenue we spend to win them."
                              />
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {audienceRows.map((a) => (
                          <tr key={a.id}>
                            <td className="px-4 py-2.5">
                              <span className="block truncate text-gray-700">{a.name}</span>
                              <span className="text-[10px] text-gray-400">
                                {PROVENANCE_LABEL[a.provenance]}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                              {formatUsd(a.clickUsd)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                              {formatUsd(a.costPerOutcomeUsd)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                              {formatRoi(a.roiMultiple)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                              {formatPct(a.cacPct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-gray-400">
                      Click an email to see the full message and its follow-ups.
                    </p>
                    {examplesPending ? (
                      [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)
                    ) : (examplesData?.examples ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No example emails for this model yet.
                      </p>
                    ) : (
                      examplesData?.examples.map((ex) => (
                        <ExampleEmailCard
                          key={ex.id}
                          email={ex}
                          expanded={expandedExampleId === ex.id}
                          onToggle={() =>
                            setExpandedExampleId((cur) => (cur === ex.id ? null : ex.id))
                          }
                        />
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
