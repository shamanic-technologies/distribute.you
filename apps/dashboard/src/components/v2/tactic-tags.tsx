"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tagsThatFit, type FollowedTactic } from "@/lib/live-workflow-rows";

/**
 * Tactic tags, ONE look for workflows and templates (Research lists, drawers, pages): the tags that
 * fit then "+N more" (hover on desktop, tap on mobile), `[]` = "None" (judged, follows none), null =
 * not known in words from `tacticsUnavailableReason`, never "None".
 */

/** Unknown tactics in words (features-service `tacticsUnavailableReason`): never "None". */
export function unknownTacticsWords(reason: string | null | undefined): string {
  return reason === "tactics_unreadable" ? "Not readable just now" : "Not judged yet";
}

/** A drawer's or page's Tactics block, workflows and templates alike: every tag, wrapped. */
export function TacticsBlock({ tactics, reason = null }: { tactics: readonly FollowedTactic[] | null; reason?: string | null }) {
  return (
    <div>
      <p className="k-label">Tactics</p>
      {tactics == null ? (
        <p className="k-fg3 mt-1.5 text-[12px]">{unknownTacticsWords(reason)}.</p>
      ) : tactics.length === 0 ? (
        <p className="k-fg3 mt-1.5 text-[12px]">Follows no tactic.</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tactics.map((t) => (
            <span key={t.id} className="k-chip">
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The first tactic tags that FIT the cell on one line, then "+N more" listing them all on hover
 * (desktop) or tap (mobile). The fit is measured off an invisible copy of every tag, re-measured
 * when the cell resizes; a lone tag too wide for the cell truncates with an ellipsis.
 */
export function TacticTags({ tactics, reason = null }: { tactics: readonly FollowedTactic[] | null; reason?: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  const names = tactics?.map((t) => t.name).join("|") ?? "";
  useLayoutEffect(() => {
    const el = box.current;
    const rl = ruler.current;
    if (!el || !rl || !tactics?.length) return;
    const measure = () => {
      const widths = [...rl.children].map((c) => (c as HTMLElement).offsetWidth);
      setFit(tagsThatFit(widths, el.clientWidth, MORE_W, TAG_GAP));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names]);
  // Null = not known (`tacticsUnavailableReason`), never "None": `[]` alone means judged, follows none.
  if (tactics == null) return <span className="k-fg3 text-[12px]">{unknownTacticsWords(reason)}</span>;
  if (tactics.length === 0) return <span className="k-fg3 text-[12px]">None</span>;
  const n = fit ?? 1;
  const rest = tactics.length - n;
  return (
    <div ref={box} className="relative flex min-w-0 flex-nowrap items-center gap-1">
      <div ref={ruler} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex gap-1">
        {tactics.map((t) => (
          <span key={t.id} className="k-chip whitespace-nowrap">
            {t.name}
          </span>
        ))}
      </div>
      {tactics.slice(0, n).map((t) => (
        <span key={t.id} className="k-chip min-w-0 shrink" title={t.name}>
          <span className="truncate">{t.name}</span>
        </span>
      ))}
      {rest > 0 && <MoreTactics label={`+${rest} more`} tactics={tactics} />}
    </div>
  );
}

/** Room kept for "+N more" and the gap between tags, in px. */
const MORE_W = 64;
const TAG_GAP = 4;

/** "+N more": the whole list in a portalled k-popover, opened by hover on desktop or a tap. */
function MoreTactics({ label, tactics }: { label: string; tactics: readonly FollowedTactic[] }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) });
  };
  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [at]);
  const host = typeof document === "undefined" ? null : (document.getElementById("v2-portal") ?? document.body);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="k-btn-ghost h-6 shrink-0 whitespace-nowrap px-1.5 text-[12px]"
        aria-expanded={at != null}
        // Hover is a mouse thing: a tap also fires the enter, which would open then the click close it.
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && setAt(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (at) setAt(null);
          else show();
        }}
      >
        {label}
      </button>
      {at &&
        host &&
        createPortal(
          <div className="k-popover fixed z-[70] w-60 p-2.5" style={{ top: at.top, left: at.left }} role="tooltip">
            <p className="k-label">Tactics</p>
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {tactics.map((t) => (
                <li key={t.id} className="k-chip">
                  {t.name}
                </li>
              ))}
            </ul>
          </div>,
          host,
        )}
    </>
  );
}

