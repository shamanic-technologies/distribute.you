"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getLeadWrittenBy } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { tagsThatFit, writtenByForRow, writtenWithTags, type ModelTag, type WrittenBy } from "@/lib/written-by";

/**
 * What the messages we sent one person were written with (features-service, `lib/written-by.ts`).
 * Read on open, not polled: the producer walks the pipe rankings, which can take seconds a call,
 * and a row only appears when a message is sent.
 */
export function useLeadWrittenBy(leadId: string | null | undefined): WrittenBy | null {
  const q = useAuthQuery(["leadWrittenBy", leadId], () => getLeadWrittenBy(leadId!), { enabled: Boolean(leadId) });
  // Only THIS person's read: the app-wide placeholder would hand a re-keyed read the last person's.
  if (!leadId || q.isPlaceholderData || !q.data || q.data.leadId !== leadId) return null;
  return q.data;
}

const GAP = 4;

function ModelLogo({ model, size }: { model: ModelTag; size: number }) {
  return model.logoSrc ? <img src={model.logoSrc} alt="" width={size} height={size} className="shrink-0" /> : null;
}

/**
 * Discreet tags beside a message's label (owner 2026-10-19): "Written with", the model (product
 * logo + name) and each tactic's name, its client line on hover. Matched on the message's own id
 * (`messageId`, lead-service's), the campaign entry only for a message with no served row.
 * Nothing when a person wrote it, the writer is unknown, or nothing is served (never a guess).
 *
 * Tags that do not fit the width show the first ones and "+N more"; hovering it (or tapping it on
 * a phone) opens the whole list. Widths are measured off an invisible full copy, which also keeps
 * keeps measuring when room returns. It takes the room left on its line (`grow basis-0`) and never
 * less than its first tag: where even that does not fit, the line wraps, never a clipped tag.
 */
export function WrittenWithTags({
  writtenBy,
  messageId,
  campaignId,
  at,
}: {
  writtenBy: WrittenBy | null;
  messageId: string | null | undefined;
  campaignId: string | null | undefined;
  at: string | null | undefined;
}) {
  const tags = writtenWithTags(writtenByForRow(writtenBy, { id: messageId, campaignId, at }));
  const chips: { key: string; title: string; body: ReactNode }[] = [];
  if (tags?.model) {
    const model = tags.model;
    chips.push({
      key: "model",
      title: model.name,
      body: (
        <>
          <ModelLogo model={model} size={12} />
          {model.label}
        </>
      ),
    });
  }
  for (const t of tags?.tactics ?? []) chips.push({ key: `t:${t.name}`, title: t.line, body: t.name });

  const rootRef = useRef<HTMLSpanElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(chips.length);
  // Never narrower than "Written with" + the first tag (+ "+N more"): the row wraps instead.
  const [minWidth, setMinWidth] = useState(0);
  const signature = chips.map((c) => c.key).join("|");

  useLayoutEffect(() => {
    const root = rootRef.current;
    const ghost = ghostRef.current;
    if (!root || !ghost) return;
    const measure = () => {
      const kids = Array.from(ghost.children) as HTMLElement[];
      const n = kids.length - 2;
      if (n <= 0) return;
      const widths = kids.slice(1, 1 + n).map((k) => k.offsetWidth);
      const more = kids[1 + n].offsetWidth;
      setMinWidth(Math.ceil(kids[0].offsetWidth + GAP + widths[0] + (n > 1 ? GAP + more : 0)));
      setFit(tagsThatFit(root.clientWidth, kids[0].offsetWidth, widths, more, GAP));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [signature]);

  if (!tags) return null;
  const hidden = chips.length - Math.min(fit, chips.length);
  return (
    <span ref={rootRef} className="relative min-w-0 shrink grow basis-0 overflow-hidden" style={{ minWidth }} data-written-with>
      {/* The full row, invisible: what each chip measures. */}
      <span ref={ghostRef} aria-hidden className="invisible flex h-0 items-center gap-1 whitespace-nowrap">
        <span className="k-fg3 text-[12px]">Written with</span>
        {chips.map((c) => (
          <span key={c.key} className="k-chip">
            {c.body}
          </span>
        ))}
        <span className="k-chip">+{chips.length} more</span>
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap">
        <span className="k-fg3 text-[12px]">Written with</span>
        {chips.slice(0, chips.length - hidden).map((c) => (
          <span key={c.key} className="k-chip" title={c.title}>
            {c.body}
          </span>
        ))}
        {hidden > 0 && tags ? <MoreTags count={hidden} model={tags.model} tactics={tags.tactics} /> : null}
      </span>
    </span>
  );
}

/** "+N more": hover (mouse) or tap (touch) opens every tag, portalled so no card clips it. */
function MoreTags({
  count,
  model,
  tactics,
}: {
  count: number;
  model: ModelTag | null;
  tactics: { name: string; line: string }[];
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 288;
    setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
  };
  const closeSoon = () => {
    closeTimer.current = setTimeout(() => setAt(null), 120);
  };

  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAt(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setAt(null);
    };
    const onScroll = () => setAt(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [at]);

  const host = typeof document !== "undefined" ? document.getElementById("v2-portal") ?? document.body : null;
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="k-chip"
        aria-expanded={Boolean(at)}
        onPointerEnter={(e) => e.pointerType === "mouse" && open()}
        onPointerLeave={(e) => e.pointerType === "mouse" && closeSoon()}
        onClick={() => (at ? setAt(null) : open())}
      >
        +{count} more
      </button>
      {at && host
        ? createPortal(
            <div
              ref={popRef}
              role="dialog"
              aria-label="Written with"
              className="k-popover fixed z-50 w-72 p-3 text-[12px]"
              style={{ top: at.top, left: at.left }}
              onPointerEnter={(e) => e.pointerType === "mouse" && open()}
              onPointerLeave={(e) => e.pointerType === "mouse" && closeSoon()}
            >
              <p className="k-label">Written with</p>
              {model ? (
                <p className="mt-2 flex items-center gap-1.5 font-medium">
                  <ModelLogo model={model} size={14} />
                  {model.name}
                </p>
              ) : null}
              <ul className="mt-2 space-y-1.5">
                {tactics.map((t) => (
                  <li key={t.name}>
                    <p className="font-medium">{t.name}</p>
                    <p className="k-fg3">{t.line}</p>
                  </li>
                ))}
              </ul>
            </div>,
            host,
          )
        : null}
    </>
  );
}
