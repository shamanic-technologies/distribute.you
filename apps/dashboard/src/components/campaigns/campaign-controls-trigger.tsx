"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PAYMENT_HOLD_LABEL } from "@/lib/payment-declined";
import { ROLLUP_LABEL } from "@/lib/campaign-controls";
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
 * No money here (owner 2026-10-10): what a campaign may spend is the max budget and max
 * volume of the sales funnel campaign it runs in, stated on that campaign's page. The
 * per-campaign daily ceilings this used to print are retired (api-service, Sunset 2027-04-12).
 */
export function CampaignControlsTrigger({
  brandId,
  offerId,
  legKey,
  campaignId,
  className = "",
}: {
  brandId: string;
  /** Scope to one offer. Omitted at brand grain. */
  offerId?: string;
  /** Scope to ONE leg of that offer. */
  legKey?: string | null;
  /** Scope to one campaign. Omitted at brand and offer grain. */
  campaignId?: string;
  className?: string;
}) {
  const { rows, settled, rollup, hold, pending, error, toggle } = useScopeToggle(brandId, {
    offerId,
    legKey,
    campaignId,
  });
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
