"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PAYMENT_HOLD_LABEL } from "@/lib/payment-declined";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { ROLLUP_LABEL, scopeTotalCents } from "@/lib/campaign-controls";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { useDailyBudgetHidden } from "@/lib/use-daily-budget-hidden";
import { useScopeToggle } from "@/lib/use-scope-toggle";
import { Shimmer } from "@/components/v2/ui";

/**
 * Is this running, and how hard — stated at whatever grain the page is on, and
 * the ONE press that pauses or activates it (owner 2026-10-03: no modal, no
 * per-campaign toggles, "simplement activer ou mettre en pause").
 *
 * What reads is the STATE alone ("Active"), never a Pause button: pausing is rare
 * and nobody should be invited to do it (owner 2026-10-03). The state is a
 * `k-btn` with a chevron, so it reads as clickable on a phone too; a press opens
 * a one-item menu holding the other state ("Pause" / "Activate"), so a pause
 * always takes two deliberate presses. The trigger and the menu item are
 * `role="button"` spans rather than native button elements, because the control
 * renders inside clickable regions (a mission row) and a nested button is
 * invalid HTML: the parser closes the outer one early and the row breaks. The
 * menu is portalled to `#v2-portal` so a table's scroll box cannot clip it.
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
  const anchor = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !anchor.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [at]);

  if (!settled) {
    return (
      <div className={`flex items-center justify-end gap-2.5 ${className}`}>
        <Shimmer className="h-4 w-16" />
        <Shimmer className="h-7 w-20" />
      </div>
    );
  }

  const totalCents =
    totalCentsOverride !== undefined
      ? totalCentsOverride
      : scopeTotalCents(
          dailyOnly ? rows.filter((r) => (legFor(catalogue, r.legKey)?.fromKey ?? null) === null) : rows,
        );

  const running = rollup === "active";
  const actionable = rollup !== "none" && !pending;
  const label = pending ? "Saving…" : hold ? PAYMENT_HOLD_LABEL[hold] : ROLLUP_LABEL[rollup];
  const action = running ? "Pause" : "Activate";
  // Activate fires the workflow right away, not at the next tick: say so.
  const consequence = running ? "Sending stops until you restart it." : "Sending starts right away.";

  const openMenu = () => {
    if (!actionable) return;
    if (at) return setAt(null);
    const r = anchor.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 6, right: window.innerWidth - r.right });
  };
  const choose = () => {
    setAt(null);
    void toggle();
  };
  const host = typeof document === "undefined" ? null : document.getElementById("v2-portal");

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-2.5">
        {/* A plan's $50/day is fixed, so a subscriber sees the status alone. */}
        {!budgetHidden && (
          <span className="k-fg2 text-[13px] tabular-nums">
            {fmtDailyBudgetUsd(totalCents)}
            <span className="k-fg3">{cap ? " cap / day" : " / day"}</span>
          </span>
        )}
        <span
          ref={anchor}
          role="button"
          tabIndex={actionable ? 0 : -1}
          aria-haspopup="menu"
          aria-expanded={at !== null}
          aria-disabled={!actionable}
          aria-busy={pending}
          onClick={openMenu}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openMenu();
            }
          }}
          className={`k-btn whitespace-nowrap ${actionable ? "cursor-pointer" : ""} ${pending ? "opacity-60" : ""}`}
        >
          {running ? (
            <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
          ) : (
            <span
              className={`h-2 w-2 rounded-full border-[1.5px] ${hold ? "border-[var(--data-amber)]" : "border-[var(--fg-3)]"}`}
            />
          )}
          {label}
          {actionable && (
            <svg width="10" height="10" viewBox="0 0 10 10" className="k-fg3" aria-hidden="true">
              <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </div>
      {at &&
        host &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            className="k-popover fixed z-[70] w-[240px] p-1"
            style={{ top: at.top, right: at.right }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              role="menuitem"
              tabIndex={0}
              aria-label={`${action}. ${consequence}`}
              autoFocus
              onClick={choose}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  choose();
                }
              }}
              className="block cursor-pointer rounded-md px-2.5 py-2 hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none"
            >
              <span className="k-fg block text-[13px] font-medium">{action}</span>
              <span className="k-fg3 block text-[12px]">{consequence}</span>
            </span>
          </div>,
          host,
        )}
      {error && (
        <p role="alert" className="max-w-[260px] text-right text-[12px] text-[var(--data-rose)]">
          {error}
        </p>
      )}
    </div>
  );
}
