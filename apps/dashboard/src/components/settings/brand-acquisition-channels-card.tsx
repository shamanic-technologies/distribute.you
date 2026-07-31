"use client";

import { useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { ChatTeardropTextIcon } from "@phosphor-icons/react/dist/csr/ChatTeardropText";
import type { Icon } from "@phosphor-icons/react";
import {
  canSelectChannel,
  initialSelectedChannelKeys,
  partitionChannelsBySelection,
  removeChannelBlockedReason,
  type AcquisitionChannelDef,
  type AcquisitionChannelKey,
} from "@/lib/acquisition-channels";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { BrandLogo } from "@/components/brand-logo";
import { MaturityBadge } from "@/components/maturity-badge";

// Where we go to find a brand's buyers. A channel feeds the sales funnels above:
// the same funnel can be fed by cold email today and by paid clicks later, so
// the two are separate lists rather than one.
//
// Nothing here writes yet. brand-service has no field for a channel selection,
// so a Save button would take eight choices and persist none of them. The card
// says it is a preview instead.
//
// Only cold email is live. The rest state that they are coming rather than
// offering a choice we cannot honour, and the last live channel cannot be
// dropped: a brand running no channel is a brand we cannot reach anyone for.

// Phosphor duotone for the channels that are ours: each mark carries a tinted
// fill under its stroke, so it fills its tile the way a real logo does. A
// channel on somebody else's platform wears that platform's logo instead.
const OWN_CHANNEL_ICONS: Partial<Record<AcquisitionChannelKey, Icon>> = {
  cold_email: EnvelopeSimpleIcon,
  cold_sms: ChatTeardropTextIcon,
};

export function BrandAcquisitionChannelsCard() {
  const isBeta = useIsBetaUser();

  const [selectedKeys, setSelectedKeys] = useState<AcquisitionChannelKey[]>(
    initialSelectedChannelKeys,
  );
  // The reason the last live channel could not be dropped, shown on its own row.
  // Clicking a control that does nothing and says nothing reads as broken.
  const [blocked, setBlocked] = useState<AcquisitionChannelKey | null>(null);

  function toggle(def: AcquisitionChannelDef) {
    if (!canSelectChannel(def)) return;
    setBlocked(null);
    setSelectedKeys((prev) => {
      if (!prev.includes(def.key)) return [...prev, def.key];
      if (removeChannelBlockedReason(def.key, prev) !== null) {
        setBlocked(def.key);
        return prev;
      }
      return prev.filter((k) => k !== def.key);
    });
  }

  if (!isBeta) return null;

  const { selected, unselected } = partitionChannelsBySelection((key) =>
    selectedKeys.includes(key),
  );

  function renderChannel(def: AcquisitionChannelDef) {
    const isSelected = selectedKeys.includes(def.key);
    const locked = !canSelectChannel(def);
    const dimmed = !isSelected;
    const OwnIcon = OWN_CHANNEL_ICONS[def.key];
    const blockedReason =
      blocked === def.key ? removeChannelBlockedReason(def.key, selectedKeys) : null;

    const mark =
      def.mark.kind === "vendor" ? (
        // A real provider logo is never tinted: the tile stays white so the
        // mark reads as the vendor's own.
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white ${
            dimmed ? "opacity-60" : ""
          }`}
        >
          <BrandLogo
            domain={def.mark.domain}
            size={24}
            className="rounded"
            fallbackClassName="text-gray-300"
          />
        </span>
      ) : (
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            def.mark.tone.iconBg
          } ${dimmed ? "opacity-60" : ""}`}
        >
          {OwnIcon && <OwnIcon size={26} weight="duotone" className={def.mark.tone.iconText} />}
        </span>
      );

    const body = (
      <div className="flex items-start gap-3 p-4">
        {mark}

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${
              locked ? "text-gray-400" : dimmed ? "text-gray-500" : "text-gray-900"
            }`}
          >
            {def.name}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{def.summary}</p>
          {blockedReason && <p className="mt-1 text-xs text-gray-400">{blockedReason}</p>}
        </div>

        {locked ? (
          <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
            Coming soon
          </span>
        ) : (
          isSelected && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              Selected
            </span>
          )
        )}
      </div>
    );

    return (
      <li
        key={def.key}
        className={`rounded-xl border transition ${
          isSelected ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50"
        }`}
      >
        {locked ? (
          <div className="cursor-not-allowed rounded-xl" aria-disabled>
            {body}
          </div>
        ) : (
          // The whole card is the affordance, the way a funnel card is. A span
          // with a button role rather than a <button>, so the row stays free to
          // hold its own controls once a channel has any.
          <div
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => toggle(def)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              toggle(def);
            }}
            // The hover has to differ from the card's own resting tint, or an
            // unselected card (already gray-50) shows no response to the cursor.
            className={`cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
              isSelected ? "hover:bg-gray-50" : "hover:bg-gray-100"
            }`}
          >
            {body}
          </div>
        )}
      </li>
    );
  }

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Acquisition Channels</h2>
        <MaturityBadge level="beta" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-1 text-sm text-gray-500">
          Where we go to find your buyers. Every channel feeds the funnels above.
        </p>
        <p className="mb-5 text-xs text-gray-400">Preview only. Nothing here is saved yet.</p>

        {selected.length > 0 && <ul className="space-y-3">{selected.map(renderChannel)}</ul>}

        {unselected.length > 0 && (
          <>
            {selected.length > 0 && (
              <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-gray-400">
                Not selected
              </p>
            )}
            <ul className="space-y-3">{unselected.map(renderChannel)}</ul>
          </>
        )}

        {selected.length === 0 && (
          <p className="mt-4 text-xs text-gray-400">
            Pick at least one channel so we have somewhere to reach your buyers.
          </p>
        )}
      </div>
    </section>
  );
}
