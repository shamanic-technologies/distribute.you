"use client";

import { PAYMENT_HOLD_LABEL, PAYMENT_HOLD_STYLE } from "@/lib/payment-declined";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { ROLLUP_LABEL, ROLLUP_STYLE, scopeTotalCents } from "@/lib/campaign-controls";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { useDailyBudgetHidden } from "@/lib/use-daily-budget-hidden";
import { useScopeToggle } from "@/lib/use-scope-toggle";
import { Skeleton } from "@/components/skeleton";

/**
 * Is this running, and how hard — stated at whatever grain the page is on, and
 * the ONE press that pauses or activates it (owner 2026-10-03: no modal, no
 * per-campaign toggles, "simplement activer ou mettre en pause").
 *
 * The whole control IS the pill plus its action word, always painted: a
 * hover-revealed control is a dead affordance on a phone. It is a `role="button"`
 * span rather than a native button element, because it renders inside clickable
 * regions and a nested button is invalid HTML: the parser closes the outer one
 * early and the surrounding card breaks.
 *
 * The MONEY is what this scope may spend TODAY — `scopeTotalCents` over the rows,
 * i.e. the ceilings of the campaigns that are RUNNING — at brand grain and offer
 * grain alike.
 *
 * Brand grain used to pass billing's own served total (`GET
 * /brands/:id/daily-budget`) instead, and that figure is status-BLIND: billing
 * keys a ceiling on (offer x leg x channel) and stores no status, so a paused
 * campaign's money stayed in it — a brand running one campaign at $50 beside one
 * paused at $10 read `$60 / day`. Neither producer can answer this alone, since
 * campaign-service holds the status and no money, and the join costs nothing
 * here: both query keys are already polled on the page. `totalCentsOverride`
 * survives for the CAMPAIGN grain, which states its own configured ceiling —
 * the number Campaign Settings edits, beside a pill already saying it is paused.
 *
 * That sum is honest only because a ROW is a campaign IDENTITY (offer x leg x
 * channel) rather than a stored campaign row: billing keys one ceiling on that
 * address, campaign-service stores one campaign as many rows, and a list per row
 * added the same ceiling up once per row.
 */
export function CampaignControlsTrigger({
  brandId,
  offerId,
  legKey,
  campaignId,
  totalCentsOverride,
  dailyOnly = false,
  cap = false,
  className = "",
}: {
  brandId: string;
  /** Scope to one offer. Omitted at brand grain. */
  offerId?: string;
  /** Scope to ONE leg of that offer. */
  legKey?: string | null;
  /** Scope to one campaign. Omitted at brand and offer grain. */
  campaignId?: string;
  /**
   * One campaign's own configured ceiling, at CAMPAIGN grain only. Brand and
   * offer grain state what may be spent today instead, which is the rows' own
   * running total — no served figure can answer that, because billing stores no
   * status.
   */
  totalCentsOverride?: number | null;
  /**
   * Count only the campaigns that spend EVERY day (an entry leg). A campaign on a leg
   * that starts from a step (booking a meeting off a positive reply) spends only when
   * that step is reached, so its money is a cap, not part of what is spent daily.
   * Dashboard v2 passes it; v1 keeps the plain total.
   */
  dailyOnly?: boolean;
  /** The figure is an event crew's cap, spent only when its step is reached. */
  cap?: boolean;
  className?: string;
}) {
  const { rows, settled, rollup, hold, pending, error, toggle } = useScopeToggle(brandId, {
    offerId,
    legKey,
    campaignId,
  });
  const catalogue = useLegCatalogue();
  const budgetHidden = useDailyBudgetHidden();

  if (!settled) {
    return (
      <div className={`flex items-center justify-end gap-2.5 ${className}`}>
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>
    );
  }

  const totalCents =
    totalCentsOverride !== undefined
      ? totalCentsOverride
      : scopeTotalCents(
          dailyOnly ? rows.filter((r) => (legFor(catalogue, r.legKey)?.fromKey ?? null) === null) : rows,
        );

  const actionable = rollup !== "none";
  const action = pending ? "Saving…" : rollup === "active" ? "Pause" : "Activate";

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <div
        role="button"
        tabIndex={actionable ? 0 : -1}
        aria-disabled={!actionable || pending}
        aria-busy={pending}
        // Activate fires the workflow right away, not at the next tick: say so.
        aria-label={rollup === "active" ? "Pause" : "Activate. Sending starts right away."}
        onClick={() => {
          if (actionable) void toggle();
        }}
        onKeyDown={(e) => {
          if (actionable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            void toggle();
          }
        }}
        className={`group -mx-1 flex items-center justify-end gap-2.5 rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
          actionable ? "cursor-pointer hover:bg-gray-100" : ""
        } ${pending ? "opacity-60" : ""}`}
      >
        {/* A plan's $50/day is fixed, so a subscriber sees the status alone. */}
        {!budgetHidden && (
          <span className="text-sm tabular-nums text-gray-600">
            {fmtDailyBudgetUsd(totalCents)}
            <span className="text-gray-400">{cap ? " cap / day" : " / day"}</span>
          </span>
        )}
        <span
          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
            hold ? PAYMENT_HOLD_STYLE : ROLLUP_STYLE[rollup]
          }`}
        >
          {hold ? PAYMENT_HOLD_LABEL[hold] : ROLLUP_LABEL[rollup]}
        </span>
        {actionable && (
          <span className="whitespace-nowrap text-[12px] font-medium text-gray-500 underline-offset-2 group-hover:text-gray-800 group-hover:underline">
            {action}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-[260px] text-right text-[12px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
