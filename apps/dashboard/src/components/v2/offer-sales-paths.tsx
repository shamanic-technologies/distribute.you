"use client";

import { useState } from "react";
import { SectionTitle, Shimmer, EmptyNote } from "@/components/v2/ui";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import { LEG_RATE_RULE, parseRateInput, roundLegRatePct } from "@/lib/brand-conversion-rates";
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
  highlightPathKey = null,
  highlightLabel = "What we launch first",
  intro = "Every way the ticked legs reach a paying client, best return first. Open one to see why.",
  bare = false,
  gainHeadline = false,
  onStateRate,
  onStateLifetimeRevenue,
}: {
  data: OfferSalesPaths | undefined;
  pending: boolean;
  failed: boolean;
  /** The path framed as the one launched first (the onboarding states it). */
  highlightPathKey?: string | null;
  highlightLabel?: string;
  intro?: string;
  /** No section title and no intro line (the onboarding states its own question). */
  bare?: boolean;
  /**
   * A row headlines the gain (return and lifetime revenue), never a cost: a selling
   * surface (the onboarding) talks gain, and the cost stays in the detail a row opens.
   */
  gainHeadline?: boolean;
  /** When given, each leg between two steps takes a typed rate (whole percent) or null to clear it. */
  onStateRate?: (leg: SalesPathLeg, ratePct: number | null) => Promise<void>;
  /** When given, the lifetime revenue in a path's detail is editable (whole dollars). */
  onStateLifetimeRevenue?: (usd: number) => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const paths = data?.paths ?? [];

  return (
    <section>
      {!bare && <SectionTitle count={data ? paths.length : null}>Sales paths</SectionTitle>}
      {!bare && intro && <p className="k-fg2 -mt-1 mb-3 text-[13px]">{intro}</p>}
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
              highlight={p.pathKey === highlightPathKey ? highlightLabel : null}
              gainHeadline={gainHeadline}
              onStateRate={onStateRate}
              onStateLifetimeRevenue={onStateLifetimeRevenue}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PathRow({
  path,
  open,
  onToggle,
  highlight,
  gainHeadline,
  onStateRate,
  onStateLifetimeRevenue,
}: {
  path: SalesPathRow;
  open: boolean;
  onToggle: () => void;
  highlight: string | null;
  gainHeadline: boolean;
  onStateRate?: (leg: SalesPathLeg, ratePct: number | null) => Promise<void>;
  onStateLifetimeRevenue?: (usd: number) => Promise<void>;
}) {
  const unavailable = roiUnavailableLabel(path.roiUnavailableReason);
  return (
    // The frame sits inside the list with a margin and its own radius, so all four
    // corners show (an inset ring on a square row is clipped by the list's rounding).
    <li className={highlight ? "m-1.5 rounded-[8px] bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]" : undefined}>
      {highlight && (
        <p className="k-accent-text px-4 pt-2.5 text-[11.5px] font-semibold uppercase tracking-wide">{highlight}</p>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="k-row flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
      >
        <span className="k-fg3 w-6 shrink-0 text-[12px] tabular-nums">#{path.rank}</span>
        <span className="min-w-0 flex-1 text-[13px] font-medium">{pathTitle(path)}</span>
        <span className="k-fg2 text-[12px] tabular-nums">
          {gainHeadline ? `${usd(path.lifetimeRevenueUsd)} per client won` : `${usd(path.costPerPayingClientUsd)} per paying client`}
        </span>
        <span
          className={`${gainHeadline ? "min-w-16" : "w-16"} text-right text-[13px] font-semibold tabular-nums ${roiIsGood(path.roi) ? "text-[var(--run)]" : ""}`}
          title={unavailable ?? undefined}
        >
          {path.roi == null ? formatRoi(path.roi) : gainHeadline ? `${formatRoi(path.roi)} return` : `${formatRoi(path.roi)} ROI`}
        </span>
      </button>
      {open && <PathBreakdown path={path} onStateRate={onStateRate} onStateLifetimeRevenue={onStateLifetimeRevenue} />}
    </li>
  );
}

function PathBreakdown({
  path,
  onStateRate,
  onStateLifetimeRevenue,
}: {
  path: SalesPathRow;
  onStateRate?: (leg: SalesPathLeg, ratePct: number | null) => Promise<void>;
  onStateLifetimeRevenue?: (usd: number) => Promise<void>;
}) {
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
              <LegLine key={l.legKey} leg={l} onStateRate={onStateRate} />
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
          <dd className="tabular-nums">
            {onStateLifetimeRevenue ? (
              <LifetimeRevenueEditor value={path.lifetimeRevenueUsd} onSave={onStateLifetimeRevenue} />
            ) : (
              usd(path.lifetimeRevenueUsd)
            )}
          </dd>
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

function LegLine({
  leg,
  onStateRate,
}: {
  leg: SalesPathLeg;
  onStateRate?: (leg: SalesPathLeg, ratePct: number | null) => Promise<void>;
}) {
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
      <td className="py-1.5 pr-3 tabular-nums">
        {!leg.fromStep ? "—" : onStateRate ? <RateEditor leg={leg} onStateRate={onStateRate} /> : formatRatePct(leg.conversionRatePct)}
      </td>
      <td className="py-1.5 pr-3">
        <div>{leg.fromStep ? rateSourceLabel(leg.rateSource) : "Entry"}</div>
        {detail && <div className="k-fg3 text-[11px]">{detail}</div>}
      </td>
      <td className="py-1.5 pr-3">{worker}</td>
      <td className="py-1.5 text-right tabular-nums">{leg.workedBy === "human" ? "—" : usd(leg.costPerPayingClientUsd)}</td>
    </tr>
  );
}

/**
 * The rate a leg is priced on, overwritable in place. Saving states the brand's own rate
 * for the leg (brand-service, shared by every offer); the paths are then re-ranked by
 * features-service. An empty field clears the statement. Whole percents.
 */
function RateEditor({
  leg,
  onStateRate,
}: {
  leg: SalesPathLeg;
  onStateRate: (leg: SalesPathLeg, ratePct: number | null) => Promise<void>;
}) {
  const shown = leg.conversionRatePct == null ? "" : String(roundLegRatePct(leg.conversionRatePct));
  const [value, setValue] = useState(shown);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = value.trim() !== shown;
  async function save() {
    const parsed = parseRateInput(value);
    if (parsed === undefined) {
      setError(LEG_RATE_RULE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onStateRate(leg, parsed);
    } catch (e) {
      console.error("[offer-sales-paths] rate save failed", e);
      setError("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input
        className="k-input h-6 w-12 px-1.5 text-right tabular-nums"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty) void save();
        }}
        aria-label={`Conversion rate from ${leg.fromStep?.label ?? "start"} to ${leg.toStep.label}, in percent`}
        disabled={busy}
      />
      <span className="k-fg3">%</span>
      {dirty && (
        <button type="button" className="k-btn h-6 px-2 text-[11.5px]" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </button>
      )}
      {error && <span className="w-full text-[11px] text-[var(--data-rose)]">{error}</span>}
    </span>
  );
}

/** What a client is worth, overwritable in a path's detail (whole dollars); the paths re-rank after. */
function LifetimeRevenueEditor({ value, onSave }: { value: number | null; onSave: (usd: number) => Promise<void> }) {
  const shown = value == null ? "" : String(Math.round(value));
  const [text, setText] = useState(shown);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = text.trim() !== shown;
  async function save() {
    const t = text.trim().replace(/^\$/, "").replace(/,/g, "");
    if (!/^\d+$/.test(t) || Number(t) <= 0) {
      setError("Whole dollars, above 0.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(Number(t));
    } catch (e) {
      console.error("[offer-sales-paths] lifetime revenue save failed", e);
      setError("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="k-fg3">$</span>
      <input
        className="k-input h-6 w-20 px-1.5 text-right tabular-nums"
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty) void save();
        }}
        aria-label="Lifetime revenue of one client, in dollars"
        disabled={busy}
      />
      {dirty && (
        <button type="button" className="k-btn h-6 px-2 text-[11.5px]" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </button>
      )}
      {error && <span className="w-full text-[11px] text-[var(--data-rose)]">{error}</span>}
    </span>
  );
}
