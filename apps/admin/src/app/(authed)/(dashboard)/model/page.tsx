"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicChannelCatalogue, getPublicChannelFunnelEconomics } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { fmtRoi, fmtUsd } from "@/lib/feature-stats-format";
import {
  MODEL_OBJECTS,
  buildMatrixRows,
  channelFamilyLabel,
  channelOperatorLabel,
  funnelCatalogueFrom,
  summariseCells,
  unmeasuredReasonLabel,
  unpricedStepLabel,
  type MatrixCell,
} from "@/lib/acquisition-model";

/**
 * A commercial per-day TERM, not a charge. Same reading as a daily budget: a
 * figure we set in whole dollars, where cents would be noise.
 */
function wholeUsd(cents: number | null): string {
  if (cents === null) return "—";
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/**
 * The model.
 *
 * One page for the question "what are all these objects, and which of them can
 * actually be sold together". The top band is documentation (nobody publishes a
 * map of the fleet). Everything below it is READ from features-service, so a
 * channel or a funnel that ships upstream appears here the same day rather than
 * whenever someone remembers to update a copy.
 */
export default function ModelPage() {
  const catalogue = useQuery({
    queryKey: ["publicChannelCatalogue"],
    queryFn: getPublicChannelCatalogue,
    ...pollOptionsSlower,
  });

  const economics = useQuery({
    queryKey: ["publicChannelFunnelEconomics"],
    queryFn: getPublicChannelFunnelEconomics,
    ...pollOptionsSlower,
  });

  const channels = useMemo(() => catalogue.data?.channels ?? [], [catalogue.data]);
  const funnels = useMemo(() => funnelCatalogueFrom(channels), [channels]);
  const rows = useMemo(
    () => buildMatrixRows(channels, funnels, economics.data?.pairs ?? []),
    [channels, funnels, economics.data],
  );

  const [family, setFamily] = useState<string | null>(null);
  const families = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) if (row.family) seen.add(row.family);
    return [...seen];
  }, [rows]);
  const visibleRows = family ? rows.filter((r) => r.family === family) : rows;
  const summary = useMemo(() => summariseCells(visibleRows), [visibleRows]);

  // Reveal on SETTLE, never on success: a read that errors falls through to an
  // empty table stating what failed, rather than skeletoning the page forever.
  const catalogueLoading = catalogue.isPending && !catalogue.isError;
  const economicsLoading = economics.isPending && !economics.isError;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">The model</h1>
        <p className="mt-1 text-sm text-gray-500 max-w-3xl">
          Everything a customer buys is one pair: a sales funnel, bought through an acquisition
          channel. A channel states the first signal it can produce, a funnel states the signal it
          starts on, and the pairs that can be sold fall out of the two. The first table is
          documentation; everything under it is read live from features-service.
        </p>
      </header>

      {/* 1. the objects */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Objects</h2>
          <p className="mt-1 text-sm text-gray-500">
            What each thing is and which service owns it. Asking any other service gets you a copy.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-2 font-medium">Object</th>
                <th className="px-4 py-2 font-medium">What it is</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium">Key</th>
                <th className="px-4 py-2 font-medium">Hangs off</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_OBJECTS.map((obj) => (
                <tr key={obj.name} className="border-b border-gray-50 align-top">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{obj.name}</td>
                  <td className="px-4 py-3 text-gray-600">{obj.what}</td>
                  <td className="px-4 py-3 text-gray-600">{obj.owner}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{obj.key}</td>
                  <td className="px-4 py-3 text-gray-600">{obj.relatesTo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. the two vocabularies that join */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Steps</h2>
            <p className="mt-1 text-sm text-gray-500">
              Every step a chain can pass through. A channel states which one it moves a lead
              FROM and which one it moves it TO, and that leg is what joins it to a funnel.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {catalogueLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full rounded" />
                ))}
              </div>
            ) : (catalogue.data?.steps ?? []).length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                Couldn&apos;t read the step vocabulary.
              </p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {(catalogue.data?.steps ?? []).map((step) => (
                  <li key={step.key} className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{step.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                    <p className="text-[11px] text-gray-400 font-mono mt-1">{step.key}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Sales funnels</h2>
            <p className="mt-1 text-sm text-gray-500">
              Every chain on sale, and the signal it starts on. A funnel no channel can start is not
              listed, because nothing can sell it.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {catalogueLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full rounded" />
                ))}
              </div>
            ) : funnels.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No funnel is on sale.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {funnels.map((funnel) => (
                  <li key={funnel.key} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900">{funnel.name}</p>
                      <p className="text-xs text-gray-400 shrink-0">
                        {funnel.channelCount} channel{funnel.channelCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{funnel.steps.join("  →  ")}</p>
                    <p className="text-[11px] text-gray-400 font-mono mt-1">{funnel.key}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* 3. the channels */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Acquisition channels{rows.length > 0 ? ` (${rows.length})` : ""}
            </h2>
            <p className="mt-1 text-sm text-gray-500 max-w-3xl">
              What each channel costs to operate for a day whatever the volume, the shortest booking
              we sell, and the upper bound we promise before it starts producing.
            </p>
          </div>
          {families.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFamily(null)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  family === null
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                All
              </button>
              {families.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFamily(f)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    family === f
                      ? "border-brand-200 bg-brand-50 text-brand-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {channelFamilyLabel(f)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-2 font-medium">Channel</th>
                <th className="px-4 py-2 font-medium">Family</th>
                <th className="px-4 py-2 font-medium text-right">Per day</th>
                <th className="px-4 py-2 font-medium text-right">Min booking</th>
                <th className="px-4 py-2 font-medium text-right">Producing within</th>
                <th className="px-4 py-2 font-medium">Leg</th>
                <th className="px-4 py-2 font-medium">Run by</th>
                <th className="px-4 py-2 font-medium text-right">Funnels</th>
              </tr>
            </thead>
            <tbody>
              {catalogueLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-3" colSpan={8}>
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={8}>
                    {catalogue.isError
                      ? "Couldn't read the channel catalogue."
                      : "No channel in this family."}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.slug} className="border-b border-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{row.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {channelFamilyLabel(row.family)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                      {wholeUsd(row.dailyOperatingCostCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                      {row.minimumCommitmentDays === null ? "—" : `${row.minimumCommitmentDays}d`}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                      {row.maxDaysToFirstProduction === null ? "—" : `${row.maxDaysToFirstProduction}d`}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.legLabels.length === 0 ? "—" : row.legLabels.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {channelOperatorLabel(row.operatedBy)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.sellableFunnelCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. what can be sold together, and what it is worth */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Which pairs can be sold</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-3xl">
            One row per channel, one column per funnel. A measured pair states its return per dollar
            and what one sale costs through it; a pair we cannot price says which ingredient is
            missing rather than showing a figure nobody should read.
          </p>
          {!catalogueLoading && !economicsLoading && summary.sellable > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {summary.sellable} pair{summary.sellable === 1 ? "" : "s"} can be sold today, and{" "}
              {summary.measured === 0 ? "none of them are" : `${summary.measured} of them are`}{" "}
              measured.
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-2 font-medium">Channel</th>
                {funnels.map((funnel) => (
                  <th key={funnel.key} className="px-4 py-2 font-medium text-right">
                    {funnel.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalogueLoading || economicsLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-3" colSpan={funnels.length + 1}>
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-sm text-gray-400"
                    colSpan={Math.max(funnels.length + 1, 2)}
                  >
                    {catalogue.isError
                      ? "Couldn't read the channel catalogue."
                      : "No channel in this family."}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.slug} className="border-b border-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{row.slug}</p>
                    </td>
                    {row.cells.map((cell, i) => (
                      <td key={funnels[i].key} className="px-4 py-3 text-right align-top">
                        <PairCell cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">
          A blank cell means the channel produces no signal this funnel starts on, so the pair does
          not exist. Hover a cell that states no figure to read why.
        </p>
      </section>
    </div>
  );
}

/**
 * One cell of the matrix. Each of the four states says a different thing, and
 * they must not collapse into one dash: "cannot be sold", "nobody has spent
 * here", "the economics read has no row for it" and "here is the price" are
 * four different answers.
 */
function PairCell({ cell }: { cell: MatrixCell }) {
  if (cell.kind === "not_sellable") {
    return (
      <span className="text-gray-300" title="This channel produces no signal this funnel starts on.">
        ·
      </span>
    );
  }
  if (cell.kind === "unknown") {
    return (
      <span
        className="text-xs text-gray-400"
        title="The economics read carries no row for this pair."
      >
        Not answered
      </span>
    );
  }
  if (cell.kind === "unmeasured") {
    return (
      <span className="text-xs text-gray-400" title={unmeasuredReasonLabel(cell.reason)}>
        Not measured
      </span>
    );
  }
  const unpriced = cell.steps.find((s) => s.costPerStepUsd === null);
  return (
    <div>
      <p className="font-medium text-gray-900">{fmtRoi(cell.returnPerDollar)}</p>
      <p className="text-[11px] text-gray-400">{fmtUsd(cell.costPerSaleUsd)} per sale</p>
      {unpriced && (
        <p
          className="text-[11px] text-gray-400 mt-0.5"
          title={unpricedStepLabel(unpriced.unpricedReason)}
        >
          {unpriced.step} unpriced
        </p>
      )}
    </div>
  );
}
