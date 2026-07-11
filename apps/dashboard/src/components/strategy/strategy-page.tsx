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
import type {
  BrandOptimizationGoal,
  WorkflowExampleEmail,
  WorkflowProjectionRow,
} from "@/lib/api";
import {
  ALL_FIELDS,
  cloneFields,
  fieldsEqual,
  ListEditor,
  TextEditor,
  type ProfileFields,
} from "@/components/brand-profile/field-editor";
import {
  isRowFloored,
  modelAvatar,
  objectiveForOptimizationGoal,
  OFFER_LEVERS,
  outcomeNoun,
  pickAudienceOrBrandRow,
  pickBestBrandRow,
  WORKFLOW_GRAIN_LABEL,
} from "@/lib/strategy-model";
import { MetricLabel } from "@/components/visibility/metric-info";

/** Cost per positive reply at a row's server-resolved grain — read VERBATIM from the
 *  floor-filled unit-costs block (never null when the block exists), mirroring the
 *  ladder→item adapter in api.ts. `null` when the row / grain block is absent. No
 *  client-side math — same feature-service field the audiences page renders. */
function cpprFromRow(row: WorkflowProjectionRow | null | undefined): number | null {
  if (!row) return null;
  const block = row.estimatesByGrain[row.resolved.grain];
  return block?.unitCosts.costPerPositiveReplyUsd ?? null;
}

/** USD number → adaptive "$X.XX" (<$10) / "$X" (≥$10) / "-". */
function formatUsd(usd: number | null | undefined): string {
  if (usd == null) return "-";
  if (usd <= 0) return "$0";
  const decimals = Math.abs(usd) < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/**
 * USD render for a resolved cost-per-X tile — whole dollars, no cents ("$39"). When
 * `floored` the grain observed zero clicks/outcomes, so the number is a floor
 * (spentUsd / max(1)); we render it plain (no ">" prefix) because the ">" read as
 * confusing on a not-yet-realized outcome. `floored` is kept for callers that still
 * distinguish the grain elsewhere.
 */
function formatUsdFloor(usd: number | null | undefined, _floored: boolean): string {
  if (usd == null) return "-";
  if (usd <= 0) return "$0";
  const decimals = Math.abs(usd) < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** USD render for cost-per-click — adaptive "$X.XX" (<$10) / "$X" (≥$10) / "$0.00" / "-".
 *  CPC is usually a small figure ($1–$7) where the cents matter. */
function formatUsdCents(usd: number | null | undefined): string {
  if (usd == null) return "-";
  if (usd <= 0) return "$0.00";
  const decimals = Math.abs(usd) < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
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

/** Up-to-2-letter initials fallback when an audience has no generated avatar yet. */
function audienceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

/** Audience profile picture — the server-generated avatar when present, else an
 *  initials badge (mirrors the Top-audiences card + Customer Audiences table). */
function AudienceAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full border border-gray-200 bg-white object-cover"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-100 bg-brand-50 text-[10px] font-semibold text-brand-700">
      {audienceInitials(name)}
    </span>
  );
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
  const objective = objectiveForOptimizationGoal(optimizationGoal);
  const noun = outcomeNoun(optimizationGoal);
  // Sales-meetings objective → the funnel runs through a positive reply, so surface
  // the cost per positive reply (a card left of "Cost / meeting" + a CPPR column left
  // of CPC in the per-audience table). Read verbatim from the resolved grain.
  const showReplyStat = optimizationGoal === "sales_meetings";
  // For a website-visits brand the OUTCOME is the website visit itself, i.e. the click:
  // cost per website visit ≡ cost per click. So we render ONE "Cost per website visit"
  // tile/column (the click cost) and drop the separate outcome tile/column that would
  // otherwise duplicate it. Other goals keep both (click cost + a distinct outcome cost).
  const isWebsiteVisitsGoal = optimizationGoal === "website_visits";
  // positive_replies is single-step (reply → paid): the positive reply IS the outcome, and
  // clicks/website visits are not in the funnel. So DROP the "Cost per website visit" tile +
  // column (the "Cost / positive reply" outcome tile below already prices the funnel). Mirror
  // of the website_visits collapse, inverted (there the click IS the outcome; here it's noise).
  const isPositiveRepliesGoal = optimizationGoal === "positive_replies";

  // Objective + conversion-rate labels/values per goal (drives the header stat row).
  // purchase reuses the self-serve two-step (visit → signup → paid) — brand-service has
  // no purchase-specific rate; form_submissions is its own two-step (visit → form → paid).
  const OBJECTIVE_LABEL: Record<BrandOptimizationGoal, string> = {
    signups: "Signups",
    sales_meetings: "Sales meetings",
    website_visits: "Website visits",
    positive_replies: "Positive replies",
    form_submissions: "Form submissions",
    purchase: "Purchases",
  };
  const conv1: { label: string; value: number | null | undefined } =
    optimizationGoal === "signups"
      ? { label: "Visit → signup", value: econ?.visitToSignupPct }
      : optimizationGoal === "website_visits"
        ? { label: "Website visit → paid", value: econ?.visitToPaidClientPct }
        : optimizationGoal === "positive_replies"
          ? { label: "Positive reply → paid", value: econ?.replyToPaidClientPct }
          : optimizationGoal === "form_submissions"
            ? { label: "Visit → form submission", value: econ?.visitToFormSubmissionPct }
            : optimizationGoal === "purchase"
              ? { label: "Visit → signup", value: econ?.visitToSignupPct }
              : { label: "Reply → meeting", value: econ?.replyToMeetingPct };
  // Two-step goals show a second conversion; the single-step beta goals
  // (website_visits / positive_replies) go straight to paid, so no row 2.
  const conv2: { label: string; value: number | null | undefined } | null =
    optimizationGoal === "signups" || optimizationGoal === "purchase"
      ? { label: "Signup → paid", value: econ?.signupToPaidClientPct }
      : optimizationGoal === "form_submissions"
        ? { label: "Form submission → paid", value: econ?.formSubmissionToPaidClientPct }
        : optimizationGoal === "sales_meetings"
          ? { label: "Meeting → close", value: econ?.meetingToClosePct }
          : null;

  // The 3-grain workflow-projection ladder: one row per (audienceId, workflow) with
  // its cost at each grain + the server-`resolved` grain (brand-real when the brand
  // has run enough, else the fleet benchmark). This ONE call feeds both the best-model
  // headline (brand-level row) and the per-audience table (per-audience rows). Every
  // cost is read verbatim from `resolved` — no client-side CPC/CPS/projection math.
  const { data: projection, isPending: projPending } = useAuthQuery(
    ["workflowProjection", featureSlug, brandId, objective, "strategy-ladder"],
    () => getWorkflowProjectionLadder({ featureSlug, brandId, objective }),
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

  // Best model = the cheapest BRAND-LEVEL workflow, ranked on resolved.costPerOutcomeUsd
  // (the goal metric) at the row's server-resolved brand/crossOrg grain. We do NOT drive
  // this off recommendedWorkflowDynastySlug — that argmin spans per-audience rows (it's
  // for campaign-service's per-run audience selection), so one cheap 2-click audience leg
  // can crown a dynasty whose brand-level cost is bad/floored, making the headline show a
  // worse number than the brand's own average. Ranking the brand rows keeps it coherent.
  // Its headline economics are read verbatim from that row's `resolved`.
  const rows = projection?.rows ?? [];
  const brandRow = pickBestBrandRow(rows, projection?.recommendedWorkflowDynastySlug ?? null);
  const bestSlug = brandRow?.workflow.workflowDynastySlug ?? null;
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

  // Table order: cheapest Cost per website visit (= resolved.costPerClickUsd) first.
  // Audiences with no evidence row yet (no resolved cost) sort to the END. Each audience
  // falls back to the best workflow's brand-level row when it never ran it, so the cost
  // is that couple's audience-grain figure or the workflow's brand/crossOrg cost. Pure
  // display ordering — the cost itself is the server-resolved value, never recomputed here.
  const sortedAudiences = [...activeAudiences].sort((a, b) => {
    const ca = pickAudienceOrBrandRow(rows, bestSlug, a.id)?.resolved?.costPerClickUsd ?? null;
    const cb = pickAudienceOrBrandRow(rows, bestSlug, b.id)?.resolved?.costPerClickUsd ?? null;
    if (ca == null && cb == null) return 0;
    if (ca == null) return 1;
    if (cb == null) return -1;
    return ca - cb;
  });

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
              value={OBJECTIVE_LABEL[optimizationGoal]}
            />
            <Stat
              label="Lifetime revenue / client"
              pending={econPending}
              value={econ ? formatUsd(econ.lifetimeRevenueUsd) : "-"}
            />
            <Stat label={conv1.label} pending={econPending} value={formatPct(conv1.value)} />
            {conv2 && (
              <Stat label={conv2.label} pending={econPending} value={formatPct(conv2.value)} />
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
              <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${showReplyStat ? "lg:grid-cols-6" : isWebsiteVisitsGoal || isPositiveRepliesGoal ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
                {!isPositiveRepliesGoal && (
                  <Stat
                    label="Cost per website visit"
                    value={formatUsdCents(resolved.costPerClickUsd)}
                    tooltip="Cost per website visit - what we pay on average for one prospect to visit your site."
                    hint={grainHint(brandGrain)}
                  />
                )}
                {showReplyStat && (
                  <Stat
                    label="Cost / positive reply"
                    value={formatUsdFloor(cpprFromRow(brandRow), brandFloored)}
                    tooltip="Cost per positive reply - what we pay on average for one prospect to reply with genuine interest."
                    hint={grainHint(brandGrain)}
                  />
                )}
                {/* website_visits: the visit IS the outcome (= the click), so the tile above
                    already shows it — skip the duplicate outcome tile. */}
                {!isWebsiteVisitsGoal && (
                  <Stat
                    label={`Cost / ${noun}`}
                    value={formatUsdFloor(resolved.costPerOutcomeUsd, brandFloored)}
                    tooltip={`Cost per ${noun} - what we pay on average for one ${noun}.`}
                    hint={grainHint(brandGrain)}
                  />
                )}
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
                    <table className={`w-full ${showReplyStat ? "min-w-[720px]" : "min-w-[600px]"} border-collapse text-sm`}>
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-2.5 text-left font-semibold">Audience</th>
                          {showReplyStat && (
                            <th className="px-4 py-2.5 text-right font-semibold">
                              <span className="inline-flex items-center justify-end gap-1">
                                <MetricLabel
                                  text="CPPR"
                                  tip="Cost per positive reply - what we pay on average for one prospect to reply with genuine interest."
                                />
                              </span>
                            </th>
                          )}
                          {/* positive_replies: clicks aren't in the reply→paid funnel — drop the CPC column. */}
                          {!isPositiveRepliesGoal && (
                            <th className="px-4 py-2.5 text-right font-semibold">
                              <span className="inline-flex items-center justify-end gap-1">
                                <MetricLabel
                                  text="Cost per website visit"
                                  tip="Cost per website visit - what we pay on average for one prospect to visit your site."
                                />
                              </span>
                            </th>
                          )}
                          {/* website_visits: outcome ≡ website visit ≡ the column above — skip. */}
                          {!isWebsiteVisitsGoal && (
                            <th className="px-4 py-2.5 text-right font-semibold">
                              <span className="inline-flex items-center justify-end gap-1">
                                <MetricLabel
                                  text={
                                    optimizationGoal === "signups"
                                      ? "CPS"
                                      : optimizationGoal === "form_submissions"
                                        ? "CPFS"
                                        : `Cost / ${noun}`
                                  }
                                  tip={`Cost per ${noun} - what we pay on average for one ${noun}.`}
                                />
                              </span>
                            </th>
                          )}
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
                        {sortedAudiences.map((a) => {
                          // The audience's own projection row for the best workflow — its
                          // `resolved` grain was already picked audience→brand→crossOrg
                          // server-side. Falls back to the workflow's brand-level row when
                          // this audience never ran it (grain then honestly reads "this
                          // brand" / "fleet benchmark"). Read verbatim.
                          const row = pickAudienceOrBrandRow(rows, bestSlug, a.id);
                          const r = row?.resolved ?? null;
                          const floored = isRowFloored(row);
                          return (
                            <tr key={a.id}>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <AudienceAvatar name={a.name} avatarUrl={a.avatarUrl} />
                                  <div className="min-w-0">
                                    <span className="block truncate text-gray-700">{a.name}</span>
                                    <span className="text-[10px] text-gray-400">
                                      {r ? WORKFLOW_GRAIN_LABEL[r.grain] : "No data yet"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              {showReplyStat && (
                                <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                                  {formatUsdFloor(cpprFromRow(row), floored)}
                                </td>
                              )}
                              {!isPositiveRepliesGoal && (
                                <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                                  {formatUsdCents(r?.costPerClickUsd)}
                                </td>
                              )}
                              {!isWebsiteVisitsGoal && (
                                <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                                  {formatUsdFloor(r?.costPerOutcomeUsd, floored)}
                                </td>
                              )}
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
