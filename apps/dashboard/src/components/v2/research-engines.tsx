"use client";

import { useSearchParams } from "next/navigation";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getPublicCatalogueSteps } from "@/lib/api";
import { formatRatePct } from "@/lib/pipe-stats";
import { formatUsdAdaptive } from "@/lib/format-number";
import { regretPct } from "@/lib/factory-shadow";
import { useResearchEnginePlaces } from "@/lib/research/research-source";
import { placesByCaller, replayFamiliesOf, selectedPlace, type EnginePlace, type EnginePlaces } from "@/lib/research/engine-places";

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
  return <CatalogueMark icon={step?.icon ?? null} name={step?.name ?? name} size={size} />;
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
          <Figure value={data.summary.places} />
        </StatTile>
        <StatTile label="Clear winners" note={`chance ${data.clearWinnerPct}% or more`}>
          <Figure value={data.summary.clearWinners} />
        </StatTile>
        <StatTile label="Live campaigns" note="read on the last Engine pass">
          <Figure value={data.summary.campaigns} />
        </StatTile>
        <StatTile label="Engines" note="one per outcome">
          <Figure value={data.engines.length} />
        </StatTile>
      </div>

      {data.places.length === 0 ? (
        <div className="k-card mt-6">
          <EmptyNote>The Engine has not picked for any live campaign yet.</EmptyNote>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
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
          <section id="research-place" className="min-w-0 scroll-mt-16">{selected && <PlaceDetail data={data} place={selected} />}</section>
        </div>
      )}

      <EngineCallers data={data} />
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
          {place.candidates.length} {place.candidates.length === 1 ? "workflow" : "workflows"} · {place.campaigns}{" "}
          {place.campaigns === 1 ? "campaign" : "campaigns"}
        </span>
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
                  <td className={TD}>{f.family}</td>
                  <td className={TDN}>{regretPct(f.todayRegret) ?? <span className="k-fg4">{"—"}</span>}</td>
                  <td className={TDN}>{regretPct(f.engineRegret) ?? <span className="k-fg4">{"—"}</span>}</td>
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
                  <th className={`${TH} text-right`}>Share of picks</th>
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
                      <td className={`${TDN} ${best && place.clearWinner ? "text-[var(--run)]" : ""}`}>{pct(c.sharePct)}</td>
                      <td className={TDN}>{pct(c.beliefRatePct)}</td>
                      <td className={TDN}>{c.costPerDecisionUsd == null ? <span className="k-fg4">{"—"}</span> : formatUsdAdaptive(c.costPerDecisionUsd)}</td>
                      <td className={TDN}>{c.fleetDecisions.toLocaleString("en-US")}</td>
                      <td className={TDN}>{c.fleetOutcomes.toLocaleString("en-US")}</td>
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
    <section className="mt-10">
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
