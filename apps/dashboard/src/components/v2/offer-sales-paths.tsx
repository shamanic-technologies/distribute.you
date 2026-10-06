"use client";

import { useState, type ReactNode } from "react";
import { SectionTitle, Shimmer, EmptyNote } from "@/components/v2/ui";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { salesPathAvatarSrc } from "@/lib/sales-path-avatars";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { formatUsdAdaptive } from "@/lib/format-number";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { LEG_RATE_RULE, parseRateInput, roundLegRatePct } from "@/lib/brand-conversion-rates";
import {
  formatRatePct,
  pathLinks,
  costSourceLabel,
  EXPECTED_COST_PER_CLIENT_TIP,
  EXPECTED_ROI_TIP,
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
  intro = "Every way the ticked legs reach a paying client, best return first. Open one to see why.",
  bare = false,
  gainHeadline = false,
  selected,
  onToggleSelected,
  onStateRate,
  onStateLifetimeRevenue,
}: {
  /** The paths the customer ticked (combinationKey), and the tick. */
  selected?: ReadonlySet<string>;
  onToggleSelected?: (combinationKey: string, on: boolean) => void;
  data: OfferSalesPaths | undefined;
  pending: boolean;
  failed: boolean;
  intro?: string;
  /** No section title and no intro line (the onboarding states its own question). */
  bare?: boolean;
  /**
   * The table headlines the gain (the return), never a cost: a selling surface (the
   * onboarding) talks gain, and the cost stays in the detail a row opens.
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
        <PathsTable
          paths={paths}
          open={open}
          setOpen={setOpen}
          gainHeadline={gainHeadline}
          selected={selected}
          onToggleSelected={onToggleSelected}
          onStateRate={onStateRate}
          onStateLifetimeRevenue={onStateLifetimeRevenue}
        />
      )}
    </section>
  );
}
/** A column label whose figures are expected values, with the (i) saying so. */
export function ExpectedLabel({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <InfoTooltip tip={tip} placement="bottom" />
    </span>
  );
}

/** Paths shown before "Show N more". */
const TABLE_SHOWN = 20;

/**
 * The Sales path page's view: a table in the served order, each row ticked or not (the
 * Legs checkbox), the ticked ones on the accent fill; a row opens its breakdown.
 */
function PathsTable({
  paths,
  open,
  setOpen,
  gainHeadline,
  selected,
  onToggleSelected,
  onStateRate,
  onStateLifetimeRevenue,
}: {
  paths: SalesPathRow[];
  open: string | null;
  setOpen: (key: string | null) => void;
  gainHeadline: boolean;
  selected?: ReadonlySet<string>;
  onToggleSelected?: (combinationKey: string, on: boolean) => void;
  onStateRate?: (leg: SalesPathLeg, ratePct: number | null) => Promise<void>;
  onStateLifetimeRevenue?: (usd: number) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? paths : paths.slice(0, TABLE_SHOWN);
  // A phone reads the path and its return: the cost column waits for a wider screen
  // (it stays in the detail a row opens), and the path wraps instead of scrolling.
  const cols = gainHeadline ? 3 : 4;
  return (
    <div className="k-card overflow-hidden">
      <div className="k-scroll overflow-x-auto">
        <table className="w-full text-[13px] sm:min-w-[640px]">
          <thead>
            <tr className="k-line-subtle border-b">
              <th className="k-label w-10 px-3 py-2.5 pl-4 text-left font-normal">
                <span className="sr-only">Selected</span>
              </th>
              <th className="k-label px-3 py-2.5 text-left font-normal">Path</th>
              {!gainHeadline && (
                <th className="k-label hidden px-3 py-2.5 text-right font-normal sm:table-cell">
                  <ExpectedLabel tip={EXPECTED_COST_PER_CLIENT_TIP}>Cost per paying client</ExpectedLabel>
                </th>
              )}
              <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">
                <ExpectedLabel tip={EXPECTED_ROI_TIP}>{gainHeadline ? "Return" : "ROI"}</ExpectedLabel>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const isOpen = open === p.combinationKey;
              const on = selected?.has(p.combinationKey) ?? false;
              const unavailable = roiUnavailableLabel(p.roiUnavailableReason);
              return [
                <tr
                  key={p.combinationKey}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : p.combinationKey)}
                  className={`k-row cursor-pointer ${on ? "bg-[var(--accent-soft)]" : ""} ${isOpen ? "" : "k-line-subtle border-b"}`}
                >
                  <td className="px-3 py-2 pl-4">
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={on ? "Untick this path" : "Tick this path"}
                      disabled={!onToggleSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelected?.(p.combinationKey, !on);
                      }}
                      className="-m-1 inline-flex h-6 w-6 items-center justify-center"
                    >
                      <span
                        aria-hidden
                        className={`inline-flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] text-white ${on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--line-strong)]"}`}
                      >
                        {on ? "✓" : ""}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <PathLinks path={p} />
                  </td>
                  {!gainHeadline && (
                    <td className="k-fg2 hidden px-3 py-2 text-right tabular-nums sm:table-cell">{usd(p.costPerPayingClientUsd)}</td>
                  )}
                  <td
                    className={`whitespace-nowrap px-3 py-2 pr-4 text-right align-top font-semibold tabular-nums ${roiIsGood(p.roi) ? "text-[var(--run)]" : ""}`}
                    title={unavailable ?? undefined}
                  >
                    {formatRoi(p.roi)}
                  </td>
                </tr>,
                isOpen ? (
                  <tr key={`${p.combinationKey}-detail`} className="k-line-subtle border-b">
                    <td colSpan={cols} className="p-0">
                      <PathBreakdown path={p} onStateRate={onStateRate} onStateLifetimeRevenue={onStateLifetimeRevenue} />
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>
      {paths.length > shown.length && (
        <div className="k-fg3 flex items-center justify-between px-4 py-2.5 text-[12px] tabular-nums">
          <span>
            {shown.length} of {paths.length}
          </span>
          <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setShowAll(true)}>
            Show {paths.length - shown.length} more
          </button>
        </div>
      )}
    </div>
  );
}

/** The combination's face; a name nobody drew a face for yet shows its initial and says so. */
export function PathAvatar({ name, size }: { name: string; size: number }) {
  const src = salesPathAvatarSrc(name);
  if (!src) {
    console.error(`[offer-sales-paths] no avatar drawn for sales path "${name}": add one under public/sales-path-avatars`);
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="k-inset k-fg2 inline-flex shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
      >
        {name.slice(0, 1)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full" style={{ width: size, height: size }} />;
}

/** The path leg by leg: each channel of ours as a chip with its mark (as on Channels), then the step its leg lands on. */
export function PathLinks({ path }: { path: SalesPathRow }) {
  const parts = pathLinks(path);
  const channels = useAcquisitionChannels();
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-x-1.5">
          {i > 0 && <span className="k-fg3">→</span>}
          {part.kind === "channel" ? (
            <ChannelChip
              name={part.name}
              def={channels.find((c) => c.featureSlug === part.slug)}
              notRun={part.managed === false}
            />
          ) : (
            <span>{part.label}</span>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * A channel tag: its mark (once the channel list has answered), then its served name. A
 * channel we do not run yet is drawn muted, its mark dimmed.
 */
export function ChannelChip({
  name,
  def,
  notRun,
  compact = false,
}: {
  name: string;
  def: Parameters<typeof AcquisitionChannelMark>[0]["def"] | undefined;
  notRun: boolean;
  /** 11px on an 18px chip, for a line that must hold on one row (keel.css is unlayered, so a Tailwind size would lose). */
  compact?: boolean;
}) {
  return (
    <span
      className={`k-chip ${notRun ? "k-fg3" : ""}`}
      style={compact ? { fontSize: 11, height: 18, gap: 4, padding: "0 5px" } : undefined}
      title={notRun ? "We don't run this channel yet" : undefined}
    >
      {def && <AcquisitionChannelMark def={def} size="xs" dimmed={notRun} />}
      {name}
    </span>
  );
}

export function PathBreakdown({
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
              <th className="py-1.5 text-right font-medium">
                <ExpectedLabel tip={EXPECTED_COST_PER_CLIENT_TIP}>Cost per paying client</ExpectedLabel>
              </th>
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
  // A your-team-* channel (catalogue scope) is human AND priced on the team's time.
  const worker =
    leg.workedBy === "human" && !leg.channel?.name
      ? "Your team"
      : leg.channel?.name
        ? `${leg.channel.name}${leg.costPerOutcomeUsd != null ? ` · ${usd(leg.costPerOutcomeUsd)} each` : ""}`
        : "No channel priced";
  const costSource = costSourceLabel(leg.costSource);
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
      <td className="py-1.5 pr-3">
        <div>{worker}</div>
        {costSource && (
          <div className="k-fg3 text-[11px]" title={leg.channel?.costBenchmarkSource ?? undefined}>
            {costSource}
            {leg.channel?.managed === false ? " · not run by us yet" : ""}
          </div>
        )}
      </td>
      <td className="py-1.5 text-right tabular-nums">{usd(leg.costPerPayingClientUsd)}</td>
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
