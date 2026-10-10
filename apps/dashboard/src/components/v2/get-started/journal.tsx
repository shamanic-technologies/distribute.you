"use client";

/**
 * The journal: what the preview has found so far, one compact entry per finished
 * step, the way Explee's left rail accumulates. The stage shows ONE step at a time;
 * when it moves on, that step's card flies into its entry here (view transition,
 * `stepViewName`). An entry is never drawn for the step the stage is showing, so the
 * two never carry the same transition name at once.
 *
 * The audience entry is also the audience picker: picking another one builds its
 * companies (step 5) and the first emails (step 6) again.
 *
 * Desktop draws a rail (`JournalRail`); a phone draws a compact strip above the
 * stage (`JournalStrip`) with the same picker.
 */

import type { AudienceCompanyRow, AudienceSegmentProposal } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import {
  GET_STARTED_STEPS,
  settledPhase,
  type Competitor,
  type GetStartedAudience,
  type GetStartedOffer,
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
  offer: GetStartedOffer | null;
  audience: GetStartedAudience | null;
  audienceProposals: AudienceSegmentProposal[];
  audienceBusy: number | null;
  rows: AudienceCompanyRow[];
  written: number;
  /** The questions, as the rail states them once answered. */
  /** The campaign set at the last step ("Epiphany, $20 a day"), or null until set. */
  campaignLine: string | null;
  lifetimeRevenue: string;
  leverCount: number;
  giveCount: number;
  onPickAudience: (index: number) => void;
  onFocus: (key: GetStartedStepKey) => void;
}

/** A finished step behind the stage. A step ahead of it is not drawn, even settled (a failed read ahead is said when the stage gets there). */
const inRail = (d: JournalData, key: GetStartedStepKey) => {
  const at = GET_STARTED_STEPS.findIndex((s) => s.key === d.staged);
  const idx = GET_STARTED_STEPS.findIndex((s) => s.key === key);
  return settledPhase(d.steps[key]) && d.staged !== key && (idx < at || d.steps[key] === "done");
};

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
  if (k === "offer")
    return d.offer ? (
      <div className="k-card rounded-lg px-2.5 py-2">
        <p className="k-fg truncate text-[12.5px] font-medium">{d.offer.name}</p>
        {d.offer.description && <p className="k-fg3 mt-0.5 line-clamp-2 text-[12px] leading-[18px]">{d.offer.description}</p>}
      </div>
    ) : null;
  if (k === "audience") return <AudiencePicker d={d} />;
  if (k === "campaign") return d.campaignLine ? <p className="k-fg2 truncate text-[12px] tabular-nums">{d.campaignLine}</p> : null;
  if (k === "value") return d.lifetimeRevenue ? <p className="k-fg2 text-[12px] tabular-nums">{`$${d.lifetimeRevenue} per client`}</p> : null;
  if (k === "levers") return <p className="k-fg2 text-[12px] tabular-nums">{`${d.leverCount} of 6 offer points`}</p>;
  if (k === "gives") return <p className="k-fg2 text-[12px] tabular-nums">{d.giveCount === 1 ? "1 thing to give away" : `${d.giveCount} things to give away`}</p>;
  if (k === "companies")
    return (
      <div>
        <p className="k-label">
          Companies <span className="k-fg2 tabular-nums">{d.rows.length}</span>
        </p>
        <ul className="mt-1.5 grid gap-1">
          {d.rows.slice(0, 4).map((r) => (
            <li key={r.index} className="flex min-w-0 items-center gap-2">
              <BrandLogo domain={r.company.domain} size={14} className="rounded-sm" />
              <span className="k-fg2 truncate text-[12px]">{r.company.name}</span>
            </li>
          ))}
          {d.rows.length > 4 && <li className="k-fg3 text-[11px]">+{d.rows.length - 4} more</li>}
        </ul>
      </div>
    );
  return <p className="k-fg2 text-[12px] tabular-nums">{d.written === 1 ? "1 email written" : `${d.written} emails written`}</p>;
}

/** The audiences in words; picking another one builds its companies again. */
function AudiencePicker({ d }: { d: JournalData }) {
  return (
    <div>
      <p className="k-label">
        Audiences <span className="k-fg2 tabular-nums">{d.audienceProposals.length}</span>
      </p>
      <ul className="mt-1.5 grid gap-1">
        {d.audienceProposals.map((a, i) => {
          const on = d.audience?.name === a.name;
          return (
            <li key={`${a.name}-${i}`} className="gs-in" style={stagger(i, 50)}>
              <button
                type="button"
                onClick={() => d.onPickAudience(i)}
                disabled={d.audienceBusy != null}
                aria-pressed={on}
                className={`w-full rounded-lg px-2 py-1.5 text-left ${on ? "k-card ring-1 ring-[var(--accent)]" : "k-hover"}`}
              >
                <span className={`block truncate text-[12.5px] ${on ? "k-fg font-medium" : "k-fg2"}`}>{a.name}</span>
                {d.audienceBusy === i && <span className="k-fg3 block text-[11px]">Finding companies</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The phone's journal: one scrollable line of what was found, then the audience picker. */
export function JournalStrip(d: JournalData) {
  const companyIn = d.steps.company === "done" && d.staged !== "company";
  const competitorsIn = d.steps.competitors === "done" && d.staged !== "competitors" && d.competitors.length > 0;
  const offerIn = d.steps.offer === "done" && d.staged !== "offer" && !!d.offer;
  const audienceIn = d.steps.audience === "done" && d.staged !== "audience" && d.audienceProposals.length > 0;
  if (!companyIn && !competitorsIn && !offerIn && !audienceIn) return null;
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
        {offerIn && d.offer && (
          <button type="button" onClick={() => d.onFocus("offer")} className="gs-in k-card flex shrink-0 items-center gap-2 px-2.5 py-1.5" style={{ viewTransitionName: stepViewName("offer") }}>
            <span className="k-label">Offer</span>
            <span className="k-fg max-w-[160px] truncate text-[12px] font-medium">{d.offer.name}</span>
          </button>
        )}
      </div>
      {audienceIn && (
        <div className="k-scroll -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1" style={{ viewTransitionName: stepViewName("audience") }} aria-label="Audiences">
          {d.audienceProposals.map((a, i) => {
            const on = d.audience?.name === a.name;
            return (
              <button
                key={`${a.name}-${i}`}
                type="button"
                onClick={() => d.onPickAudience(i)}
                disabled={d.audienceBusy != null}
                aria-pressed={on}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ${on ? "k-card ring-1 ring-[var(--accent)] k-fg font-medium" : "k-card k-fg2"}`}
              >
                <span className="max-w-[180px] truncate">{a.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
