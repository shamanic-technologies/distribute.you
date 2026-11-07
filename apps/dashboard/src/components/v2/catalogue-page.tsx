"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { ApiError, getPublicCatalogueSteps, listActiveScripts, listCatalogueStrategies, listCatalogueTactics, type PublicCatalogueStep } from "@/lib/api";
import {
  CATALOGUE_TABS,
  CATALOGUE_TAB_LABELS,
  catalogueTabOf,
  dynastyHeads,
  dynastyName,
  enginesOf,
  type CatalogueTab,
  type Engine,
  type Script,
} from "@/lib/v2/catalogue";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { RecordsTabs } from "@/components/v2/records";
import { EmptyNote, MarkLines, Shimmer, TopBar } from "@/components/v2/ui";

/**
 * The Catalogue (owner 2026-11-07, every client; the GTM Factory preview's page): what the factory is made of. Outcomes,
 * one Engine per outcome, the scripts competing inside each Engine, the tactics that describe them and the strategies
 * a campaign's brief picks. Every row is served; this page only groups and names.
 */
const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const TD = "px-3 py-2 align-top first:pl-4 last:pr-4";
const CATALOGUE_REFRESH_MS = 60_000;
const options = { staleTime: CATALOGUE_REFRESH_MS, refetchInterval: CATALOGUE_REFRESH_MS, retry: false } as const;

export function CataloguePage() {
  const search = useSearchParams();
  const [tab, setTab] = useState<CatalogueTab>(() => catalogueTabOf(search.get("tab")));
  const steps = useAuthQuery(["publicCatalogueSteps"], getPublicCatalogueSteps, { staleTime: 10 * 60_000 });
  const scripts = useAuthQuery(["catalogueScripts"], listActiveScripts, options);
  const tactics = useAuthQuery(["catalogueTactics"], listCatalogueTactics, options);
  const strategies = useAuthQuery(["catalogueStrategies"], listCatalogueStrategies, options);

  const stepList = steps.data ?? null;
  const engines = scripts.data && stepList ? enginesOf(scripts.data, stepList.map((s) => s.key)) : null;
  const heads = scripts.data ? dynastyHeads(scripts.data) : null;
  const counts: Record<CatalogueTab, number | null> = {
    outcomes: stepList?.length ?? null,
    engines: engines?.length ?? null,
    scripts: heads?.length ?? null,
    tactics: tactics.data?.total ?? null,
    strategies: strategies.data?.total ?? null,
  };
  const pick = (t: string) => {
    const next = catalogueTabOf(t);
    setTab(next);
    // `null` state: Next keeps useSearchParams in sync (apps/dashboard/CLAUDE.md).
    window.history.replaceState(null, "", `?tab=${next}`);
  };
  const stepOf = (key: string) => stepList?.find((s) => s.key === key) ?? null;

  return (
    <div>
      <TopBar crumbs={[{ label: "Catalogue" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pt-6 md:px-6">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">
          {engines && heads ? `${engines.length} Engine${engines.length === 1 ? "" : "s"}, ${heads.length} script${heads.length === 1 ? "" : "s"} competing` : <Shimmer className="h-8 w-80" />}
        </h1>
        <p className="k-fg2 mb-5 mt-1 text-[14px]">Every outcome has one Engine. Inside it, scripts compete to make it at the best price.</p>
      </div>
      <div className="mx-auto max-w-[1280px]">
        <RecordsTabs tabs={CATALOGUE_TABS.map((t) => ({ key: t, label: CATALOGUE_TAB_LABELS[t], count: counts[t] }))} active={tab} onPick={pick} />
      </div>
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-5 md:px-6">
        {tab === "outcomes" && (
          <Settled q={steps} what="outcomes">
            {stepList && <Outcomes steps={stepList} engines={engines} />}
          </Settled>
        )}
        {tab === "engines" && (
          <Settled q={scripts} what="Engines">
            {engines && <Engines engines={engines} stepOf={stepOf} />}
          </Settled>
        )}
        {tab === "scripts" && (
          <Settled q={scripts} what="scripts">
            {engines && <Scripts engines={engines} stepOf={stepOf} />}
          </Settled>
        )}
        {tab === "tactics" && (
          <Settled q={tactics} what="tactics">
            {tactics.data && <Tactics rows={tactics.data.rows} total={tactics.data.total} />}
          </Settled>
        )}
        {tab === "strategies" && (
          <Settled q={strategies} what="strategies">
            {strategies.data && <Strategies rows={strategies.data.rows} total={strategies.data.total} />}
          </Settled>
        )}
      </div>
    </div>
  );
}

/** Shimmer rows until the read answered once; a refusal or failure is one plain line, never a crash. */
function Settled({ q, what, children }: { q: { data?: unknown; isError: boolean; error: Error | null }; what: string; children: React.ReactNode }) {
  if (q.data !== undefined) return <>{children}</>;
  if (q.isError) {
    console.error(`[v2] catalogue: ${what} unreadable`, q.error);
    const refused = q.error instanceof ApiError && (q.error.status === 401 || q.error.status === 403);
    return (
      <div className="k-card">
        <EmptyNote>{refused ? `${what[0].toUpperCase()}${what.slice(1)} show here soon.` : `We could not read the ${what} right now. Retrying.`}</EmptyNote>
      </div>
    );
  }
  return (
    <div className="k-card overflow-hidden">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="k-row flex h-12 items-center px-4">
          <Shimmer className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function Table({ head, children, footer }: { head: React.ReactNode; children: React.ReactNode; footer?: string }) {
  return (
    <div className="k-card overflow-hidden">
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="k-line-subtle border-b">{head}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer && <div className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px] tabular-nums">{footer}</div>}
    </div>
  );
}

function StepName({ step, fallback }: { step: PublicCatalogueStep | null; fallback: string }) {
  if (!step) console.error("[v2] catalogue: outcome missing from the public step catalogue", { key: fallback });
  const name = step?.name ?? fallback;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <CatalogueMark icon={step?.icon ?? null} name={name} size={20} />
      <span className="truncate">{name}</span>
    </span>
  );
}

function Outcomes({ steps, engines }: { steps: PublicCatalogueStep[]; engines: Engine[] | null }) {
  return (
    <Table
      footer="An outcome is one thing a campaign can get. Each one is made by its own Engine."
      head={
        <>
          <th className={TH}>Outcome</th>
          <th className={`${TH} text-right`}>Scripts competing</th>
        </>
      }
    >
      {steps.map((s) => {
        const engine = engines?.find((e) => e.outcome === s.key);
        return (
          <tr key={s.key} className="k-row k-line-subtle border-b last:border-b-0">
            <td className={TD}>
              <span className="flex items-center gap-2.5">
                <CatalogueMark icon={s.icon} name={s.name} size={24} />
                <span className="font-medium">{s.name}</span>
              </span>
            </td>
            <td className={`${TD} text-right tabular-nums`}>
              {engines == null ? <Shimmer className="ml-auto h-4 w-6" /> : engine ? engine.heads.length : <span className="k-fg4">—</span>}
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

function Engines({ engines, stepOf }: { engines: Engine[]; stepOf: (k: string) => PublicCatalogueStep | null }) {
  if (engines.length === 0) return <div className="k-card"><EmptyNote>No Engine runs a script yet.</EmptyNote></div>;
  return (
    <Table
      footer="One Engine per outcome. It makes a new one with the best of the scripts competing inside it."
      head={
        <>
          <th className={TH}>Engine</th>
          <th className={TH}>Asks for</th>
          <th className={`${TH} text-right`}>Scripts</th>
        </>
      }
    >
      {engines.map((e) => {
        const step = stepOf(e.outcome);
        return (
          <tr key={e.outcome} className="k-row k-line-subtle border-b last:border-b-0">
            <td className={`${TD} whitespace-nowrap font-medium`}>
              <StepName step={step} fallback={e.outcome} />
            </td>
            <td className={TD}>
              <span className="flex flex-wrap gap-1">
                {e.materials.length === 0 ? <span className="k-fg4">—</span> : e.materials.map((m) => <span key={m} className="k-chip">{stepOf(m)?.name ?? m}</span>)}
              </span>
            </td>
            <td className={`${TD} text-right tabular-nums`}>{e.heads.length}</td>
          </tr>
        );
      })}
    </Table>
  );
}

function Scripts({ engines, stepOf }: { engines: Engine[]; stepOf: (k: string) => PublicCatalogueStep | null }) {
  if (engines.length === 0) return <div className="k-card"><EmptyNote>No script runs yet.</EmptyNote></div>;
  return (
    <div className="space-y-8">
      {engines.map((e) => (
        <section key={e.outcome}>
          <div className="mb-3 flex items-baseline gap-1.5 text-[14px] font-medium">
            <StepName step={stepOf(e.outcome)} fallback={e.outcome} />
            <span className="k-fg3 font-normal tabular-nums">{e.heads.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {e.heads.map((s) => (
              <ScriptCard key={s.id} s={s} icon={stepOf(e.outcome)?.icon ?? null} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** A script wears its Engine's outcome mark (no script icon is served). */
function ScriptCard({ s, icon }: { s: Script; icon: string | null }) {
  const name = dynastyName(s.dynasty);
  return (
    <div className="k-card flex min-w-0 flex-col p-4">
      <MarkLines mark={(px) => <CatalogueMark icon={icon} name={name} size={px} />}>
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium">{name}</span>
          <span className="k-chip shrink-0 tabular-nums">v{s.version}</span>
        </span>
        <span className="k-fg3 block truncate text-[12px]">{s.replay ? `Replayed ${s.replay.matches} of ${s.replay.cases} real cases` : "New, no real case to replay yet"}</span>
      </MarkLines>
      <p className="k-fg2 mt-3 line-clamp-3 text-[13px] leading-5" title={s.description}>
        {s.description || <span className="k-fg4">—</span>}
      </p>
      {s.vendors.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {s.vendors.map((v) => (
            <span key={v} className="k-chip">
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Tactics({ rows, total }: { rows: Array<{ id: string; name: string; description: string; clientLine?: string | null }>; total: number }) {
  if (rows.length === 0) return <div className="k-card"><EmptyNote>No tactic yet.</EmptyNote></div>;
  return (
    <Table
      footer={rows.length < total ? `${rows.length} of ${total} tactics. A tactic is a yes or no fact about a script, judged by an AI.` : "A tactic is a yes or no fact about a script, judged by an AI."}
      head={
        <>
          <th className={TH}>Tactic</th>
          <th className={`${TH} w-full`}>What it means</th>
        </>
      }
    >
      {rows.map((t) => (
        <tr key={t.id} className="k-row k-line-subtle border-b last:border-b-0">
          <td className={`${TD} whitespace-nowrap font-medium`}>{t.name}</td>
          <td className={`${TD} k-fg2`}>{t.clientLine ?? t.description}</td>
        </tr>
      ))}
    </Table>
  );
}

function Strategies({ rows, total }: { rows: Array<{ id: string; name: string; description: string; requires: Array<{ id: string; name: string }>; excludes: Array<{ id: string; name: string }> }>; total: number }) {
  if (rows.length === 0) return <div className="k-card"><EmptyNote>No strategy yet.</EmptyNote></div>;
  return (
    <Table
      footer={rows.length < total ? `${rows.length} of ${total} strategies. A campaign's brief keeps one strategy per Engine.` : "A campaign's brief keeps one strategy per Engine."}
      head={
        <>
          <th className={TH}>Strategy</th>
          <th className={TH}>Keeps scripts that</th>
          <th className={TH}>Leaves out scripts that</th>
        </>
      }
    >
      {rows.map((s) => (
        <tr key={s.id} className="k-row k-line-subtle border-b last:border-b-0">
          <td className={TD}>
            <span className="block font-medium">{s.name}</span>
            <span className="k-fg3 block max-w-[420px] text-[12px]">{s.description}</span>
          </td>
          <td className={TD}>
            <Chips items={s.requires} />
          </td>
          <td className={TD}>
            <Chips items={s.excludes} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

function Chips({ items }: { items: Array<{ id: string; name: string }> }) {
  if (items.length === 0) return <span className="k-fg4">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span key={i.id} className="k-chip">
          {i.name}
        </span>
      ))}
    </span>
  );
}
