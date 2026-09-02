"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  getBrandFunnelBudgets,
  listCampaignsByBrand,
  saveBrandFunnelBudget,
  setCampaignStatus,
  type BrandFunnelBudgets,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import {
  ROLLUP_LABEL,
  buildControlRows,
  controlWriteErrorMessage,
  controlsDiff,
  diffSummary,
  groupControlRowsByFunnel,
  groupHeadingState,
  hasChanges,
  projectedFunnelTotalsUsd,
  rollupStatus,
  type ControlDraft,
  type ControlRow,
  type ControlRowGroup,
  type OfferableChannel,
} from "@/lib/campaign-controls";
import { funnelBudgetBelowMinimum, funnelBudgetTip } from "@/lib/sales-funnels";
import { CampaignIdentity } from "@/components/campaigns/campaign-identity";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { Skeleton } from "@/components/skeleton";

/**
 * Is this running, and how hard — for a brand, an offer, or one campaign.
 *
 * ONE modal, three entry points. The rows are always CAMPAIGNS whatever the
 * grain, because a campaign is the only thing either write can address: the
 * brand and the offer are scopes, not things billing or campaign-service fund.
 * A grain that edited an aggregate would have to split it back across the
 * campaigns, and no split the customer did not state is honest.
 *
 * A row is a campaign as the CUSTOMER knows it — (funnel x channel x offer) —
 * never one campaign-service row. campaign-service mints a fresh row on every
 * workflow change and keeps only the newest `ongoing`, so one campaign is stored
 * as many; listing them per row showed the same campaign dozens of times, each
 * offering to edit the one billing ceiling they all share.
 *
 * Each row carries the two answers a campaign has, and they stay INDEPENDENT:
 *
 *   - a toggle, which flips campaign-service's own status. It costs nothing to
 *     reverse and leaves the ceiling untouched, so the amount survives a pause.
 *   - a daily budget, billing's (offer x funnel x channel) row.
 *
 * Collapsing the two into one field (pause = set it to zero) is what this
 * replaces: zero throws the amount away, and billing's per-funnel floor only
 * lets a funnel funded under its minimum be KEPT or RAISED — so a campaign
 * grandfathered under the floor, stopped that way, could never be restarted at
 * the figure it was running.
 *
 * ⚠️ Restarting FIRES THE WORKFLOW IMMEDIATELY rather than at the next tick, so
 * the summary above Confirm says so.
 *
 * The writes are a FAN-OUT (there is no bulk endpoint), so a failure is reported
 * per row and the modal stays open. It never claims a success it does not have.
 */
/** Stable, so the memo above does not re-run on every render of a caller that omits it. */
const EMPTY_OFFERABLE: readonly OfferableChannel[] = [];

export function CampaignControlsModal({
  brandId,
  offerId,
  funnelKey,
  campaignId,
  prefillBudgetUsd,
  offerable = EMPTY_OFFERABLE,
  onClose,
}: {
  brandId: string;
  /** Scope to one offer's campaigns. Omitted at brand grain. */
  offerId?: string;
  /**
   * Scope to ONE sales funnel of that offer. Pair it with `offerId`: billing keys
   * a ceiling on (funnel x channel x offer), so a bare funnel spans every offer
   * selling it and would list a sibling offer's campaigns under this one's name.
   */
  funnelKey?: string | null;
  /** Scope to exactly one campaign. Omitted at brand and offer grain. */
  campaignId?: string;
  /**
   * Channels the caller says a customer may fund and has not.
   *
   * Empty at every grain that lists what already runs. The funnel board supplies it
   * because a channel with no campaign is invisible to a campaign-derived list, and
   * that is exactly the channel someone opens the board to switch on.
   */
  offerable?: readonly OfferableChannel[];
  /**
   * Open with the daily budget already set to this figure, in whole dollars.
   *
   * The learning band offers a specific raise ("invest $16/day instead of $8"), so the
   * form it opens states that figure rather than the one the reader just asked to
   * change — a control that promises an amount and then hands you a blank field asks
   * the question twice. Nothing is written until Confirm, and the row stays editable,
   * so this is a starting point and not a decision made for anyone.
   *
   * Only honoured when the modal is scoped to ONE campaign: at brand or offer grain
   * there are several rows and no single one the figure belongs to.
   */
  prefillBudgetUsd?: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  // Both keys are byte-equal to the ones the Campaigns table, Offer Settings and
  // Campaign Settings already read, so opening this costs no new request.
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId));
  const budgetsQ = useAuthQuery(["brandFunnelBudgets", brandId], () =>
    getBrandFunnelBudgets(brandId),
  );

  // A figure offered for ONE campaign has no row to land on at a wider grain.
  const prefill = campaignId != null ? prefillBudgetUsd : undefined;

  const channels = useAcquisitionChannels();
  const rows = useMemo(
    () =>
      buildControlRows(
        campaignsQ.data?.campaigns ?? [],
        budgetsQ.data,
        channels,
        { offerId, funnelKey, campaignId },
        offerable,
      ),
    [campaignsQ.data, budgetsQ.data, channels, offerId, funnelKey, campaignId, offerable],
  );

  /**
   * A campaign is named for the LEG it performs, which is an ARROW of a funnel and
   * not the funnel itself — so a flat list states what each campaign buys and never
   * what funnel it buys it for. Every row therefore sits under the sales funnel it
   * sells.
   *
   * Suppressed when the modal is already scoped to one funnel: that page names the
   * funnel above the control that opened this, and saying it twice on one screen is
   * chrome rather than clarity.
   */
  const groups = useMemo(() => groupControlRowsByFunnel(rows), [rows]);
  const showFunnelHeadings = !funnelKey;

  // SEEDED from the queries and RE-SEEDED whenever either payload is a different
  // object than the one the drafts were built from — never a once-per-mount
  // latch, which would pin the form to the on-disk snapshot the local-first cache
  // paints first and ignore the fresher answer that lands a moment later. A row
  // the user has TOUCHED outranks the server, or the form would rewrite itself
  // mid-edit.
  const [drafts, setDrafts] = useState<Record<string, ControlDraft>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const seededFrom = useRef<unknown>(null);

  useEffect(() => {
    const payload = campaignsQ.data && budgetsQ.data ? [campaignsQ.data, budgetsQ.data] : null;
    if (!payload) return;
    if (
      Array.isArray(seededFrom.current) &&
      seededFrom.current[0] === payload[0] &&
      seededFrom.current[1] === payload[1]
    ) {
      return;
    }
    seededFrom.current = payload;
    setDrafts((prev) => {
      const next: Record<string, ControlDraft> = {};
      for (const row of rows) {
        next[row.rowId] = touched.has(row.rowId)
          ? (prev[row.rowId] ?? draftFor(row, prefill))
          : draftFor(row, prefill);
      }
      return next;
    });
  }, [campaignsQ.data, budgetsQ.data, rows, touched, prefill]);

  const [failures, setFailures] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const savedFunnelCents = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of budgetsQ.data?.funnels ?? []) out[f.funnelKey] = f.dailyBudgetCents;
    return out;
  }, [budgetsQ.data]);

  const projected = useMemo(
    () => projectedFunnelTotalsUsd(rows, drafts, savedFunnelCents),
    [rows, drafts, savedFunnelCents],
  );

  const diff = useMemo(() => controlsDiff(rows, drafts), [rows, drafts]);
  const summary = diffSummary(rows, diff);
  const restarting = diff.statusWrites.some((w) => w.activate);

  // A row whose funnel would land under its floor blocks Confirm. billing holds
  // the same rule and its 400 is what decides; this is here to make typing
  // pleasant, not to be the source of truth.
  const belowFloor = useMemo(
    () =>
      rows
        .filter((row) => {
          if (!row.scope) return false;
          const key = row.scope.def.key;
          return funnelBudgetBelowMinimum(key, projected[key] ?? 0, savedFunnelCents[key] ?? 0);
        })
        .map((r) => r.rowId),
    [rows, projected, savedFunnelCents],
  );

  const blocked = diff.invalidRows.length > 0 || belowFloor.length > 0;
  const settled =
    (campaignsQ.data !== undefined || campaignsQ.isError) &&
    (budgetsQ.data !== undefined || budgetsQ.isError);

  function edit(rowId: string, patch: Partial<ControlDraft>) {
    setTouched((prev) => new Set(prev).add(rowId));
    setDrafts((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? { running: false, budget: "" }), ...patch },
    }));
  }

  /** The bulk row: one decision for every campaign on screen. */
  function setAllRunning(running: boolean) {
    setTouched(new Set(rows.map((r) => r.rowId)));
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        next[row.rowId] = { ...(next[row.rowId] ?? draftFor(row)), running };
      }
      return next;
    });
  }

  /**
   * One decision for every campaign of ONE funnel.
   *
   * The heading's switch is the rollup of the rows under it, so flipping it sets
   * them all rather than storing a state of its own — there is nothing at funnel
   * grain to store. With a single campaign under the funnel the two switches are
   * the same switch, which is why either one moves the other.
   */
  function setGroupRunning(rowIds: string[], running: boolean) {
    setTouched((prev) => {
      const next = new Set(prev);
      for (const id of rowIds) next.add(id);
      return next;
    });
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!rowIds.includes(row.rowId)) continue;
        next[row.rowId] = { ...(next[row.rowId] ?? draftFor(row)), running };
      }
      return next;
    });
  }

  async function confirm() {
    setSaving(true);
    setFailures({});
    const nextFailures: Record<string, string> = {};
    let latestBudgets: BrandFunnelBudgets | null = null;

    // Sequential rather than parallel: the budget writes all address the same
    // brand row set and billing answers with the WHOLE set each time, so racing
    // them would leave whichever landed last in the cache regardless of order.
    for (const write of diff.statusWrites) {
      const row = rows.find((r) => r.rowId === write.rowId);
      const featureSlug = row?.scope?.featureSlug;
      if (!featureSlug) {
        // campaign-service validates the workflow's tracking headers before it
        // flips the row, so an activate with no channel to name would 400. Say so
        // rather than sending a request we know is refused.
        nextFailures[write.rowId] = controlWriteErrorMessage(400, "status");
        continue;
      }
      try {
        await setCampaignStatus(write.campaignId, write.activate ? "activate" : "stop", {
          brandId,
          featureSlug,
        });
      } catch (err) {
        console.error("[dashboard] setCampaignStatus failed", err);
        nextFailures[write.rowId] = controlWriteErrorMessage(
          err instanceof ApiError ? err.status : null,
          "status",
        );
      }
    }

    for (const write of diff.budgetWrites) {
      try {
        latestBudgets = await saveBrandFunnelBudget(
          brandId,
          write.funnelKey,
          write.cents,
          write.featureSlug,
          write.offerId ?? undefined,
        );
      } catch (err) {
        console.error("[dashboard] saveBrandFunnelBudget failed", err);
        nextFailures[write.rowId] = controlWriteErrorMessage(
          err instanceof ApiError ? err.status : null,
          "budget",
        );
      }
    }

    // Write what billing answered into the cache the page reads, THEN invalidate
    // the lists — a bare invalidate would leave a failed refetch showing the
    // pre-save figures.
    if (latestBudgets) {
      queryClient.setQueryData(["brandFunnelBudgets", brandId], latestBudgets);
    }
    // Every figure that states what a campaign may spend, or whether it runs at all —
    // `brandSpendableBudget` above all, which is the join of billing's ceilings to
    // campaign-service's statuses and is what the header money reads.
    invalidateCampaignMoney(queryClient);

    setSaving(false);
    setTouched(new Set());
    seededFrom.current = null;

    if (Object.keys(nextFailures).length > 0) {
      // Something did not land, so the modal stays open saying which row.
      setFailures(nextFailures);
      return;
    }
    onClose();
  }

  /** One campaign's line, the same at every grain and under every funnel heading. */
  function renderRow(row: ControlRow) {
    const draft = drafts[row.rowId] ?? draftFor(row);
    const key = row.scope?.def.key;
    const floorHit = belowFloor.includes(row.rowId);
    const invalid = diff.invalidRows.includes(row.rowId);
    return (
      <li key={row.rowId} className="py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* The SAME identity the Campaigns table's first column states, from the
              same component: this modal changes a campaign's money, so it must name
              the campaign the way the row you clicked to get here named it. */}
          <div className="min-w-0 text-sm text-gray-800">
            <CampaignIdentity
              funnel={row.scope?.def ?? null}
              featureSlug={row.scope?.featureSlug ?? null}
              legKey={row.legKey}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={draft.running}
              aria-label={
                row.campaignId === null
                  ? draft.running
                    ? "Stop funding this channel"
                    : "Fund this channel"
                  : draft.running
                    ? "Pause this campaign"
                    : "Restart this campaign"
              }
              onClick={() => edit(row.rowId, { running: !draft.running })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                draft.running ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                  draft.running ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <span className="text-gray-400">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={draft.budget}
                disabled={!row.scope}
                onChange={(e) => edit(row.rowId, { budget: e.target.value })}
                aria-label="Daily budget in dollars"
                className="w-20 rounded-md border border-gray-200 px-2 py-1 text-right tabular-nums focus:ring-2 focus:ring-brand-300 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              <span className="text-xs text-gray-400">/ day</span>
            </div>
          </div>
        </div>
        {!row.scope && (
          <p className="mt-1.5 text-xs text-gray-500">
            This campaign predates the sales funnels, so it has no budget of its own. It
            can still be paused and restarted.
          </p>
        )}
        {row.campaignId === null && !draft.running && (
          <p className="mt-1.5 text-xs text-gray-500">
            Nothing runs on this channel yet. Funding it is what starts it, and the
            campaign appears within a few minutes.
          </p>
        )}
        {invalid && (
          <p className="mt-1.5 text-xs text-red-600">
            Enter a whole number of dollars, or leave it empty to stop funding it.
          </p>
        )}
        {floorHit && key && (
          <p className="mt-1.5 text-xs text-red-600">
            {funnelBudgetTip(key, savedFunnelCents[key] ?? 0)}
          </p>
        )}
        {failures[row.rowId] && (
          <p className="mt-1.5 text-xs text-red-600">{failures[row.rowId]}</p>
        )}
      </li>
    );
  }

  const rollup = rollupStatus(rows);
  const scopeWord = campaignId ? "campaign" : funnelKey ? "funnel" : offerId ? "offer" : "brand";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-controls-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border border-gray-200 bg-white shadow-xl sm:max-w-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 id="campaign-controls-title" className="text-sm font-semibold text-gray-800">
            {campaignId ? "Campaign" : `Campaigns of this ${scopeWord}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!settled ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No campaign to control here yet.
            </p>
          ) : (
            <>
              {rows.length > 1 && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {ROLLUP_LABEL[rollup]}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAllRunning(true)}
                      className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Restart all
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllRunning(false)}
                      className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Pause all
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.funnel?.key ?? "no-funnel"}
                    className={
                      showFunnelHeadings
                        ? "overflow-hidden rounded-lg border border-gray-200"
                        : undefined
                    }
                  >
                    {showFunnelHeadings && (
                      /* The parent this campaign belongs to, stating what its rows add
                         up to. A background tint and a full-perimeter 1px border, never
                         a side accent. */
                      <FunnelHeading
                        group={group}
                        drafts={drafts}
                        onRunningChange={(running) =>
                          setGroupRunning(
                            group.rows.map((r) => r.rowId),
                            running,
                          )
                        }
                      />
                    )}
                    <ul
                      className={`divide-y divide-gray-100 ${showFunnelHeadings ? "px-3" : ""}`}
                    >
                      {group.rows.map((row) => renderRow(row))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3">
          {summary && (
            <p className="mb-2 text-xs text-gray-600">
              {summary}
              {restarting && " Restarting sends right away, not at the next daily tick."}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={saving || blocked || !hasChanges(diff)}
              className={`rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white ${
                saving
                  ? "cursor-wait"
                  : "disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-700"
              }`}
            >
              {saving ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The funnel a group of campaigns sells, with the two things that group ADDS UP to.
 *
 * Neither figure is written here. The daily budget is READ-ONLY on purpose: billing
 * keys a ceiling on (funnel x channel x offer), so the only thing a customer can
 * fund is a campaign, and a funnel-level field would have to split its figure back
 * across them. It tracks the fields below it as they are typed, so the parent moves
 * the moment a child does.
 *
 * The switch DOES write, because pausing is a status and every campaign carries its
 * own — flipping the heading sets each of them. It reads OFF only once every campaign
 * under it is off, which is the same rule the scope pill states, so a funnel with one
 * live campaign never reads as stopped.
 */
function FunnelHeading({
  group,
  drafts,
  onRunningChange,
}: {
  group: ControlRowGroup;
  drafts: Record<string, ControlDraft>;
  onRunningChange: (running: boolean) => void;
}) {
  const { running, budgetUsd } = groupHeadingState(group.rows, drafts);
  const name = group.funnel?.name ?? "No sales funnel";
  const fundable = group.rows.some((r) => r.scope);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {group.funnel && <SalesFunnelMark def={group.funnel} size="xs" />}
        <span className="truncate text-xs font-medium text-gray-600">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={running}
          aria-label={running ? `Pause every campaign of ${name}` : `Restart every campaign of ${name}`}
          onClick={() => onRunningChange(!running)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition ${
            running ? "bg-green-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
              running ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>
        {/* Whole dollars, like every daily budget in the app, and never an input. */}
        <span className="text-xs tabular-nums text-gray-500">
          {fundable ? `$${budgetUsd.toLocaleString("en-US")} / day` : "\u2014"}
        </span>
      </div>
    </div>
  );
}

/** What a row looks like before anyone has touched it: exactly what is stored. */
function draftFor(row: ControlRow, prefillBudgetUsd?: number): ControlDraft {
  return {
    running: row.running,
    // Whole dollars, always — a ceiling is a configured whole-dollar value, and
    // cents read wrong on one. Zero renders empty, which is the same thing the
    // parser reads back as zero.
    budget:
      prefillBudgetUsd != null && prefillBudgetUsd > 0
        ? String(Math.round(prefillBudgetUsd))
        : row.savedCents > 0
          ? String(Math.round(row.savedCents / 100))
          : "",
  };
}
