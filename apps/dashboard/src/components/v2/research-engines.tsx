"use client";

import { useSearchParams } from "next/navigation";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { EmptyNote, Figure, SectionTitle, Shimmer, SparkLine, StatTile } from "@/components/v2/ui";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getPublicCatalogueSteps } from "@/lib/api";
import { formatRatePct } from "@/lib/pipe-stats";
import { formatUsdAdaptive } from "@/lib/format-number";
import { regretPct } from "@/lib/factory-shadow";
import { useResearchEnginePlaces } from "@/lib/research/research-source";
import { outcomeTint, outcomesPer100, placesByCaller, replayFamiliesOf, selectedPlace, splitsByPlace, type EnginePlace, type EnginePlaces, type StrategySplit } from "@/lib/research/engine-places";

/**
 * The Engine half of Research (FACTORY-RESEARCH-1102, owner 2026-11-02 « on adaptera la page Research qui est outdate
 * avec tous les pipes »), drawn on the GTM Factory Research page: the headline (« N of M candidate places have a clear
 * winner »), Candidate places grouped by caller beside the selected place's detail, then One Engine, several callers.
 * Every figure is features-service's `engine-places` read (`lib/research/engine-places.ts`); nothing is computed here.
 */

const TH = "k-label px-3 py-2.5 font-medium first:pl-4 last:pr-4";
const TD = "px-3 py-2 first:pl-4 last:pr-4";
const TDN = `${TD} text-right tabular-nums`;

function pct(v: number | null): React.ReactNode {
  return v == null ? <span className="k-fg4">{"—"}</span> : formatRatePct(v);
}

/** An outcome's mark, as the public step catalogue serves it (the Outcomes pages wear the same). */
function OutcomeMark({ outcome, name, size = 28 }: { outcome: string; name: string; size?: number }) {
  const steps = useAuthQuery(["publicCatalogueSteps"], getPublicCatalogueSteps, { staleTime: 10 * 60_000 });
  const step = steps.data?.find((s) => s.key === outcome) ?? null;
  return <CatalogueMark icon={step?.icon ?? null} color={outcomeTint(outcome)} name={step?.name ?? name} size={size} />;
}

/** A served share (0-100) as a bar on the data track, green when it is a clear winner's. */
function ShareBar({ pct: v, strong, className = "" }: { pct: number | null; strong?: boolean; className?: string }) {
  return (
    <span className={`block h-1.5 overflow-hidden rounded-full bg-[var(--data-track)] ${className}`} aria-hidden="true">
      <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%`, background: strong ? "var(--run)" : "var(--accent)" }} />
    </span>
  );
}

/** A place's candidates as one stacked bar of their served shares, the favourite first and full colour. */
function SplitStrip({ place }: { place: EnginePlace }) {
  return (
    <span className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden="true">
      {place.candidates.map((c, i) => (
        <span
          key={c.candidateId}
          className="h-full border-r border-[var(--bg)] last:border-0"
          style={{ width: `${Math.max(0, c.sharePct ?? 0)}%`, background: i === 0 ? (place.clearWinner ? "var(--run)" : "var(--accent)") : "var(--accent)", opacity: i === 0 ? 1 : Math.max(0.2, 0.55 - i * 0.1) }}
        />
      ))}
    </span>
  );
}

/** A served day series as one line with its scale and days: the detail's big chart (the v2 SVG family, no library). */
function DayLine({ days, values, format, color = "var(--accent)" }: { days: string[]; values: Array<number | null>; format: (v: number) => string; color?: string }) {
  const w = 640;
  const h = 180;
  const pad = { l: 48, r: 8, t: 10, b: 22 };
  const nums = values.filter((v): v is number => v != null);
  const max = Math.max(...nums, 0) || 1;
  const x = (i: number) => pad.l + (values.length < 2 ? 0 : (i / (values.length - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const d = values.map((v, i) => (v == null ? "" : `${i === 0 || values[i - 1] == null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(" ");
  const ticks = [0, 0.5, 1].map((f) => max * f);
  const labelAt = [0, Math.floor((days.length - 1) / 2), days.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[200px] w-full" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line-subtle)" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--fg-3)">
            {format(t)}
          </text>
        </g>
      ))}
      {[...new Set(labelAt)].map((i) => (
        <text key={i} x={x(i)} y={h - 4} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--fg-3)">
          {days[i]?.slice(5)}
        </text>
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

/** The page's headline, Factory's: how many places have a clear winner, read off the served summary. */
export function EngineHeadline() {
  const q = useResearchEnginePlaces();
  const d = q.data;
  return (
    <div className="min-w-0">
      <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
        {d ? (
          <>
            {d.summary.clearWinners} of {d.summary.places} candidate places have a clear winner
          </>
        ) : q.isError ? (
          "Research"
        ) : (
          <Shimmer className="inline-block h-8 w-[420px] align-middle" />
        )}
      </h1>
      <p className="k-fg2 mt-1 text-[14px]">
        Every pick of every live campaign, made by one Engine per outcome. A clear winner is a workflow the Engine draws{" "}
        {d ? `${d.clearWinnerPct}%` : "90%"} of the time or more.
      </p>
    </div>
  );
}

export function EngineSection() {
  const q = useResearchEnginePlaces();
  if (q.isError && !q.data) {
    return (
      <div className="k-card mt-6">
        <EmptyNote>We could not load the Engines just now.</EmptyNote>
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="k-card space-y-2 p-3">
          {[0, 1, 2, 3].map((i) => (
            <Shimmer key={i} className="h-10 w-full" />
          ))}
        </div>
        <Shimmer className="h-48 w-full" />
      </div>
    );
  }
  return <Engines data={q.data} />;
}

function Engines({ data }: { data: EnginePlaces }) {
  const search = useSearchParams();
  const selected = selectedPlace(data.places, search.get("place"));
  // A pick stays in the URL with the history API (no server round trip); `null` state so Next syncs useSearchParams.
  const select = (key: string) => window.history.replaceState(null, "", `?place=${encodeURIComponent(key)}`);
  const groups = placesByCaller(data.places);
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Places" note="outcome x caller">
          <div className="flex items-end justify-between gap-2">
            <Figure value={data.summary.places} />
            <div className="flex flex-wrap justify-end gap-[3px]" aria-hidden="true">
              {data.places.map((p) => (
                <span key={p.key} className="h-4 w-[5px] rounded-full" style={{ background: p.clearWinner ? "var(--run)" : "var(--data-track)" }} />
              ))}
            </div>
          </div>
        </StatTile>
        <StatTile label="Clear winners" note={`chance ${data.clearWinnerPct}% or more`}>
          <div className="flex items-end justify-between gap-3">
            <Figure value={data.summary.clearWinners} sub={`of ${data.summary.places}`} />
            <span className="mb-2 w-20">
              <ShareBar pct={data.summary.places ? (data.summary.clearWinners / data.summary.places) * 100 : 0} strong />
            </span>
          </div>
        </StatTile>
        <StatTile label="Live campaigns" note="read on the last Engine pass">
          <div className="flex items-end justify-between gap-2">
            <Figure value={data.summary.campaigns} />
            <div className="flex h-6 items-end gap-[3px]" aria-hidden="true">
              {data.places.map((p) => (
                <span key={p.key} className="w-[6px] rounded-[2px]" style={{ height: `${Math.max(3, (p.campaigns / Math.max(1, ...data.places.map((x) => x.campaigns))) * 24)}px`, background: outcomeTint(p.outcome) }} />
              ))}
            </div>
          </div>
        </StatTile>
        <StatTile label="Engines" note="one per outcome">
          <div className="flex items-end justify-between gap-2">
            <Figure value={data.engines.length} />
            <div className="flex -space-x-1.5">
              {data.engines.map((e) => (
                <OutcomeMark key={e.outcome} outcome={e.outcome} name={e.outcomeName} size={22} />
              ))}
            </div>
          </div>
        </StatTile>
      </div>

      {data.places.length === 0 ? (
        <div className="k-card mt-6">
          <EmptyNote>The Engine has not picked for any live campaign yet.</EmptyNote>
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section>
            <SectionTitle count={data.places.length}>Candidate places</SectionTitle>
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.consumer}>
                  <p className="k-label mb-1.5 px-1">For {g.consumerName}</p>
                  <div className="k-card divide-y divide-[var(--line-subtle)]">
                    {g.places.map((p) => (
                      <PlaceRow key={p.key} place={p} on={selected?.key === p.key} onSelect={() => select(p.key)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section id="research-place" className="min-w-0 scroll-mt-16 lg:sticky lg:top-4 lg:h-fit">{selected && <PlaceDetail data={data} place={selected} />}</section>
        </div>
      )}

      <EngineCallers data={data} />
      <ProposedStrategies data={data} />
    </>
  );
}

function PlaceRow({ place, on, onSelect }: { place: EnginePlace; on: boolean; onSelect: () => void }) {
  const chance = place.favourite?.chancePct ?? null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`k-hover flex w-full items-center gap-3 px-3 py-2.5 text-left first:rounded-t-[12px] last:rounded-b-[12px] ${on ? "k-selected" : ""}`}
    >
      <OutcomeMark outcome={place.outcome} name={place.outcomeName} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{place.outcomeName}</span>
        <span className="k-fg3 block truncate text-[12px]">
          {place.favourite ? place.favourite.workflowName : "no pick yet"} · {place.campaigns} {place.campaigns === 1 ? "campaign" : "campaigns"}
        </span>
      </span>
      <span className="w-16 shrink-0" title="Share of picks per candidate">
        {place.daily && place.daily.length > 1 ? (
          <SparkLine className="h-6" color={place.clearWinner ? "var(--run)" : undefined} values={place.daily.flatMap((d) => (d.favouriteSharePct == null ? [] : [d.favouriteSharePct]))} />
        ) : (
          <SplitStrip place={place} />
        )}
      </span>
      <span
        className={`w-12 shrink-0 text-right text-[13px] tabular-nums ${place.clearWinner ? "text-[var(--run)]" : "k-fg2"}`}
        title="Chance the favourite is the best"
      >
        {pct(chance)}
      </span>
    </button>
  );
}

function PlaceDetail({ data, place }: { data: EnginePlaces; place: EnginePlace }) {
  const fav = place.favourite;
  const families = replayFamiliesOf(data, place.outcome);
  return (
    <>
      <SectionTitle right={<span>for {place.consumerName}</span>}>{place.outcomeName}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label="Chance the favourite is the best">
          <p className={`text-[22px] font-medium leading-7 tabular-nums ${place.clearWinner ? "text-[var(--run)]" : ""}`}>{pct(fav?.chancePct ?? null)}</p>
          <p className="k-fg3 mt-0.5 flex min-w-0 text-[12px]">{fav ? <CatalogueName kind="workflow" name={fav.workflowName} servedKey={fav.workflowDynastySlug} /> : "no favourite yet"}</p>
        </StatTile>
        <StatTile label="Verdict">
          <p className="text-[15px] font-medium leading-7">{place.clearWinner ? "Clear winner" : fav ? "Still exploring" : "No pick yet"}</p>
        </StatTile>
        <StatTile label="Campaigns" note="live, holding this place">
          <Figure value={place.campaigns} />
        </StatTile>
      </div>

      <div className="k-card mt-3 px-4 pb-3 pt-3">
        {place.daily && place.daily.length > 1 ? (
          <>
            <DayLine days={place.daily.map((d) => d.day)} values={place.daily.map((d) => d.lostUsd)} format={(v) => formatUsdAdaptive(v)} />
            <p className="k-fg3 mt-1 text-[12px]">
              <span className="mr-1.5 inline-block h-0.5 w-3 align-middle bg-[var(--accent)]" />
              Value lost to weaker picks, per day: dollars spent each day on workflows other than today&apos;s favourite.
            </p>
          </>
        ) : (
          <>
            <p className="k-label mb-3">Share of picks, today</p>
            <div className="space-y-2.5">
              {place.candidates.map((c, i) => (
                <div key={c.candidateId} className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_48px] items-center gap-3 text-[13px]">
                  <span className="flex min-w-0">
                    <CatalogueName kind="workflow" name={c.workflowName} servedKey={c.workflowDynastySlug} />
                  </span>
                  <ShareBar pct={c.sharePct} strong={i === 0 && place.clearWinner} className="h-2.5" />
                  <span className={`text-right tabular-nums ${i === 0 && place.clearWinner ? "text-[var(--run)]" : ""}`}>{pct(c.sharePct)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {families.length > 0 && (
        <div className="k-card mt-3 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className={`${TH} text-left`}>Value lost to weaker picks, {data.replay?.windowDays ?? 30} days</th>
                <th className={`${TH} text-right`}>Today&apos;s rule</th>
                <th className={`${TH} text-right`}>The Engine</th>
              </tr>
            </thead>
            <tbody>
              {families.map((f) => (
                <tr key={f.family} className="k-line-subtle border-b last:border-0">
                  <td className={TD}>{f.familyName ?? f.family}</td>
                  <td className={TDN}>
                    <span className="inline-flex items-center gap-2">
                      {f.todayRegret != null && <ShareBar pct={f.todayRegret * 100} className="w-16" />}
                      {regretPct(f.todayRegret) ?? <span className="k-fg4">{"—"}</span>}
                    </span>
                  </td>
                  <td className={TDN}>
                    <span className="inline-flex items-center gap-2">
                      {f.engineRegret != null && <ShareBar pct={f.engineRegret * 100} className="w-16" />}
                      {regretPct(f.engineRegret) ?? <span className="k-fg4">{"—"}</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
            The share of each dollar&apos;s value spent on workflows weaker than the best one, replayed over the last {data.replay?.windowDays ?? 30} days.
          </p>
        </div>
      )}

      <div className="mt-6">
        <SectionTitle count={place.candidates.length}>Candidates</SectionTitle>
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className={`${TH} text-left`}>Workflow</th>
                  <th className={`${TH} w-[150px] text-right`}>Share of picks</th>
                  <th className={`${TH} text-right`}>Belief: reaches {place.outcomeName}</th>
                  <th className={`${TH} text-right`}>Belief: $ per decision</th>
                  <th className={`${TH} text-right`}>Decisions</th>
                  <th className={`${TH} text-right`}>Outcomes</th>
                </tr>
              </thead>
              <tbody>
                {place.candidates.map((c) => {
                  const best = fav?.candidateId === c.candidateId;
                  return (
                    <tr key={c.candidateId} className="k-row k-line-subtle border-b last:border-0">
                      <td className={TD}>
                        <span className="flex min-w-0 items-center gap-2">
                          <CatalogueName kind="workflow" name={c.workflowName} servedKey={c.workflowDynastySlug} className="font-medium" />
                          {best && <span className="k-chip">Favourite</span>}
                        </span>
                        <span className="k-fg3 mt-0.5 block truncate pl-6 text-[12px]">{c.channelName}</span>
                      </td>
                      <td className={`${TDN} ${best && place.clearWinner ? "text-[var(--run)]" : ""}`}>
                        <span className="inline-flex items-center gap-2">
                          <ShareBar pct={c.sharePct} strong={best && place.clearWinner} className="w-14" />
                          {pct(c.sharePct)}
                        </span>
                      </td>
                      <td className={TDN}>{pct(c.beliefRatePct)}</td>
                      <td className={TDN}>{c.costPerDecisionUsd == null ? <span className="k-fg4">{"—"}</span> : formatUsdAdaptive(c.costPerDecisionUsd)}</td>
                      <td className={TDN}>{Math.round(c.fleetDecisions).toLocaleString("en-US")}</td>
                      <td className={TDN}>{c.fleetOutcomes.toLocaleString("en-US", { maximumFractionDigits: 1 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
            Share of picks = how often the Engine draws it, averaged over the campaigns holding this place. Belief = what the Engine reads today. Decisions and
            outcomes are counted fleet-wide.
          </p>
        </div>
      </div>
    </>
  );
}

/** Each outcome Engine, the callers it serves and each caller's favourite: the pick lives on the caller, never on the Engine. */
function EngineCallers({ data }: { data: EnginePlaces }) {
  if (data.engines.length === 0) return null;
  return (
    <section className="mt-14">
      <SectionTitle count={data.engines.length} right={<span>The pick lives on the caller, never on the Engine</span>}>
        One Engine, several callers
      </SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {data.engines.map((e) => (
          <div key={e.outcome} className="k-card p-4">
            <div className="flex items-center gap-2">
              <OutcomeMark outcome={e.outcome} name={e.outcomeName} />
              <span className="text-[14px] font-medium">{e.outcomeName}</span>
              <span className="k-fg3 ml-auto text-[12px]">
                called by {e.callers.length} {e.callers.length === 1 ? "caller" : "callers"}
              </span>
            </div>
            <div className="k-inset mt-3 divide-y divide-[var(--line-subtle)] rounded-[8px]">
              {e.callers.map((c) => {
                const key = data.places.find((p) => p.outcome === e.outcome && p.consumer === c.consumer)?.key ?? null;
                return (
                <button
                  key={c.consumer}
                  type="button"
                  disabled={!key}
                  onClick={() => {
                    if (!key) return;
                    window.history.replaceState(null, "", `?place=${encodeURIComponent(key)}`);
                    document.getElementById("research-place")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="k-hover flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]"
                >
                  <span className="min-w-0 flex-1 truncate">For {c.consumerName}</span>
                  <span className="k-fg3 text-[12px]">best</span>
                  <span className="flex min-w-0 font-medium">{c.best ? <CatalogueName kind="workflow" name={c.best} /> : <span className="k-fg4">{"—"}</span>}</span>
                </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const VERDICT_LOOK: Record<StrategySplit["verdict"], { label: string; cls: string }> = {
  conclusion: { label: "Conclusion", cls: "text-[var(--run)]" },
  signal: { label: "Signal", cls: "text-[var(--data-amber)]" },
  noise: { label: "Noise", cls: "k-fg3" },
};

/** One half of a split: outcomes per 100 decisions (served, over 100 when a decision yields several), on how many decisions and workflows. */
function SplitSide({ side }: { side: StrategySplit["inside"] }) {
  const rate = outcomesPer100(side);
  return (
    <>
      {rate == null ? <span className="k-fg4">{"—"}</span> : rate.toLocaleString("en-US", { maximumFractionDigits: rate < 1 ? 1 : 0 })}{" "}
      <span className="k-fg3">
        on {Math.round(side.decisions).toLocaleString("en-US")} · {side.workflows} {side.workflows === 1 ? "workflow" : "workflows"}
      </span>
    </>
  );
}

/**
 * Factory's « Proposed strategies »: per place, every workflow tactic that splits its candidates in two, the outcome rate
 * per decision inside vs outside and the served verdict; a strategy is proposed only on a conclusion (served `proposed`).
 */
function ProposedStrategies({ data }: { data: EnginePlaces }) {
  const proposed = data.strategySplits.filter((s) => s.proposed).length;
  const groups = splitsByPlace(data.strategySplits);
  return (
    <section className="mt-14">
      <SectionTitle count={proposed} right={<span>A split on the workflows&apos; tactics, proposed only on a conclusion</span>}>
        Proposed strategies
      </SectionTitle>
      {proposed === 0 && (
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">No split has reached a conclusion yet. Every split looked at is below, place by place.</p>
      )}
      {groups.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No place has workflows with different tactics yet.</EmptyNote>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.placeKey} className="k-card overflow-hidden">
              <div className="flex flex-wrap items-baseline gap-x-2 px-4 pb-2 pt-3">
                <span className="text-[14px] font-medium">{g.outcomeName}</span>
                <span className="k-fg3 text-[12px]">for {g.consumerName}</span>
              </div>
              <div className="k-scroll overflow-x-auto">
                <table className="w-full min-w-[720px] table-fixed text-[13px]">
                  <thead>
                    <tr className="k-line-subtle border-y">
                      <th className={`${TH} text-left`}>Split looked at</th>
                      <th className={`${TH} w-[300px] text-right`}>With it: outcomes per 100 decisions</th>
                      <th className={`${TH} w-[260px] text-right`}>Without it</th>
                      <th className={`${TH} w-[110px] text-right`}>Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.splits.map((s) => (
                      <tr key={s.tacticId} className="k-line-subtle border-b last:border-0" title={s.reason}>
                        <td className={TD}>
                          <span className="font-medium" title={s.tacticDescription}>
                            {s.tacticName}
                          </span>
                          {s.proposed && <span className="k-chip ml-2">Proposed</span>}
                        </td>
                        <td className={`${TDN} ${s.better === "inside" ? "font-medium" : ""}`}>
                          <SplitSide side={s.inside} />
                        </td>
                        <td className={`${TDN} ${s.better === "outside" ? "font-medium" : ""}`}>
                          <SplitSide side={s.outside} />
                        </td>
                        <td className={`${TDN} ${VERDICT_LOOK[s.verdict].cls}`}>{VERDICT_LOOK[s.verdict].label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
