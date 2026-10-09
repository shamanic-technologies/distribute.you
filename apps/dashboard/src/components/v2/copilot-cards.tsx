"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { RocketIcon } from "@phosphor-icons/react/dist/csr/Rocket";
import { TargetIcon } from "@phosphor-icons/react/dist/csr/Target";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { TrayIcon } from "@phosphor-icons/react/dist/csr/Tray";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/csr/CurrencyDollar";
import { ArrowBendUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowBendUpLeft";
import { SparkLine } from "@/components/v2/ui";
import { formatCentsAsUsdAdaptive } from "@/lib/format-number";
import type { CopilotChoice, CopilotChoices, CopilotVisual } from "@/lib/copilot";

/**
 * The Copilot's answer cards (chat-service `present_choices`): large, one decision each, like
 * the onboarding steps (owner 2026-10-09). A card carries a mark (icon or logo), a big served
 * number, or a tiny served series; the model names the icon, this file draws it.
 */

type PhIcon = ComponentType<{ size?: number; weight?: "duotone" | "regular"; className?: string }>;

// The icon names the system prompt offers the model, and two plain synonyms.
const ICONS: Record<string, PhIcon> = {
  mail: EnvelopeSimpleIcon,
  email: EnvelopeSimpleIcon,
  users: UsersIcon,
  people: UsersIcon,
  wallet: WalletIcon,
  chart: ChartLineUpIcon,
  rocket: RocketIcon,
  target: TargetIcon,
  calendar: CalendarBlankIcon,
  inbox: TrayIcon,
  settings: GearSixIcon,
  sparkles: SparkleIcon,
  check: CheckCircleIcon,
  search: MagnifyingGlassIcon,
  money: CurrencyDollarIcon,
  dollar: CurrencyDollarIcon,
  reply: ArrowBendUpLeftIcon,
};

function Mark({ visual }: { visual: CopilotVisual }) {
  if (visual.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={visual.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-[10px] object-contain" />;
  }
  if (visual.type !== "icon") return null;
  const Icon = ICONS[visual.icon.toLowerCase()];
  if (!Icon) {
    console.warn("[copilot] the model named an icon the dashboard does not draw", visual.icon);
    return null;
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-hover)] text-[var(--accent)]">
      <Icon size={20} weight="duotone" />
    </span>
  );
}

/**
 * A served money figure arrives in cents (the prompt asks for unit "cents"): printed the way
 * every dashboard page prints money, never the raw integer (chat-service probe 2026-10-09 put
 * "-4562.3548513207 cents balance" on a card).
 */
function figureOf(value: number | string, unit: string | undefined): { value: string; unit?: string } {
  if (unit?.toLowerCase() === "cents") {
    const n = Number(value);
    if (Number.isFinite(n)) return { value: formatCentsAsUsdAdaptive(n) };
    console.error("[copilot] a cents figure that is not a number", value);
  }
  return { value: String(value), unit };
}

function Card({ c, onPick, disabled }: { c: CopilotChoice; onPick: (c: CopilotChoice) => void; disabled: boolean }) {
  const v = c.visual;
  const figure = v?.type === "number" || v?.type === "chart";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(c)}
      className="k-card group flex min-h-[72px] w-full flex-col gap-2 px-4 py-3 text-left transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--bg-hover)] active:scale-[0.98] disabled:opacity-50"
    >
      {v?.type === "number" && (() => {
        const f = figureOf(v.value, v.unit);
        return (
          <span className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-medium leading-8 tracking-[-0.02em] tabular-nums">{f.value}</span>
            {f.unit && <span className="k-fg2 text-[13px]">{f.unit}</span>}
          </span>
        );
      })()}
      {v?.type === "chart" && (
        <span className="flex items-end gap-2">
          <SparkLine values={v.series} className="h-9" />
          {v.unit && <span className="k-fg3 shrink-0 text-[12px]">{v.unit.toLowerCase() === "cents" ? "$" : v.unit}</span>}
        </span>
      )}
      <span className="flex w-full items-center gap-3">
        {v && !figure && <Mark visual={v} />}
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium leading-5">{c.label}</span>
          {c.description && <span className="k-fg2 mt-0.5 block text-[13px] leading-5">{c.description}</span>}
        </span>
        <span aria-hidden="true" className="k-fg3 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </button>
  );
}

export function ChoiceCards({
  set,
  onPick,
  disabled,
}: {
  set: CopilotChoices;
  onPick: (c: CopilotChoice) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-4">
      {set.question && <p className="k-fg2 mb-2 text-[13px]">{set.question}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {set.choices.map((c) => (
          <Card key={`${c.label}|${c.value}`} c={c} onPick={onPick} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

/** A page the model opened on the right, kept in the thread so the reader can reopen it. */
export function OpenedPage({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="k-chip my-1 inline-flex gap-1.5 hover:text-[var(--fg-1)]">
      <span aria-hidden="true">↗</span>
      {label}
    </Link>
  );
}
