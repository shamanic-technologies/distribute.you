"use client";

/**
 * The journal: what the preview has found so far, one compact entry per finished
 * step, the way Explee's left rail accumulates. The stage shows ONE step at a time;
 * when it moves on, that step's card flies into its entry here (view transition,
 * `stepViewName`). An entry is never drawn for the step the stage is showing, so the
 * two never carry the same transition name at once.
 *
 * The segments entry is also the segment picker: picking one re-reads its free
 * sample (steps 4 to 6), queued behind any read already running.
 *
 * Desktop draws a rail (`JournalRail`); a phone draws a compact strip above the
 * stage (`JournalStrip`) with the same picker.
 */

import type { AudiencePreview, PreviewEmail } from "@/lib/api";
import { Initials } from "@/components/v2/ui";
import { BrandLogo } from "@/components/brand-logo";
import {
  GET_STARTED_STEPS,
  compactCount,
  settledPhase,
  type Competitor,
  type GetStartedSegment,
  type GetStartedStepKey,
  type StepPhase,
} from "@/lib/v2/get-started";
import { stagger } from "./motion";
import { stepViewName } from "./view-transition";

export interface JournalData {
  steps: Record<GetStartedStepKey, StepPhase>;
  staged: GetStartedStepKey;
  name: string | null;
  domain: string | null;
  overview: string;
  competitors: Competitor[];
  segments: GetStartedSegment[];
  selected: string | null;
  preview: AudiencePreview | undefined;
  mail: PreviewEmail | undefined;
  onSelect: (id: string) => void;
  onFocus: (key: GetStartedStepKey) => void;
}

const inRail = (d: JournalData, key: GetStartedStepKey) => settledPhase(d.steps[key]) && d.staged !== key;

export function JournalRail(d: JournalData) {
  const shown = GET_STARTED_STEPS.map((s, i) => ({ ...s, index: i + 1 })).filter((s) => inRail(d, s.key));
  return (
    <aside className="k-surface hidden border-r border-[var(--line-subtle)] lg:block lg:min-h-0 lg:overflow-y-auto k-scroll" aria-label="What we found">
      <div className="px-4 py-5">
        <p className="k-label">distribute.you</p>
        {shown.length === 0 ? (
          <p className="k-fg3 mt-4 text-[12px] leading-5">What we find lands here, one step at a time.</p>
        ) : (
          <div className="mt-3 grid gap-4">
            {shown.map((s) => (
              <section key={s.key} className="gs-in" style={{ viewTransitionName: stepViewName(s.key) }}>
                <button type="button" onClick={() => d.onFocus(s.key)} className="k-mono k-fg3 k-hover -mx-1 flex w-[calc(100%+8px)] items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px]">
                  <span className={d.steps[s.key] === "done" ? "text-[var(--data-teal)]" : "text-[var(--data-amber)]"} aria-hidden="true">
                    {d.steps[s.key] === "done" ? "✓" : "!"}
                  </span>
                  <span>step {s.index}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{s.label}</span>
                </button>
                <div className="mt-2">
                  <RailEntry d={d} k={s.key} />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function RailEntry({ d, k }: { d: JournalData; k: GetStartedStepKey }) {
  if (d.steps[k] !== "done") return <p className="k-fg3 text-[12px]">Nothing found.</p>;
  if (k === "company")
    return (
      <div>
        <div className="flex items-center gap-2">
          <BrandLogo domain={d.domain} size={20} className="rounded-md" />
          <p className="k-fg min-w-0 truncate text-[13px] font-medium">{d.name ?? d.domain}</p>
          {d.domain && <p className="k-fg3 k-mono min-w-0 truncate text-[11px]">{d.domain}</p>}
        </div>
        {d.overview && <p className="k-fg2 mt-2 line-clamp-5 text-[12px] leading-[18px]">{d.overview}</p>}
      </div>
    );
  if (k === "competitors")
    return (
      <div>
        <p className="k-label">
          Competitors <span className="k-fg2 tabular-nums">{d.competitors.length}</span>
        </p>
        <ul className="mt-1.5 grid grid-cols-2 gap-1">
          {d.competitors.slice(0, 8).map((c, i) => (
            <li key={c.domain ?? c.name} className="gs-pop k-card flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1" style={stagger(i, 40)}>
              <BrandLogo domain={c.domain} size={14} className="rounded-sm" />
              <span className="k-fg2 truncate text-[12px]">{c.domain ?? c.name}</span>
            </li>
          ))}
        </ul>
        {d.competitors.length > 8 && <p className="k-fg3 mt-1 text-[11px]">+{d.competitors.length - 8} more</p>}
      </div>
    );
  if (k === "segments") return <SegmentPicker d={d} />;
  if (k === "companies") {
    const list = d.preview?.status === "ready" ? d.preview.companies : [];
    return (
      <ul className="grid gap-1">
        {list.slice(0, 4).map((c) => (
          <li key={c.name} className="flex min-w-0 items-center gap-2">
            <Initials name={c.name} size={16} />
            <span className="k-fg2 truncate text-[12px]">{c.name}</span>
          </li>
        ))}
        {list.length > 4 && <li className="k-fg3 text-[11px]">+{list.length - 4} more</li>}
      </ul>
    );
  }
  if (k === "people") {
    const list = d.preview?.status === "ready" ? d.preview.people : [];
    return (
      <ul className="grid gap-1">
        {list.slice(0, 3).map((x, i) => {
          const name = [x.firstName, x.lastNameObfuscated].filter(Boolean).join(" ");
          return (
            <li key={`${name}-${i}`} className="min-w-0">
              <p className="k-fg2 truncate text-[12px]">
                {name || "\u2014"}
                {x.title && <span className="k-fg3">, {x.title}</span>}
              </p>
            </li>
          );
        })}
        {list.length > 3 && <li className="k-fg3 text-[11px]">+{list.length - 3} more</li>}
      </ul>
    );
  }
  return d.mail ? <p className="k-fg2 line-clamp-2 text-[12px]">{d.mail.subject}</p> : null;
}

/** The segments with their sizes; picking one reads its sample. */
function SegmentPicker({ d }: { d: JournalData }) {
  const max = Math.max(1, ...d.segments.map((s) => s.count));
  return (
    <div>
      <p className="k-label">
        Segments <span className="k-fg2 tabular-nums">{d.segments.length}</span>
      </p>
      <ul className="mt-1.5 grid gap-1">
        {d.segments.map((s, i) => {
          const on = d.selected === s.audienceId;
          return (
            <li key={s.audienceId} className="gs-in" style={stagger(i, 50)}>
              <button
                type="button"
                onClick={() => d.onSelect(s.audienceId)}
                aria-pressed={on}
                className={`w-full rounded-lg px-2 py-1.5 text-left ${on ? "k-card ring-1 ring-[var(--accent)]" : "k-hover"}`}
              >
                <span className="flex items-baseline gap-2">
                  <span className={`min-w-0 flex-1 truncate text-[12.5px] ${on ? "k-fg font-medium" : "k-fg2"}`}>{s.name}</span>
                  <span className="k-fg tabular-nums text-[12px]">{compactCount(s.count)}</span>
                </span>
                <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden="true">
                  <span className="gs-fill block h-full rounded-full" style={{ width: `${Math.max(3, (s.count / max) * 100)}%`, background: on ? "var(--accent)" : "var(--fg-4)" }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The phone's journal: one scrollable line of what was found, then the segment picker. */
export function JournalStrip(d: JournalData) {
  const companyIn = d.steps.company === "done" && d.staged !== "company";
  const competitorsIn = d.steps.competitors === "done" && d.staged !== "competitors" && d.competitors.length > 0;
  const segmentsIn = d.steps.segments === "done" && d.staged !== "segments" && d.segments.length > 0;
  if (!companyIn && !competitorsIn && !segmentsIn) return null;
  return (
    <div className="lg:hidden">
      <div className="k-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {companyIn && (
          <button type="button" onClick={() => d.onFocus("company")} className="gs-in k-card flex shrink-0 items-center gap-2 px-2.5 py-1.5" style={{ viewTransitionName: stepViewName("company") }}>
            <BrandLogo domain={d.domain} size={16} className="rounded-sm" />
            <span className="k-fg max-w-[140px] truncate text-[12px] font-medium">{d.name ?? d.domain}</span>
          </button>
        )}
        {competitorsIn && (
          <button type="button" onClick={() => d.onFocus("competitors")} className="gs-in k-card flex shrink-0 items-center gap-2 px-2.5 py-1.5" style={{ viewTransitionName: stepViewName("competitors") }}>
            <span className="flex -space-x-1">
              {d.competitors.slice(0, 3).map((c) => (
                <BrandLogo key={c.domain ?? c.name} domain={c.domain} size={16} className="rounded-sm ring-2 ring-[var(--bg-raised)]" />
              ))}
            </span>
            <span className="k-fg2 text-[12px] tabular-nums">{d.competitors.length} competitors</span>
          </button>
        )}
      </div>
      {segmentsIn && (
        <div className="k-scroll -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1" style={{ viewTransitionName: stepViewName("segments") }} aria-label="Segments">
          {d.segments.map((s) => {
            const on = d.selected === s.audienceId;
            return (
              <button
                key={s.audienceId}
                type="button"
                onClick={() => d.onSelect(s.audienceId)}
                aria-pressed={on}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ${on ? "k-card ring-1 ring-[var(--accent)] k-fg font-medium" : "k-card k-fg2"}`}
              >
                <span className="max-w-[160px] truncate">{s.name}</span>
                <span className="k-fg3 tabular-nums">{compactCount(s.count)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
