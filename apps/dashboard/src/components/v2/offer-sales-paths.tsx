"use client";

import { useState } from "react";
import { SectionTitle, Shimmer, EmptyNote } from "@/components/v2/ui";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import {
  formatRatePct,
  pathTitle,
  rateSourceLabel,
  roiUnavailableLabel,
  salesPathsEmptyReason,
  type OfferSalesPaths,
  type SalesPathLeg,
  type SalesPathRow,
} from "@/lib/offer-sales-paths";

const usd = (v: number | null | undefined) => (v == null ? "—" : formatUsdAdaptive(v));

/**
 * An offer's sales paths (beta), in the order features-service ranked them (ROI,
 * best first). A row opens to say WHY it has that ROI: each leg's retained rate and
 * its source, the channel that works it and what it costs, and the lifetime revenue
 * divided by. Every figure is served; this draws and never sorts or divides.
 */
export function OfferSalesPaths({
  data,
  pending,
  failed,
}: {
  data: OfferSalesPaths | undefined;
  pending: boolean;
  failed: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const paths = data?.paths ?? [];

  return (
    <section>
      <SectionTitle count={data ? paths.length : null}>Sales paths</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">
        Every way the ticked legs reach a paying client, best return first. Open one to see why.
      </p>
      {pending ? (
        <div className="space-y-2">
          <Shimmer className="h-12 rounded-[10px]" />
          <Shimmer className="h-12 rounded-[10px]" />
        </div>
      ) : failed && !data ? (
        <EmptyNote>Could not read this offer&apos;s sales paths.</EmptyNote>
      ) : data && salesPathsEmptyReason(data.status) ? (
        <EmptyNote>{salesPathsEmptyReason(data.status)}</EmptyNote>
      ) : (
        <ul className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
          {paths.map((p) => (
            <PathRow
              key={p.pathKey}
              path={p}
              open={open === p.pathKey}
              onToggle={() => setOpen(open === p.pathKey ? null : p.pathKey)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PathRow({ path, open, onToggle }: { path: SalesPathRow; open: boolean; onToggle: () => void }) {
  const unavailable = roiUnavailableLabel(path.roiUnavailableReason);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="k-row flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
      >
        <span className="k-fg3 w-6 shrink-0 text-[12px] tabular-nums">#{path.rank}</span>
        <span className="min-w-0 flex-1 text-[13px] font-medium">{pathTitle(path)}</span>
        <span className="k-fg2 text-[12px] tabular-nums">
          {usd(path.costPerPayingClientUsd)} per paying client
        </span>
        <span
          className={`w-16 text-right text-[13px] font-semibold tabular-nums ${roiIsGood(path.roi) ? "text-[var(--run)]" : ""}`}
          title={unavailable ?? undefined}
        >
          {formatRoi(path.roi)}
        </span>
      </button>
      {open && <PathBreakdown path={path} />}
    </li>
  );
}

function PathBreakdown({ path }: { path: SalesPathRow }) {
  const unavailable = roiUnavailableLabel(path.roiUnavailableReason);
  return (
    <div className="k-inset space-y-3 px-4 pb-4 pt-1">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12px]">
          <thead className="k-fg3 text-left">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Leg</th>
              <th className="py-1.5 pr-3 font-medium">Rate kept</th>
              <th className="py-1.5 pr-3 font-medium">Source</th>
              <th className="py-1.5 pr-3 font-medium">Worked by</th>
              <th className="py-1.5 text-right font-medium">Cost per paying client</th>
            </tr>
          </thead>
          <tbody>
            {path.legs.map((l) => (
              <LegLine key={l.legKey} leg={l} />
            ))}
          </tbody>
        </table>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-4">
        <div>
          <dt className="k-fg3">From entry to paying client</dt>
          <dd className="tabular-nums">{formatRatePct(path.entryToPayingClientPct)}</dd>
        </div>
        <div>
          <dt className="k-fg3">Lifetime revenue kept</dt>
          <dd className="tabular-nums">{usd(path.lifetimeRevenueUsd)}</dd>
        </div>
        <div>
          <dt className="k-fg3">Cost per paying client</dt>
          <dd className="tabular-nums">{usd(path.costPerPayingClientUsd)}</dd>
        </div>
        <div>
          <dt className="k-fg3">ROI</dt>
          <dd className="tabular-nums">{unavailable ?? formatRoi(path.roi)}</dd>
        </div>
      </dl>
    </div>
  );
}

function LegLine({ leg }: { leg: SalesPathLeg }) {
  const from = leg.fromStep?.label ?? "Start";
  const inputs = leg.rateInputs;
  const { measured } = inputs ?? { measured: null };
  const { ratePct: measuredPct, toReached, fromReached } = measured ?? {};
  const detail = inputs
    ? [
        measuredPct != null
          ? `measured ${formatRatePct(measuredPct)} (${toReached ?? 0} of ${fromReached ?? 0})`
          : null,
        inputs.customerStatedPct != null ? `stated ${formatRatePct(inputs.customerStatedPct)}` : null,
        inputs.fleetMedian.ratePct != null
          ? `median ${formatRatePct(inputs.fleetMedian.ratePct)} over ${inputs.fleetMedian.brandCount} brands`
          : null,
        inputs.industryDefaultPct != null ? `benchmark ${formatRatePct(inputs.industryDefaultPct)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const worker =
    leg.workedBy === "human"
      ? "Your team"
      : leg.channel?.name
        ? `${leg.channel.name}${leg.costPerOutcomeUsd != null ? ` · ${usd(leg.costPerOutcomeUsd)} each` : ""}`
        : "No channel priced";
  return (
    <tr className="border-t border-[var(--line-subtle)] align-top">
      <td className="py-1.5 pr-3">
        {from} <span className="k-fg3">→</span> {leg.toStep.label}
      </td>
      <td className="py-1.5 pr-3 tabular-nums">{leg.fromStep ? formatRatePct(leg.conversionRatePct) : "—"}</td>
      <td className="py-1.5 pr-3">
        <div>{leg.fromStep ? rateSourceLabel(leg.rateSource) : "Entry"}</div>
        {detail && <div className="k-fg3 text-[11px]">{detail}</div>}
      </td>
      <td className="py-1.5 pr-3">{worker}</td>
      <td className="py-1.5 text-right tabular-nums">{leg.workedBy === "human" ? "—" : usd(leg.costPerPayingClientUsd)}</td>
    </tr>
  );
}
