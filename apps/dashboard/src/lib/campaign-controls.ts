// Is this running, and how hard — for one campaign, one offer, or a whole brand.
//
// A campaign IS (offer x sales funnel x acquisition channel), and it carries TWO
// independent answers to that question:
//
//   - a STATUS, which campaign-service stores on the campaign row and flips
//     through `PATCH /campaigns/:id` with `activate` / `stop`;
//   - a daily CEILING, which billing keys on the triple and which
//     `saveBrandFunnelBudget` writes.
//
// They are deliberately NOT one field. Stopping a campaign by dropping its
// ceiling to zero would throw away the amount, and billing's floor only lets a
// funnel funded under its minimum be KEPT or RAISED — so a campaign
// grandfathered under the floor could be stopped that way and never restarted at
// the same figure. A status flag costs nothing to reverse, which is what makes
// "pause and resume" an ordinary action rather than a decision.
//
// This module holds the ROW MODEL the controls modal edits and the pure
// derivations around it. Every grain edits the same rows — a campaign — because
// that is the only thing either write can address: the brand and the offer are
// scopes, not things billing or campaign-service fund. Nothing here sums a
// brand-wide ceiling; billing serves that figure and the brand Overview reads it.
//
// Only relative value imports live here, so this module stays directly
// unit-testable (vitest does not resolve the "@" alias).

import { acquisitionChannelForFeatureSlug } from "./acquisition-channels";
import {
  campaignBudgetScope,
  campaignSavedCents,
  type BrandFunnelBudgetSet,
  type CampaignBudgetRow,
  type CampaignBudgetScope,
} from "./campaign-budget";

/**
 * The fields this module reads off a campaign-service campaign.
 *
 * It extends `CampaignBudgetRow` rather than restating its two fields, so the
 * funnel spelling stays whatever `lib/campaign-budget.ts` accepts — a second
 * declaration would drift the moment the wire vocabulary moves again.
 */
export interface ControlCampaign extends CampaignBudgetRow {
  id: string;
  status: string;
  offerId: string | null;
  /**
   * When campaign-service created this row. Read only to pick which row of a
   * campaign a RESTART targets when none of them is running: the most recent one
   * is the campaign as it last ran, and its ancestors are history.
   */
  createdAt: string;
}

/**
 * A campaign is RUNNING when campaign-service reports one of these words.
 *
 * The same set the Campaigns table's pill reads, restated here rather than
 * imported because that module is a React component: `campaigns-table.tsx` is
 * `"use client"` and pulls the `@` alias, which would make this file
 * unimportable in vitest. The set is three words and a guard pins the two copies
 * equal.
 */
const ACTIVE_STATUSES = new Set(["active", "running", "ongoing", "live"]);

export function isRunningStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status.toLowerCase());
}

/**
 * One campaign, as the controls modal shows and edits it.
 *
 * A row is one campaign as a CUSTOMER knows it — (funnel x channel x offer) —
 * not one campaign-service row. campaign-service mints a fresh row every time a
 * campaign's workflow changes and keeps only the newest `ongoing`, so a campaign
 * that has been running for months is stored as dozens of rows: one live and the
 * rest its own history. That triple is also exactly what billing keys a ceiling
 * on, so it is the only grouping under which a row has one ceiling and one
 * answer to "is this running".
 */
export interface ControlRow {
  /**
   * This campaign's identity, and the key for its draft, its failure and its
   * React node. Not a campaign-service id: several of those share one row.
   */
  rowId: string;
  /**
   * The campaign-service row a RESTART targets — the live one when there is one,
   * else the most recent, which is the campaign as it last ran.
   */
  campaignId: string;
  /**
   * Every row of this campaign campaign-service reports as running. Pausing
   * stops each of them: migration 0044 keeps at most one, and stopping the one
   * we happened to pick would silently leave a second live if that ever changed.
   */
  runningCampaignIds: string[];
  /** Is it running right now, per campaign-service's own word. */
  running: boolean;
  /**
   * The (funnel, channel) its money is keyed on, or null for a campaign that
   * predates the funnels. Such a row can still be stopped and restarted — the
   * status is its own — but has no ceiling to point at, and guessing one would
   * offer to spend money against a row billing would refuse.
   */
  scope: CampaignBudgetScope | null;
  /** What billing stores for THIS campaign, in cents. Zero = funded at nothing. */
  savedCents: number;
  /** The offer this campaign sells, which is what narrows its ceiling. */
  offerId: string | null;
}

/**
 * Which campaigns a grain may control, in a stable order.
 *
 * The rows are the same at every grain and only the FILTER differs, because a
 * campaign is the only thing either write can address. Four rules, each
 * load-bearing:
 *
 *   - STOPPED campaigns are included. The modal is where a customer restarts
 *     one, so a live-only list would make stopping irreversible from the UI.
 *   - Only ACQUISITION-CHANNEL campaigns. A brand's PR or AI-visibility campaign
 *     runs no sales funnel, so it has no ceiling and belongs to no offer; listing
 *     it would offer a budget field that can never be written.
 *   - The offer filter reads the campaign's OWN `offerId`. A campaign carrying
 *     none belongs to no offer and is left out rather than folded into whichever
 *     one the reader happens to be looking at.
 *   - Rows are GROUPED by (funnel, channel, offer) — one line per campaign as a
 *     customer knows it, not one per stored row. campaign-service mints a fresh
 *     row on every workflow change, so one campaign is stored as many; a list
 *     per row shows the same campaign dozens of times, each offering to edit the
 *     ONE billing ceiling they all share, and a total that adds that ceiling up
 *     once per row. Measured in prod: one offer held 46 rows of a single
 *     campaign and read $2,310/day against a real $50.
 *
 * A campaign that predates the funnels names no triple, so it groups by its own
 * id: it has no ceiling to share and nothing to double count.
 *
 * Order is running-first then by identity, so the rows do not reshuffle under
 * the cursor as toggles are flipped — the sort key is the SAVED status, never
 * the draft.
 */
export function buildControlRows(
  campaigns: ControlCampaign[],
  budgets: BrandFunnelBudgetSet | undefined,
  filter: { offerId?: string; campaignId?: string } = {},
): ControlRow[] {
  const scoped = campaigns.filter((c) => {
    if (filter.campaignId) return c.id === filter.campaignId;
    if (acquisitionChannelForFeatureSlug(c.featureSlug) === null) return false;
    if (filter.offerId) return c.offerId === filter.offerId;
    return true;
  });

  const groups = new Map<string, ControlCampaign[]>();
  for (const c of scoped) {
    const scope = campaignBudgetScope(c);
    const rowId = scope
      ? `${scope.def.key}|${scope.featureSlug}|${c.offerId ?? ""}`
      : `campaign:${c.id}`;
    const bucket = groups.get(rowId);
    if (bucket) bucket.push(c);
    else groups.set(rowId, [c]);
  }

  return [...groups.entries()]
    .map(([rowId, members]) => {
      const runningCampaignIds = members.filter((c) => isRunningStatus(c.status)).map((c) => c.id);
      const representative = pickRepresentative(members, runningCampaignIds);
      const scope = campaignBudgetScope(representative);
      return {
        rowId,
        campaignId: representative.id,
        runningCampaignIds,
        running: runningCampaignIds.length > 0,
        scope,
        savedCents: scope
          ? campaignSavedCents(scope, representative.offerId ?? undefined, budgets)
          : 0,
        offerId: representative.offerId,
      };
    })
    .sort((a, b) => {
      if (a.running !== b.running) return a.running ? -1 : 1;
      return a.rowId.localeCompare(b.rowId);
    });
}

/**
 * The stored row a restart addresses: the live one, else the most recent.
 *
 * campaign-service keeps at most one `ongoing` per identity, so the live branch
 * picks the only one there is. With none live, the newest row is the campaign as
 * it last ran and its ancestors are history — restarting one of those would
 * resume a workflow the customer replaced. Ties break on the id so the pick is
 * deterministic and a retry addresses the same row.
 */
function pickRepresentative(
  members: ControlCampaign[],
  runningCampaignIds: string[],
): ControlCampaign {
  if (runningCampaignIds.length > 0) {
    return members.find((c) => c.id === runningCampaignIds[0])!;
  }
  return [...members].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * What a scope is doing, as ONE word.
 *
 * A scope is RUNNING when at least one campaign in it is: the customer asked us
 * to reach people and we are reaching them. There is deliberately no third word
 * for a scope where some run and others do not — "partially paused" was one, and
 * it read as a fault on a brand doing exactly what it meant to (one funnel live,
 * an older one deliberately stopped). Which campaigns are running is what the
 * rows themselves say, one toggle each; the pill answers the coarser question
 * the reader asked by glancing at it.
 *
 * `none` stays its own answer: "there is nothing here" is not "everything is
 * stopped".
 */
export type ControlRollup = "none" | "paused" | "active";

export function rollupStatus(rows: ControlRow[]): ControlRollup {
  if (rows.length === 0) return "none";
  return rows.some((r) => r.running) ? "active" : "paused";
}

export const ROLLUP_LABEL: Record<ControlRollup, string> = {
  none: "No campaign",
  paused: "Paused",
  active: "Active",
};

/**
 * Each verdict's tint, from the closed set `html.dark` remaps. A colour outside
 * that set paints a bright block on the dark surface and is invisible in the
 * light default, so it looks correct until someone toggles the theme.
 */
export const ROLLUP_STYLE: Record<ControlRollup, string> = {
  none: "bg-gray-100 text-gray-600 border-gray-200",
  paused: "bg-gray-100 text-gray-500 border-gray-200",
  active: "bg-green-50 text-green-700 border-green-200",
};

/**
 * What this SCOPE funds per day, in cents, across the campaigns it controls.
 *
 * Adds up the rows' OWN ceilings — the ones `campaignSavedCents` already
 * narrowed to each campaign's offer — which is the same shape as the funnels
 * card's per-offer total and for the same reason: billing's per-pair figure
 * spans every offer selling that pair, so it names money a reader on one offer
 * cannot see.
 *
 * It is correct ONLY because a row is a campaign IDENTITY rather than a stored
 * campaign row: billing keys one ceiling per (funnel, channel, offer), so a list
 * per stored row would add the same ceiling up once per row. That is exactly
 * what it did — 46 rows of one campaign read $2,310/day against a real $50.
 *
 * This is NOT how the BRAND's total is obtained. billing serves that figure
 * (`GET /brands/:id/daily-budget`) and the brand Overview reads it; recomposing
 * it here is how two surfaces come to state one number two ways.
 */
export function scopeTotalCents(rows: ControlRow[]): number {
  return rows.reduce((sum, r) => sum + (r.savedCents > 0 ? r.savedCents : 0), 0);
}

/** A budget field holds whole dollars, or nothing. Blank is zero — the stop. */
export function parseDailyBudgetUsd(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** What the form holds for one row while it is being edited. */
export interface ControlDraft {
  running: boolean;
  /** Whole dollars as typed. Empty string is a real value and means zero. */
  budget: string;
}

/**
 * One write the Confirm will make.
 *
 * Both carry `rowId` as well as what they address, because a failure is reported
 * against the ROW the customer edited — and a pause fans out over every stored
 * row of one campaign that is running, so several writes can belong to one line.
 */
export interface StatusWrite {
  rowId: string;
  campaignId: string;
  activate: boolean;
}

export interface BudgetWrite {
  rowId: string;
  funnelKey: string;
  featureSlug: string;
  offerId: string | null;
  cents: number;
}

export interface ControlsDiff {
  statusWrites: StatusWrite[];
  budgetWrites: BudgetWrite[];
  /** A row whose typed budget is not a whole number of dollars, by `rowId`. */
  invalidRows: string[];
}

/**
 * Only what CHANGED, so a Confirm never re-states a value it was not asked to
 * touch — the same discipline as the funnels card's partial patch. The two write
 * kinds are computed independently: flipping a toggle must not restate an
 * amount, and editing an amount must not restate a status.
 *
 * A row with no scope produces no budget write whatever is typed; the modal
 * disables its field, and writing one would address a row billing would refuse.
 */
export function controlsDiff(
  rows: ControlRow[],
  drafts: Record<string, ControlDraft>,
): ControlsDiff {
  const statusWrites: StatusWrite[] = [];
  const budgetWrites: BudgetWrite[] = [];
  const invalidRows: string[] = [];

  for (const row of rows) {
    const draft = drafts[row.rowId];
    if (!draft) continue;

    if (draft.running !== row.running) {
      if (draft.running) {
        // One write: the row a restart addresses is the campaign as it last ran.
        statusWrites.push({ rowId: row.rowId, campaignId: row.campaignId, activate: true });
      } else {
        // Every running row of this campaign, so a pause cannot leave one live.
        for (const campaignId of row.runningCampaignIds) {
          statusWrites.push({ rowId: row.rowId, campaignId, activate: false });
        }
      }
    }

    if (!row.scope) continue;
    const typed = parseDailyBudgetUsd(draft.budget);
    if (typed === null) {
      invalidRows.push(row.rowId);
      continue;
    }
    const cents = typed * 100;
    if (cents !== row.savedCents) {
      budgetWrites.push({
        rowId: row.rowId,
        funnelKey: row.scope.def.key,
        featureSlug: row.scope.featureSlug,
        offerId: row.offerId,
        cents,
      });
    }
  }

  return { statusWrites, budgetWrites, invalidRows };
}

/**
 * What each FUNNEL would be funded at once this form lands, in whole dollars.
 *
 * The product minimum binds the funnel, not one campaign — a customer splitting
 * one funded funnel across two offers or two channels must not be refused for
 * each half being under a bar the whole clears. This modal can edit SEVERAL rows
 * of one funnel at once, so projecting them one at a time would check each
 * against a total the form is simultaneously changing.
 *
 * Siblings the modal does not show (another offer's campaign on the same funnel)
 * are what billing's funnel figure carries beyond the rows here, so they are
 * held constant.
 *
 * Computed ONLY to check the form before it is written. billing holds the same
 * rule and its 400 is what decides; nothing displayed is derived from this.
 */
export function projectedFunnelTotalsUsd(
  rows: ControlRow[],
  drafts: Record<string, ControlDraft>,
  savedFunnelCents: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.scope) continue;
    const key = row.scope.def.key;
    if (!seen.has(key)) {
      seen.add(key);
      const inModal = rows
        .filter((r) => r.scope?.def.key === key)
        .reduce((sum, r) => sum + (r.savedCents > 0 ? r.savedCents : 0), 0);
      const siblings = Math.max(0, (savedFunnelCents[key] ?? 0) - inModal);
      out[key] = Math.round(siblings / 100);
    }
    const typed = parseDailyBudgetUsd(drafts[row.rowId]?.budget ?? "");
    out[key] += typed !== null && typed > 0 ? typed : 0;
  }
  return out;
}

/** Is there anything to write? */
export function hasChanges(diff: ControlsDiff): boolean {
  return diff.statusWrites.length > 0 || diff.budgetWrites.length > 0;
}

/**
 * What Confirm is about to do, in a sentence, above the button that does it.
 *
 * Money and a campaign's life are what this modal changes, so what changed is
 * stated before it is committed rather than reported after. `null` when nothing
 * changed — there is no sentence to write, and the button is not offered.
 */
export function diffSummary(rows: ControlRow[], diff: ControlsDiff): string | null {
  if (!hasChanges(diff)) return null;

  const parts: string[] = [];
  // Counted by ROW, never by write: a pause fans out over every stored row of one
  // campaign, and the sentence names campaigns as the customer knows them.
  const activating = new Set(
    diff.statusWrites.filter((w) => w.activate).map((w) => w.rowId),
  ).size;
  const stopping = new Set(
    diff.statusWrites.filter((w) => !w.activate).map((w) => w.rowId),
  ).size;
  if (activating > 0) parts.push(`${activating} ${plural(activating)} restarting`);
  if (stopping > 0) parts.push(`${stopping} ${plural(stopping)} pausing`);

  if (diff.budgetWrites.length > 0) {
    const before = scopeTotalCents(rows);
    const after = nextTotalCents(rows, diff);
    parts.push(`daily budget ${fmtWhole(before)} to ${fmtWhole(after)}`);
  }

  return `${parts.join(", ")}.`;
}

function plural(n: number): string {
  return n === 1 ? "campaign" : "campaigns";
}

function fmtWhole(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/** What the rows would sum to once this diff lands. Used only by the summary. */
export function nextTotalCents(rows: ControlRow[], diff: ControlsDiff): number {
  const byRow = new Map(diff.budgetWrites.map((w) => [w.rowId, w.cents]));
  return rows.reduce((sum, r) => {
    const cents = byRow.get(r.rowId) ?? r.savedCents;
    return sum + (cents > 0 ? cents : 0);
  }, 0);
}

/**
 * A refusal is rendered as OUR copy, branched on the status. `apiCall` puts the
 * whole downstream response body verbatim into the thrown Error's `message`, and
 * the api-service PATCH-campaign proxy additionally flattens campaign-service's
 * body into an `error` string — so printing the message would put a JSON blob in
 * front of a customer.
 *
 * Separate from the budget card's own message because this covers a FAN-OUT over
 * two different write kinds, and a campaign refusing to restart is a different
 * sentence from a ceiling being refused.
 */
export function controlWriteErrorMessage(status: number | null, kind: "status" | "budget"): string {
  if (kind === "status") {
    if (status === 400) return "This campaign cannot be restarted right now.";
    if (status === 403) return "You do not have access to this campaign.";
    if (status === 404) return "This campaign no longer exists.";
    return "We could not change this campaign. Try again in a moment.";
  }
  if (status === 400) return "That daily budget was refused. Check the amount.";
  if (status === 403) return "You do not have access to this campaign's budget.";
  if (status === 404) return "This campaign no longer exists.";
  if (status === 409) {
    return "This funnel is sold through more than one campaign, so we could not tell which one this budget was for. Set it on Offer Settings instead.";
  }
  return "We could not save this daily budget. Try again in a moment.";
}
