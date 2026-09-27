"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  ApiError,
  editWorkflowPrompt,
  getWorkflowActualCostHistory,
  getBrand,
  getPlatformPrompt,
  getWorkflowRevenue,
  listAudiences,
  listBrandRunLedger,
  listRunEmails,
  type Email,
  type RunRow,
} from "@/lib/api";
import { MaturityBadge } from "@/components/maturity-badge";
import { WorkflowRankPanel } from "@/components/workflows/workflow-rank-panel";
import { WorkflowStackLine } from "@/components/workflows/workflow-cells";
import { CrewMark } from "@/components/v2/crew-mark";
import { V2Page } from "@/components/v2/setup-pages";
import { EmptyNote, Shimmer, StateDot } from "@/components/v2/ui";
import { useMissions } from "@/components/v2/use-missions";
import { useBrandCrewSpecs, useCrewWorkflowRanking } from "@/components/v2/workflows-data";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { friendlyDateTime } from "@/lib/friendly-datetime";
import { audienceRowsFor, scopeLadderRows } from "@/lib/workflow-grains";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useIsAdminUser } from "@/lib/use-admin-user";
import { v2Href, v2WorkflowHref } from "@/lib/v2/routes";

/** How many of a dynasty's most recent versions the run history reads. */
const RUN_VERSIONS = 4;
/** How many runs a version contributes, and how many cards the list shows. */
const RUNS_PER_VERSION = 25;
const RUNS_SHOWN = 30;

/**
 * ONE workflow dynasty, priced for one crew at BRAND grain, beta.
 *
 * Left: the same cards the mission Workflows panel shows (rank and why, how it was
 * priced, audiences, this brand's own figures), then cost, value and return over time.
 * Right: the prompt it writes with, and every run it made for this brand, each opening
 * the emails that run wrote.
 */
export function V2WorkflowPage() {
  const { orgId, brandId, workflowSlug } = useParams<{ orgId: string; brandId: string; workflowSlug: string }>();
  const dynasty = decodeURIComponent(workflowSlug);
  const crewRaw = useSearchParams().get("crew") ?? "";
  const [featureSlug, legKey] = crewRaw.split("|");
  const isBeta = useIsBetaUser();
  const router = useRouter();
  const { specs } = useBrandCrewSpecs(orgId, brandId);
  const spec = featureSlug && legKey ? { featureSlug, legKey } : null;
  const crew = specs.find((s) => s.featureSlug === featureSlug && s.legKey === legKey)?.crew ?? null;
  const ranking = useCrewWorkflowRanking(brandId, spec, isBeta);
  const ranked = ranking.ranked.find((r) => r.row.workflowDynastySlug === dynasty) ?? null;
  const name = ranked?.row.workflowDynastyName ?? dynasty;

  const brandQ = useAuthQuery(["brand", brandId], () => getBrand(brandId), { ...pollOptions, enabled: isBeta });
  const audiencesQ = useAuthQuery(["audiences", brandId], () => listAudiences(brandId), { ...pollOptions, enabled: isBeta });
  const audienceById = useMemo(() => {
    const m = new Map<string, { name: string; avatarUrl: string | null }>();
    for (const a of audiencesQ.data?.audiences ?? []) m.set(a.id, { name: a.name, avatarUrl: a.avatarUrl ?? null });
    return m;
  }, [audiencesQ.data]);

  const ladderRow =
    scopeLadderRows(ranking.allLadderRows, null).find((r) => r.workflow.workflowDynastySlug === dynasty) ?? null;

  return (
    <V2Page
      crumbs={[
        { label: "Workflows", href: v2Href(orgId, brandId, "workflows") },
        {
          label: crew ? (
            <span className="inline-flex items-center gap-1.5">
              <CrewMark color={crew.color} glyph={crew.glyph} size={14} />
              {crew.name}
            </span>
          ) : (
            "Crew"
          ),
        },
        { label: name },
      ]}
      title={
        <span className="flex items-center gap-2">
          {name} <MaturityBadge level="beta" />
        </span>
      }
      sub={
        ranked ? (
          <WorkflowStackLine contentModel={ranked.row.contentModel} contentPromptType={ranked.row.contentPromptType} />
        ) : undefined
      }
      width="max-w-[1400px]"
    >
      {!isBeta ? (
        <div className="k-card">
          <EmptyNote>This page is still in beta and is not open on your account yet.</EmptyNote>
        </div>
      ) : !spec ? (
        <div className="k-card">
          <EmptyNote>This link names no crew, so there is no outcome to price this workflow on.</EmptyNote>
        </div>
      ) : ranking.pending ? (
        <Shimmer className="h-96 w-full rounded-xl" />
      ) : !ranked ? (
        <div className="k-card">
          <EmptyNote>This crew does not offer this workflow.</EmptyNote>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <WorkflowRankPanel
              variant="inline"
              ranked={ranked}
              featureSlug={spec.featureSlug}
              brandId={brandId}
              campaignId={null}
              pair={ranking.pair}
              outcomeStepKey={ranking.outcomeStepKey}
              outcomeNoun={ranking.outcomeNoun}
              siblings={ranking.rows}
              paused={false}
              ladderRow={ladderRow}
              audienceRows={audienceRowsFor(ranking.allLadderRows, dynasty)}
              audienceById={audienceById}
              brandDomain={brandQ.data?.brand.domain ?? null}
              brandLogoUrl={brandQ.data?.brand.logoUrl ?? null}
              legStepLabel={ranking.ladder?.leg?.toStep.label ?? null}
              onClose={() => {}}
            />
            <OverTime featureSlug={spec.featureSlug} brandId={brandId} dynasty={dynasty} />
          </div>
          <div className="min-w-0 space-y-4">
            <PromptCard
              promptType={ranked.row.contentPromptType}
              dynasty={dynasty}
              workflowName={name}
              featureSlug={spec.featureSlug}
              onForked={(slug) => router.push(v2WorkflowHref(orgId, brandId, slug, crewRaw))}
            />
            <RunsCard
              orgId={orgId}
              brandId={brandId}
              dynasty={dynasty}
              versions={ranking.versionsByDynasty.get(dynasty) ?? []}
            />
          </div>
        </div>
      )}
    </V2Page>
  );
}

// ─── Cost, value and return over time ──────────────────────────────────────

/**
 * Three curves over time for this workflow at brand grain: cumulative cost, cumulative
 * pipeline value, and their ratio, each as the producer states it. Nothing is divided
 * here; a day the producer states no figure for is left out of that chart.
 *
 * USER COST (default, everyone on the beta list) reads features-service's `roiHistory`
 * (`pricing=net`): what the client is billed. ACTUAL COST (STAFF only) reads the same
 * curve costed at what the vendors charged us before our markup. It reveals our margin,
 * so the switch is offered to the staff list alone and the gateway refuses anyone else.
 * The value curve is the same on both bases; only cost and return move.
 */
function OverTime({ featureSlug, brandId, dynasty }: { featureSlug: string; brandId: string; dynasty: string }) {
  const isStaff = useIsAdminUser();
  const [basis, setBasis] = useState<"user" | "actual">("user");
  const actual = isStaff && basis === "actual";
  const q = useAuthQuery(
    ["workflowRevenue", brandId, "brand", dynasty],
    () => getWorkflowRevenue(featureSlug, brandId, null, dynasty),
    pollOptions,
  );
  const actualQ = useAuthQuery(
    ["workflowActualCost", brandId, dynasty],
    () => getWorkflowActualCostHistory(featureSlug, brandId, dynasty),
    { ...pollOptions, enabled: actual, retry: false },
  );
  const src = actual ? actualQ : q;
  const pending = src.isPending && !src.isError;
  const daily: { date: string; cumulativeSpendUsd: number | null; cumulativePipelineUsd: number; roiMultiple: number | null }[] =
    actual ? (actualQ.data?.daily ?? []) : (q.data?.roiHistory?.daily ?? []);
  const points = daily.map((d) => ({
    date: d.date,
    spend: d.cumulativeSpendUsd,
    value: d.cumulativePipelineUsd,
    roi: d.roiMultiple,
  }));
  const spendPoints = points.filter((p) => p.spend != null);
  const roiPoints = points.filter((p) => p.roi != null);
  const unpriced = actual ? actualQ.data?.unpricedBilledCostUsd ?? 0 : 0;
  const unpricedFrom = actual ? actualQ.data?.unpricedFromDate ?? null : null;
  const unreadable = actual && !actualQ.isPending && !actualQ.isError && actualQ.data === null;
  const costNote = actual
    ? "What the vendors charged us to run it for this brand, before our margin, added up day by day."
    : "What this brand has been billed for it, added up day by day.";

  return (
    <div className="mt-4 space-y-4">
      {isStaff && (
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-[13px]" role="group" aria-label="Cost basis">
            {(["user", "actual"] as const).map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={basis === b}
                onClick={() => setBasis(b)}
                className={`rounded-md px-3 py-1 ${basis === b ? "bg-brand-50 font-medium text-brand-700" : "text-gray-600 hover:text-gray-900"}`}
              >
                {b === "user" ? "User cost" : "Actual cost"}
              </button>
            ))}
          </div>
          <MaturityBadge level="staff" />
        </div>
      )}
      {unreadable && <p className="text-xs text-gray-500">We could not read the actual cost for this workflow just now.</p>}
      {unpriced > 0 && (
        <p className="text-xs text-gray-500">
          {formatUsdAdaptive(unpriced)} of billed spend
          {unpricedFrom ? ` from ${unpricedFrom}` : ""} has no known vendor cost, so the actual cost and return stop there.
        </p>
      )}
      <ChartCard
        title="Cost to run it"
        note={costNote}
        pending={pending}
        failed={src.isError}
        data={spendPoints}
        dataKey="spend"
        format={formatUsdAdaptive}
      />
      <ChartCard
        title="Value generated"
        note="The pipeline value its outcomes are worth, added up day by day."
        pending={pending}
        failed={src.isError}
        data={points}
        dataKey="value"
        format={formatUsdAdaptive}
      />
      <ChartCard
        title="Return on spend"
        note={actual ? "Value generated divided by what it actually cost us, to date." : "Value generated divided by what was billed, to date."}
        pending={pending}
        failed={src.isError}
        data={roiPoints}
        dataKey="roi"
        format={(v) => formatRoi(v, "—")}
      />
    </div>
  );
}

function ChartCard({
  title,
  note,
  pending,
  failed,
  data,
  dataKey,
  format,
}: {
  title: string;
  note: string;
  pending: boolean;
  failed: boolean;
  data: { date: string; spend: number | null; value: number; roi: number | null }[];
  dataKey: "spend" | "value" | "roi";
  format: (v: number) => string;
}) {
  const last = data.length ? data[data.length - 1][dataKey] : null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">{title}</h3>
        <span className="text-sm font-medium text-gray-900 tabular-nums">{last == null ? "—" : format(last)}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{note}</p>
      <div className="mt-3 h-[140px] text-brand-600">
        {pending ? (
          <Shimmer className="h-full w-full" />
        ) : failed ? (
          <p className="pt-10 text-center text-xs text-gray-500">We could not read this curve just now.</p>
        ) : data.length === 0 ? (
          <p className="pt-10 text-center text-xs text-gray-500">No dated history for this workflow on this brand yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={32} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v: number) => format(v)}
              />
              <Tooltip formatter={(v) => format(Number(v))} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
              <Line type="linear" dataKey={dataKey} stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const UPGRADE_WARNING =
  "Every campaign on this workflow, for every brand, writes with the edited prompt from its next run. The current prompt is kept as it is; the edit becomes a new template.";
const FORK_WARNING =
  "A new workflow is created that writes with the edited prompt. It joins this channel's catalogue for every brand and can be picked for any campaign. The original is untouched.";

/**
 * The prompt template the workflow writes with, read by the type its DAG names.
 *
 * Everyone on the beta list can READ it. EDITING is staff-only: a fork or an upgrade
 * changes what every brand's campaigns can send, so the control is offered only to the
 * staff list (and the gateway refuses anyone else whatever the page shows). The two
 * actions are workflow-service's (#454); a refusal is shown in its own words.
 */
function PromptCard({
  promptType,
  dynasty,
  workflowName,
  featureSlug,
  onForked,
}: {
  promptType: string | null;
  dynasty: string;
  workflowName: string;
  featureSlug: string;
  onForked: (newDynasty: string) => void;
}) {
  const isStaff = useIsAdminUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"upgrade" | "fork" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const q = useAuthQuery(["platformPrompt", promptType ?? "none"], () => getPlatformPrompt(promptType as string), {
    ...pollOptions,
    enabled: open && Boolean(promptType),
    retry: false,
  });
  const original = q.data?.prompt ?? "";
  const editing = draft !== null;
  const changed = editing && draft !== original;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setDraft(null);
    setConfirm(null);
    setError(null);
  };

  const run = async (action: "upgrade" | "fork") => {
    if (draft === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await editWorkflowPrompt(dynasty, action, draft);
      await queryClient.invalidateQueries({ queryKey: ["workflows", featureSlug] });
      setConfirm(null);
      setDraft(null);
      setOpen(false);
      if (res.action === "forked") onForked(res.workflow.workflowDynastySlug);
      else setNotice(`Upgraded to version ${res.workflow.version}. It now writes with ${res.promptTemplate.type}.`);
    } catch (err) {
      console.error("[dashboard] prompt edit failed", err);
      const producer = err instanceof ApiError && typeof err.body?.error === "string" ? (err.body.error as string) : null;
      setConfirm(null);
      setError(
        err instanceof ApiError && err.status === 403
          ? "Only staff can edit a prompt."
          : (producer ?? "We could not save this edit. Nothing was changed."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">Prompt</h3>
          <p className="mt-1 truncate font-mono text-xs text-gray-700">{promptType ?? "This workflow names no prompt template."}</p>
        </div>
        {promptType && (
          <button type="button" onClick={() => setOpen(true)} className="k-btn h-8 shrink-0 px-3 text-[13px]">
            See the prompt
          </button>
        )}
      </div>
      {notice && <p className="mt-3 text-xs text-green-700">{notice}</p>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-4 md:p-8" onClick={close}>
          <div
            role="dialog"
            aria-label="Prompt"
            className="flex w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
              <p className="min-w-0 truncate font-mono text-sm text-gray-900">{promptType}</p>
              <div className="flex shrink-0 items-center gap-2">
                {isStaff && !editing && q.data && (
                  <button type="button" onClick={() => setDraft(original)} className="k-btn h-8 gap-1.5 px-3 text-[13px]">
                    Edit <MaturityBadge level="staff" />
                  </button>
                )}
                <button type="button" onClick={close} className="text-sm text-gray-500 hover:text-gray-900">
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-5">
              {q.isPending && !q.isError ? (
                <Shimmer className="h-full w-full" />
              ) : q.isError ? (
                <p className="text-sm text-gray-500">We could not read this prompt just now.</p>
              ) : (
                <textarea
                  readOnly={!editing}
                  value={editing ? draft : original}
                  onChange={(e) => setDraft(e.target.value)}
                  className={`h-full w-full resize-none rounded-lg border p-4 font-mono text-[13px] leading-relaxed text-gray-800 ${
                    editing ? "border-brand-300 bg-white" : "border-gray-200 bg-gray-50"
                  }`}
                />
              )}
            </div>
            {editing && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
                {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
                <button type="button" disabled={busy} onClick={() => { setDraft(null); setError(null); }} className="k-btn h-8 px-3 text-[13px]">
                  Cancel
                </button>
                <button type="button" disabled={!changed || busy} onClick={() => setConfirm("fork")} className="k-btn h-8 px-3 text-[13px] disabled:opacity-40">
                  Fork
                </button>
                <button type="button" disabled={!changed || busy} onClick={() => setConfirm("upgrade")} className="k-btn-accent h-8 px-3 text-[13px] disabled:opacity-40">
                  Upgrade
                </button>
              </div>
            )}
          </div>
          {confirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={(e) => { e.stopPropagation(); if (!busy) setConfirm(null); }}>
              <div role="alertdialog" aria-label="Confirm" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <p className="text-base font-medium text-gray-900">
                  {confirm === "upgrade" ? `Upgrade ${workflowName}?` : `Fork ${workflowName}?`}
                </p>
                <p className="mt-2 text-sm text-gray-600">{confirm === "upgrade" ? UPGRADE_WARNING : FORK_WARNING}</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" disabled={busy} onClick={() => setConfirm(null)} className="k-btn h-8 px-3 text-[13px]">
                    Cancel
                  </button>
                  <button type="button" disabled={busy} onClick={() => run(confirm)} className={`k-btn-accent h-8 px-3 text-[13px] ${busy ? "cursor-wait" : ""}`}>
                    {busy ? (confirm === "upgrade" ? "Upgrading..." : "Forking...") : confirm === "upgrade" ? "Upgrade" : "Fork"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Past runs ──────────────────────────────────────────────────────────────

/**
 * Every run this workflow made for the brand, newest first. runs-service files a run
 * under the VERSIONED slug, so the dynasty's history is read per version (the most
 * recent few) and merged by start time — a union of disjoint sets, not a computed figure.
 */
function RunsCard({
  orgId,
  brandId,
  dynasty,
  versions,
}: {
  orgId: string;
  brandId: string;
  dynasty: string;
  versions: string[];
}) {
  const [openRun, setOpenRun] = useState<RunRow | null>(null);
  const read = versions.slice(0, RUN_VERSIONS);
  const q = useAuthQuery(
    ["workflowRuns", brandId, dynasty, read.join(",")],
    async () => {
      const lists = await Promise.all(
        read.map((v) =>
          listBrandRunLedger(brandId, { workflowSlug: v, taskName: "execute-workflow", limit: RUNS_PER_VERSION }),
        ),
      );
      return lists
        .flat()
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
        .slice(0, RUNS_SHOWN);
    },
    { ...pollOptions, enabled: read.length > 0 },
  );
  const { missionByCampaignId } = useMissions(orgId, brandId);
  const runs = q.data ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">Past runs</h3>
      <p className="mt-1 text-xs text-gray-500">The most recent runs for this brand. Open one to read the emails it wrote.</p>
      <div className="mt-3 space-y-2">
        {q.isPending && !q.isError && read.length > 0 ? (
          <Shimmer className="h-40 w-full" />
        ) : q.isError ? (
          <p className="text-sm text-gray-500">We could not read its runs just now.</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-gray-500">It has not run for this brand yet.</p>
        ) : (
          runs.map((run) => {
            const m = run.campaignId ? missionByCampaignId.get(run.campaignId) ?? null : null;
            const version = run.workflowSlug?.match(/-v(\d+)$/)?.[1] ?? null;
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => setOpenRun(run)}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left hover:bg-gray-50"
              >
                <StateDot running={run.status === "running"} label="" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900">
                    {m ? `${m.crew.name} · ${m.offerName ?? "Offer"}` : "A mission we could not name"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {friendlyDateTime(run.startedAt)}
                    {version && ` · version ${version}`}
                    {run.completedAt && ` · took ${durationLabel(run.startedAt, run.completedAt)}`}
                  </p>
                </div>
                <RunStatus status={run.status} />
              </button>
            );
          })
        )}
      </div>
      {openRun && <RunDrawer brandId={brandId} run={openRun} onClose={() => setOpenRun(null)} />}
    </div>
  );
}

function durationLabel(start: string, end: string): string {
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function RunStatus({ status }: { status: string }) {
  const tone =
    status === "completed"
      ? "border-green-200 bg-green-50 text-green-700"
      : status === "failed"
        ? "border-red-200 bg-red-50 text-red-600"
        : "border-gray-200 bg-gray-50 text-gray-600";
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>{status}</span>;
}

/** The emails ONE run wrote, in a full-height drawer pinned to the viewport. */
function RunDrawer({ brandId, run, onClose }: { brandId: string; run: RunRow; onClose: () => void }) {
  const q = useAuthQuery(["runEmails", brandId, run.id], () => listRunEmails(brandId, run.id), pollOptions);
  const emails = q.data ?? [];
  return (
    <>
      <div aria-hidden className="fixed inset-0 z-30 bg-black/10" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 w-full overflow-y-auto border-gray-200 bg-gray-50 pb-24 md:w-[36rem] md:max-w-[94vw] md:border-l md:shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white p-4">
          <div className="min-w-0">
            <p className="font-semibold text-gray-800">Run of {friendlyDateTime(run.startedAt)}</p>
            <p className="text-xs text-gray-500">{run.workflowSlug}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900">
            Close
          </button>
        </div>
        <div className="space-y-4 p-4 md:p-6">
          {q.isPending && !q.isError ? (
            <Shimmer className="h-64 w-full" />
          ) : q.isError ? (
            <p className="text-sm text-gray-500">We could not read this run&apos;s emails just now.</p>
          ) : emails.length === 0 ? (
            <p className="text-sm text-gray-500">This run wrote no email.</p>
          ) : (
            emails.map((e) => <EmailCard key={e.id} email={e} />)
          )}
        </div>
      </div>
    </>
  );
}

function EmailCard({ email }: { email: Email }) {
  const who = [email.leadFirstName, email.leadLastName].filter(Boolean).join(" ");
  const about = [email.leadTitle, email.leadCompany].filter(Boolean).join(" at ");
  const steps = email.sequence ?? [];
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">{who || "A lead we could not name"}</p>
      {about && <p className="text-xs text-gray-500">{about}</p>}
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-500">Subject</p>
      <p className="text-sm text-gray-900">{email.subject || "—"}</p>
      {steps.length > 0 ? (
        steps.map((s) => (
          <div key={s.step} className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {s.step === 1 ? "Initial email" : `Follow-up ${s.step - 1}`}
              {s.step > 1 && ` · ${s.daysSinceLastStep} days later`}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{s.bodyText}</p>
          </div>
        ))
      ) : (
        <p className="mt-3 whitespace-pre-line text-sm text-gray-800">{email.bodyText ?? ""}</p>
      )}
    </div>
  );
}
