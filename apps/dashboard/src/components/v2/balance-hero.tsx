"use client";

import { formatBillingCents, formatCentsAsUsd } from "@/lib/format-number";
import type { postpaidOwed } from "@/lib/v2/pay-balance";
import { InfoTooltip } from "@/components/visibility/metric-info";

/**
 * The Billing page's Balance: ONE figure answering the payment mode's question, its parts
 * on one stacked bar with a legend (owner 2026-10-29: four equal KPI cells read « le moins
 * clair du monde »). Postpaid reads like Google Ads, prepaid and a plan like the OpenAI /
 * Anthropic consoles. Draws what billing serves; computes no figure of its own.
 */

const PROVISIONED_TIP =
  "Held for follow-up emails already scheduled, not charged. Each email is billed at its real cost when it goes out. A hold for an email that never goes out is released.";

/** One part of a stacked balance bar. `hatched` = provisioned: held, not billed yet. */
type BarPart = { label: string; cents: number; color: string; hatched?: boolean; tip?: string };

const HATCH = (color: string) =>
  `repeating-linear-gradient(135deg, ${color} 0 3px, color-mix(in oklab, ${color} 45%, transparent) 3px 6px)`;

/** The parts side by side on one track. Widths are shares of `totalCents`; nothing is summed for display. */
function StackedBar({ parts, totalCents }: { parts: BarPart[]; totalCents: number }) {
  return (
    <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-[var(--data-track)]">
      {parts.map((part) =>
        part.cents > 0 && totalCents > 0 ? (
          <div
            key={part.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${Math.min(100, (part.cents / totalCents) * 100)}%`,
              background: part.hatched ? HATCH(part.color) : part.color,
            }}
          />
        ) : null,
      )}
    </div>
  );
}

function BarLegend({ parts }: { parts: BarPart[] }) {
  return (
    <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
      {parts.map((part) => (
        <li key={part.label} className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ background: part.hatched ? HATCH(part.color) : part.color }}
          />
          <span className="k-fg2">{part.label}</span>
          <span className="tabular-nums">{formatBillingCents(part.cents)}</span>
          {part.tip && <InfoTooltip tip={part.tip} placement="bottom" />}
        </li>
      ))}
    </ul>
  );
}

function HeroFigure({ label, value, after, chip }: { label: string; value: string; after?: string; chip?: string | null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="k-label">{label}</p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[32px] font-medium leading-9 tracking-[-0.02em] tabular-nums">{value}</span>
          {after && <span className="k-fg3 text-[13px] tabular-nums">{after}</span>}
        </p>
      </div>
      {chip && <span className="k-chip">{chip}</span>}
    </div>
  );
}

/**
 * Postpaid, Google Ads style: the current balance big, when the card is charged, and how far
 * the BILLED costs are toward the amount that charges it early. Only what is billed is ever
 * charged (owner 2026-10-29), so provisioned money is named beside the bar, not on it. No button.
 */
export function PostpaidOwedCard({
  owed,
  nextChargeDate,
  charging,
  cardName,
  provisionedCents,
  discountPct,
}: {
  owed: ReturnType<typeof postpaidOwed>;
  nextChargeDate: string;
  charging: boolean;
  cardName: string | null;
  provisionedCents: number | null;
  discountPct: number | null;
}) {
  if (owed.owedCents === null) {
    return (
      <div className="k-card p-4">
        <p className="k-fg3 text-[12px]">We could not read your balance right now.</p>
      </div>
    );
  }
  const line = charging && owed.creditLineCents !== null && owed.creditLineCents > 0 ? owed.creditLineCents : null;
  const billed: BarPart = { label: "Billed", cents: owed.owedCents, color: "var(--accent)" };
  // Provisioned is named beside the bar, never on it: only what is billed is charged,
  // early or at month end (owner 2026-10-29, option 1).
  const parts: BarPart[] =
    provisionedCents !== null && provisionedCents >= 0.5
      ? [billed, { label: "Provisioned", cents: provisionedCents, color: "var(--accent)", hatched: true, tip: PROVISIONED_TIP }]
      : [billed];
  return (
    <div className="k-card p-5">
      <HeroFigure
        label="Current balance"
        value={formatCentsAsUsd(owed.owedCents, 2)}
        chip={discountPct ? `${discountPct}% off usage` : null}
      />
      {charging && (
        <p className="k-fg2 mt-1 text-[13px] leading-5">
          {line !== null
            ? `Your next automatic payment is on ${nextChargeDate}, or sooner when your billed costs reach ${formatCentsAsUsd(line, 0)}.`
            : `Your next automatic payment is on ${nextChargeDate}.`}
          {cardName && ` Charged to your ${cardName}.`}
        </p>
      )}
      <div className="mt-5">
        {line !== null && (
          <div className="mb-2 flex items-baseline justify-between gap-3 text-[12px]">
            <span className="k-fg3">Billed so far</span>
            <span className="tabular-nums">
              {formatCentsAsUsd(owed.owedCents, 2)} <span className="k-fg3">of {formatCentsAsUsd(line, 0)}</span>
            </span>
          </div>
        )}
        {line !== null && <StackedBar parts={[billed]} totalCents={line} />}
        <BarLegend parts={parts} />
      </div>
    </div>
  );
}

/**
 * Prepaid and a monthly plan, OpenAI / Anthropic console style: the credit left big, then
 * where every credit added went (billed, provisioned, left). A balance below $0 (spent on
 * credit) says so in words; the parts still add up to what was added.
 */
export function CreditBalanceCard({
  availableCents,
  creditedCents,
  spentCents,
  provisionedCents,
  chargesCents,
  discountPct,
  nextPayment,
}: {
  availableCents: number;
  creditedCents: number;
  spentCents: number | null;
  provisionedCents: number | null;
  chargesCents: number;
  discountPct: number | null;
  /** What pays back a balance below $0: the next top-up (prepaid) or the plan's next payment. */
  nextPayment: string;
}) {
  // Below $0 (a run cost more than the credit left): credit left reads $0.00 and the
  // overage is stated with what pays it back (owner 2026-10-29: the old label read as unclear).
  const overCents = availableCents < 0 ? -availableCents : 0;
  const parts: BarPart[] =
    spentCents !== null && provisionedCents !== null
      ? [
          { label: "Billed", cents: spentCents, color: "var(--accent)" },
          { label: "Provisioned", cents: provisionedCents, color: "var(--accent)", hatched: true, tip: PROVISIONED_TIP },
          { label: "Left", cents: Math.max(0, availableCents), color: "var(--data-track)" },
        ]
      : [
          { label: "Billed", cents: chargesCents, color: "var(--accent)" },
          { label: "Left", cents: Math.max(0, availableCents), color: "var(--data-track)" },
        ];
  return (
    <div className="k-card p-5">
      <HeroFigure
        label="Credit left"
        value={formatBillingCents(Math.max(0, availableCents))}
        after={overCents === 0 && creditedCents > 0 ? `of ${formatBillingCents(creditedCents)} added` : undefined}
        chip={discountPct ? `${discountPct}% off usage` : null}
      />
      {overCents > 0 && (
        <p className="k-fg2 mt-1 text-[13px] leading-5">
          {formatBillingCents(overCents)} over your credit, taken from your {nextPayment}.
        </p>
      )}
      <div className="mt-5">
        <StackedBar parts={parts.filter((p) => p.label !== "Left")} totalCents={Math.max(creditedCents, chargesCents)} />
        <BarLegend parts={parts} />
      </div>
    </div>
  );
}
