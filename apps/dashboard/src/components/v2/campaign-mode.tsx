"use client";

import { useEffect } from "react";
import type { Icon } from "@phosphor-icons/react";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { ChatCircleDotsIcon } from "@phosphor-icons/react/dist/csr/ChatCircleDots";
import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { CursorClickIcon } from "@phosphor-icons/react/dist/csr/CursorClick";
import { HandshakeIcon } from "@phosphor-icons/react/dist/csr/Handshake";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { ThumbsUpIcon } from "@phosphor-icons/react/dist/csr/ThumbsUp";
import { UserFocusIcon } from "@phosphor-icons/react/dist/csr/UserFocus";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { campaignModeFor, type LegCatalogue } from "@/lib/legs";

/**
 * The Phosphor glyph for a trigger's served icon token (features-service `triggers[].icon`).
 * Keyed on the TOKEN, never on the trigger: the producer picks the icon, this only draws
 * the Phosphor names it can import one by one. A token missing here draws no icon (the
 * label alone) and logs, never a guessed glyph.
 */
const TRIGGER_ICONS: Record<string, Icon> = {
  "user-focus": UserFocusIcon,
  "magnifying-glass": MagnifyingGlassIcon,
  "thumbs-up": ThumbsUpIcon,
  "chat-circle-dots": ChatCircleDotsIcon,
  "chats-circle": ChatsCircleIcon,
  "cursor-click": CursorClickIcon,
  "calendar-check": CalendarCheckIcon,
  handshake: HandshakeIcon,
  "user-plus": UserPlusIcon,
  "clipboard-text": ClipboardTextIcon,
};

/**
 * How a campaign runs (owner 2026-10-09): "Proactive" (it works against its budget), or
 * "Reactive · <icon> <trigger>" (it runs when its trigger fires: a campaign asking for a
 * lead, a positive reply...). Mode and trigger are features-service's catalogue; until it
 * has answered, the campaign row's own served `reactive` names the mode without a trigger.
 */
export function CampaignModeChip({
  catalogue,
  featureSlug,
  legKey,
  reactive,
}: {
  catalogue: LegCatalogue;
  featureSlug: string;
  legKey: string;
  reactive: boolean;
}) {
  const served = campaignModeFor(catalogue, featureSlug, legKey);
  const trigger = served?.mode === "reactive" ? served.trigger : null;
  const Glyph = trigger?.icon ? TRIGGER_ICONS[trigger.icon] : undefined;
  const mode = served ? served.mode : reactive ? "reactive" : "proactive";
  const missingIcon = !!trigger?.icon && !Glyph;
  const missingTrigger = served?.mode === "reactive" && !trigger;
  useEffect(() => {
    if (missingIcon) console.error("[campaign-mode] trigger icon token not mapped", trigger);
    if (missingTrigger) console.error("[campaign-mode] reactive leg names no trigger the catalogue carries", { featureSlug, legKey });
  }, [missingIcon, missingTrigger, trigger, featureSlug, legKey]);

  if (mode === "proactive") return <span className="k-chip">Proactive</span>;
  return (
    <span className="k-chip whitespace-nowrap" title={trigger?.description ?? undefined}>
      Reactive
      {trigger && (
        <>
          <span className="k-fg3">·</span>
          {Glyph && <Glyph size={13} weight="duotone" aria-hidden className="shrink-0" />}
          {trigger.label}
        </>
      )}
    </span>
  );
}
