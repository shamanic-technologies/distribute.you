"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { EmailSignature } from "@/components/email-signature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useAuthQuery } from "@/lib/use-auth-query";
import { DashboardPage } from "@/components/dashboard-page";
import { Skeleton } from "@/components/skeleton";
import { pollOptions } from "@/lib/query-options";
import {
  getBrandProfile,
  getBrandSalesEconomics,
  getWorkflowProjectionLadder,
  listAudiences,
  listWorkflowExamples,
  saveBrandProfileVersion,
} from "@/lib/api";
import type { WorkflowExampleEmail } from "@/lib/api";
import {
  ALL_FIELDS,
  cloneFields,
  fieldsEqual,
  ListEditor,
  TextEditor,
  type ProfileFields,
} from "@/components/brand-profile/field-editor";
import {
  goalForOptimizationGoal,
  isRowFloored,
  modelAvatar,
  objectiveForOptimizationGoal,
  OFFER_LEVERS,
  outcomeNoun,
  pickAudienceRow,
  pickBrandRow,
  WORKFLOW_GRAIN_LABEL,
} from "@/lib/strategy-model";
import { MetricLabel } from "@/components/visibility/metric-info";

/** USD number → whole dollars "$X" (no cents) / "—". */
function formatUsd(usd: number | null | undefined): string {
  if (usd == null) return "-";
  if (usd <= 0) return "$0";
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * USD render for a resolved cost-per-X tile — two decimals ("$0.58"); the cents carry
 * real precision on per-click / per-signup costs. When `floored` the grain observed zero
 * clicks/outcomes, so the number is a floor (spentUsd / max(1)); we render it plain (no
 * ">" prefix) because the ">" read as confusing on a not-yet-realized outcome. `floored`
 * is kept for callers that still distinguish the grain elsewhere.
 */
function formatUsdFloor(usd: number | null | undefined, _floored: boolean): string {
  if (usd == null) return "-";
  if (usd <= 0) return "$0.00";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A percentage value already in % units → "X%" / "X.Y%" (one decimal, trailing zero dropped) / "—". */
function formatPct(pct: number | null | undefined): string {
  if (pct == null) return "-";
  return `${pct.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

/** A percentage in % units rendered as a whole number → "39%" / "—". For headline cost-of-
 *  acquisition tiles where the decimal reads as noise (conversion rates keep `formatPct`). */
function formatPctWhole(pct: number | null | undefined): string {
  if (pct == null) return "-";
  return `${pct.toLocaleString("en-US", { maximumFractionDigits: 0 })}%`;
}

/** A lifetime-return multiple → "X.X×" / "—". */
function formatRoi(x: number | null | undefined): string {
  if (x == null) return "-";
  return `${x.toLocaleString("en-US", { maximumFractionDigits: 1 })}×`;
}

/** Which population produced a resolved number → a short "based on …" hint that
 *  labels the number honestly (fleet benchmark vs this brand vs this audience). */
function grainHint(grain: "crossOrg" | "brand" | "audience" | null | undefined): string {
  switch (grain) {
    case "brand":
      return "From this brand's own results";
    case "audience":
      return "From this audience's own results";
    case "crossOrg":
      return "Fleet benchmark across every brand we run this for";
    default:
      return "";
  }
}

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

  const queryClient = useQueryClient();
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [expandedExampleId, setExpandedExampleId] = useState<string | null>(null);
  // Offer-fields inline edit: null = follow the saved baseline, an object = working edits.
  const [offerDraft, setOfferDraft] = useState<ProfileFields | null>(null);

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
  const noun = outcomeNoun(optimizationGoal);

  // The 3-grain workflow-projection ladder: one row per (audienceId, workflow) with
  // its cost at each grain + the server-`resolved` grain (brand-real when the brand
  // has run enough, else the fleet benchmark). This ONE call feeds both the best-model
  // headline (brand-level row) and the per-audience table (per-audience rows). Every
  // cost is read verbatim from `resolved` — no client-side CPC/CPS/projection math.
  const { data: projection, isPending: projPending } = useAuthQuery(
    ["workflowProjection", featureSlug, brandId, goal, "strategy-ladder"],
    () => getWorkflowProjectionLadder({ featureSlug, brandId, goal, objective }),
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
  // the Brand Profile editor; here the offer levers are edited inline (hover a zone
  // → click to edit), and Save forks a new immutable brand-profile version.
  const { data: profileData, isPending: profilePending } = useAuthQuery(
    ["brandProfile", brandId],
    () => getBrandProfile(brandId),
    { ...pollOptions, enabled: revenueOk && !!brandId },
  );
  const settingsHref = `/orgs/${orgId}/brands/${brandId}/settings`;

  // Full baseline fields bag — Save POSTs the WHOLE bag as a new version, so edits
  // to the offer levers must ride on top of every other brand-profile field, never
  // wipe them.
  const offerBaseline = cloneFields((profileData?.current?.fields ?? {}) as ProfileFields);
  const offerFields = offerDraft ?? offerBaseline;
  const offerDirty = offerDraft !== null && !fieldsEqual(offerDraft, offerBaseline);

  const saveOfferMut = useMutation({
    mutationFn: (fields: ProfileFields) => saveBrandProfileVersion(brandId, fields),
    onSuccess: () => {
      setOfferDraft(null);
      queryClient.invalidateQueries({ queryKey: ["brandProfile", brandId] });
    },
  });

  const setOfferText = (key: string, value: string) =>
    setOfferDraft((prev) => ({ ...(prev ?? offerBaseline), [key]: value }));

  const addOfferItem = (key: string, raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setOfferDraft((prev) => {
      const cur = prev ?? offerBaseline;
      const arr = Array.isArray(cur[key]) ? (cur[key] as string[]) : [];
      if (arr.some((v) => v.toLowerCase() === value.toLowerCase())) return cur;
      return { ...cur, [key]: [...arr, value] };
    });
  };

  const removeOfferItem = (key: string, value: string) =>
    setOfferDraft((prev) => {
      const cur = prev ?? offerBaseline;
      const arr = Array.isArray(cur[key]) ? (cur[key] as string[]) : [];
      return { ...cur, [key]: arr.filter((v) => v !== value) };
    });

  const saveOffer = () => {
    if (!offerDirty || saveOfferMut.isPending) return;
    saveOfferMut.mutate(offerFields);
  };

  // Best model = the recommended workflow, else the first row's workflow. Its headline
  // economics come from that workflow's BRAND-LEVEL row (audienceId null) `resolved`.
  const rows = projection?.rows ?? [];
  const bestSlug =
    projection?.recommendedWorkflowDynastySlug ??
    rows[0]?.workflow.workflowDynastySlug ??
    null;
  const brandRow = pickBrandRow(rows, bestSlug);
  const bestName = brandRow?.workflow.workflowDynastyName ?? bestSlug ?? "-";
  // Everything below is read straight from the server-resolved grain (never rescaled).
  const resolved = brandRow?.resolved ?? null;
  const brandGrain = resolved?.grain ?? null;
  const brandFloored = isRowFloored(brandRow);
  const roiMultiple = resolved?.roiMultiple ?? null;
  const avatar = bestSlug ? modelAvatar(bestSlug) : { emoji: "✨", color: "#6366f1" };

  // Every active audience gets a row = that audience's projection row (its own `resolved`
  // grain, already picked audience→brand→crossOrg server-side). Pure display pick — every
  // value stays server-provided (no client-side metric math, no rescale).
  const activeAudiences = audiencesData?.audiences ?? [];

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

        {/* What we use to optimise conversion — the offer, edited inline. Each lever
            is a hover-to-edit zone (the pencil appears on hover); Save forks a new
            immutable brand-profile version. No separate "Edit in Brand Profile" jump. */}
        <Card
          title="What we use to optimize your conversion"
          subtitle="Your offer through the Alex Hormozi value equation. We write the emails around these. Hover any field to edit it inline."
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
            <>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
                {OFFER_LEVERS.map((lever) => {
                  // Kind + placeholder come from the shared brand-profile field set
                  // (services / socialProof are lists, the rest free text).
                  const def = ALL_FIELDS.find((f) => f.key === lever.key);
                  const kind = def?.kind ?? "text";
                  const placeholder = def?.placeholder ?? "";
                  const value = offerFields[lever.key];
                  return (
                    <li key={lever.key} className="px-4 py-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        <MetricLabel text={lever.label} tip={lever.tip} placement="top" />
                      </p>
                      {kind === "text" ? (
                        <TextEditor
                          value={typeof value === "string" ? value : ""}
                          placeholder={placeholder}
                          onText={(v) => setOfferText(lever.key, v)}
                        />
                      ) : (
                        <ListEditor
                          values={Array.isArray(value) ? value : []}
                          placeholder={placeholder}
                          onAdd={(v) => addOfferItem(lever.key, v)}
                          onRemove={(v) => removeOfferItem(lever.key, v)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>

              {offerDirty ? (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOfferDraft(null)}
                    className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={saveOffer}
                    disabled={saveOfferMut.isPending}
                    className={`rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition ${
                      saveOfferMut.isPending
                        ? "cursor-wait"
                        : "hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    {saveOfferMut.isPending ? "Saving…" : "Save changes"}
                  </button>
                </div>
              ) : null}
            </>
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
          ) : !resolved ? (
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-lg font-semibold text-gray-900">{bestName}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Best
                    </span>
                    {brandGrain ? (
                      <span
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                        title="Which population these numbers are based on — the finest grain with real data (this audience → this brand → fleet benchmark)."
                      >
                        Based on {WORKFLOW_GRAIN_LABEL[brandGrain]}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500">
                    {roiMultiple != null
                      ? `Projected ${roiMultiple.toLocaleString("en-US", { maximumFractionDigits: 1 })}× lifetime return on each dollar`
                      : "Selected automatically on each run from live performance"}
                  </p>
                </div>
              </div>

              {/* Projected economics — all five read VERBATIM from the resolved grain.
                  Labelled by grain (hint) so a fleet-benchmark or per-audience number is
                  never mislabelled "this brand"; costs render ">$X" when the grain saw 0
                  clicks (a floor, not an exact figure). */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                <Stat
                  label="Cost / click"
                  value={formatUsdFloor(resolved.costPerClickUsd, brandFloored)}
                  tooltip="Cost per click - what we pay on average for one prospect to click through to your site."
                  hint={grainHint(brandGrain)}
                />
                <Stat
                  label={`Cost / ${noun}`}
                  value={formatUsdFloor(resolved.costPerOutcomeUsd, brandFloored)}
                  tooltip={`Cost per ${noun} - what we pay on average for one ${noun}.`}
                  hint={grainHint(brandGrain)}
                />
                <Stat
                  label="Cost / paid client"
                  value={formatUsdFloor(resolved.costPerPaidClientUsd, brandFloored)}
                  tooltip="Cost per paid client - what we pay on average to win one paying client."
                  hint={grainHint(brandGrain)}
                />
                <Stat
                  label="Lifetime revenue on each dollar spent"
                  value={
                    roiMultiple != null
                      ? `${roiMultiple.toLocaleString("en-US", { maximumFractionDigits: 1 })}×`
                      : "-"
                  }
                  hint="Lifetime revenue of a paid client per dollar of outreach spend"
                />
                <Stat
                  label="Cost of acquisition"
                  value={formatPctWhole(resolved.cacPct)}
                  tooltip="Cost to acquire a paid client divided by the lifetime revenue of a paid client"
                  hint="Share of a client's lifetime revenue spent to acquire them"
                />
              </div>

              {/* Per-audience metrics — CPC / CPS / ROI / CAC */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Estimates by audience
                </p>
                {projPending || audiencesPending ? (
                  <div className="mt-2 space-y-2">
                    {[0, 1].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : activeAudiences.length === 0 ? (
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
                        {activeAudiences.map((a) => {
                          // The audience's own projection row; its `resolved` grain was
                          // already picked audience→brand→crossOrg server-side. Read
                          // verbatim — plain "$X" even when that grain saw 0 clicks.
                          const row = pickAudienceRow(rows, bestSlug, a.id);
                          const r = row?.resolved ?? null;
                          const floored = isRowFloored(row);
                          return (
                            <tr key={a.id}>
                              <td className="px-4 py-2.5">
                                <span className="block truncate text-gray-700">{a.name}</span>
                                <span className="text-[10px] text-gray-400">
                                  {r ? WORKFLOW_GRAIN_LABEL[r.grain] : "No data yet"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                                {formatUsdFloor(r?.costPerClickUsd, floored)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                                {formatUsdFloor(r?.costPerOutcomeUsd, floored)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                                {formatRoi(r?.roiMultiple)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                                {formatPctWhole(r?.cacPct)}
                              </td>
                            </tr>
                          );
                        })}
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
