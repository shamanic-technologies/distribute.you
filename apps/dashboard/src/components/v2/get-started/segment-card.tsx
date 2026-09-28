"use client";

/**
 * A segment as Explee draws a campaign: its name, a size ring, why it fits, and what
 * the people search filters on. Everything is served: the size is human-service's
 * free dry-run count, the criteria are the filters it built, and the example
 * companies come from the segment's own free sample once it has been read. A segment
 * whose sample is not read yet shows no examples rather than invented ones.
 */

import type { CSSProperties } from "react";
import type { AudiencePreview } from "@/lib/api";
import { compactCount, type GetStartedSegment } from "@/lib/v2/get-started";
import { CountUp, stagger, useCountUp } from "./motion";

/**
 * A ring that fills to `share` (0..1, this segment's size against the largest one)
 * while the number in its middle counts up to the served count.
 */
export function SizeRing({ count, share, size = 44 }: { count: number; share: number; size?: number }) {
  const p = useCountUp(Math.max(0.04, Math.min(1, share)), 1100);
  const style = {
    width: size,
    height: size,
    background: `conic-gradient(var(--accent) ${p}turn, var(--data-track) 0)`,
    WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px))",
    mask: "radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px))",
  } as CSSProperties;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={`${count.toLocaleString("en-US")} people match`}>
      <span className="absolute inset-0 rounded-full" style={style} aria-hidden="true" />
      <span className="k-fg text-[10.5px] font-medium">
        <CountUp value={count} format={compactCount} ms={1100} />
      </span>
    </span>
  );
}

export function SegmentCard({
  segment,
  index,
  max,
  selected,
  preview,
  onSelect,
}: {
  segment: GetStartedSegment;
  index: number;
  max: number;
  selected: boolean;
  preview: AudiencePreview | undefined;
  onSelect: () => void;
}) {
  const examples = preview?.status === "ready" ? preview.companies.slice(0, 5) : [];
  const criteria = segment.criteria ?? [];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={stagger(index, 90)}
      className={`gs-in k-card flex flex-col p-4 text-left transition-shadow duration-200 ${selected ? "ring-1 ring-[var(--accent)]" : "k-hover"}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="k-fg text-[14px] font-medium leading-5">{segment.name}</p>
          {selected && <p className="k-accent-text mt-0.5 text-[11px]">Picked for the sample</p>}
        </div>
        <SizeRing count={segment.count} share={segment.count / max} />
      </div>
      {segment.rationale && <p className="k-fg2 mt-2 text-[13px] leading-5">{segment.rationale}</p>}
      {criteria.length > 0 && (
        <div className="mt-3">
          <p className="k-label">Criteria</p>
          <dl className="mt-1.5 grid gap-1.5">
            {criteria.map((c) => (
              <div key={c.label} className="flex min-w-0 items-baseline gap-2">
                <dt className="k-fg3 w-[84px] shrink-0 text-[12px]">{c.label}</dt>
                <dd className="flex min-w-0 flex-wrap gap-1">
                  {c.values.slice(0, 3).map((v) => (
                    <span key={v} className="k-chip max-w-[180px] truncate">
                      {v}
                    </span>
                  ))}
                  {c.values.length > 3 && <span className="k-fg3 text-[11px] tabular-nums">+{c.values.length - 3}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {examples.length > 0 && (
        <div className="mt-3">
          <p className="k-label">Examples</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {examples.map((c, i) => (
              <span key={c.name} className="gs-pop k-inset max-w-[180px] truncate rounded-md px-2 py-0.5 text-[12px] text-[var(--fg-2)]" style={stagger(i, 50)}>
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  );
}
