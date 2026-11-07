"use client";

import { HandWavingIcon } from "@phosphor-icons/react/dist/csr/HandWaving";
import { CursorClickIcon } from "@phosphor-icons/react/dist/csr/CursorClick";
import { CalendarPlusIcon } from "@phosphor-icons/react/dist/csr/CalendarPlus";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { IdentificationBadgeIcon } from "@phosphor-icons/react/dist/csr/IdentificationBadge";
import { TextboxIcon } from "@phosphor-icons/react/dist/csr/Textbox";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/csr/CurrencyDollar";
import { ShoppingBagOpenIcon } from "@phosphor-icons/react/dist/csr/ShoppingBagOpen";
import { PhoneCallIcon } from "@phosphor-icons/react/dist/csr/PhoneCall";
import { UserFocusIcon } from "@phosphor-icons/react/dist/csr/UserFocus";
import { FilmSlateIcon } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneRight";
import { PencilSimpleLineIcon } from "@phosphor-icons/react/dist/csr/PencilSimpleLine";
import { BuildingsIcon } from "@phosphor-icons/react/dist/csr/Buildings";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { AtIcon } from "@phosphor-icons/react/dist/csr/At";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { UsersFourIcon } from "@phosphor-icons/react/dist/csr/UsersFour";
import { MonitorPlayIcon } from "@phosphor-icons/react/dist/csr/MonitorPlay";
import { ArticleIcon } from "@phosphor-icons/react/dist/csr/Article";
import { SmileyIcon } from "@phosphor-icons/react/dist/csr/Smiley";
import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { QueueIcon } from "@phosphor-icons/react/dist/csr/Queue";
import { ArrowBendUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowBendUpLeft";
import { XLogoIcon } from "@phosphor-icons/react/dist/csr/XLogo";
import { LinkedinLogoIcon } from "@phosphor-icons/react/dist/csr/LinkedinLogo";
import { ChatCenteredTextIcon } from "@phosphor-icons/react/dist/csr/ChatCenteredText";
import { CheckSquareIcon } from "@phosphor-icons/react/dist/csr/CheckSquare";
import { CheckSquareOffsetIcon } from "@phosphor-icons/react/dist/csr/CheckSquareOffset";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { PencilLineIcon } from "@phosphor-icons/react/dist/csr/PencilLine";
import { ChatCenteredDotsIcon } from "@phosphor-icons/react/dist/csr/ChatCenteredDots";
import { ThreadsLogoIcon } from "@phosphor-icons/react/dist/csr/ThreadsLogo";
import { MailboxIcon } from "@phosphor-icons/react/dist/csr/Mailbox";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { TrayIcon } from "@phosphor-icons/react/dist/csr/Tray";
import { ArrowBendDoubleUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowBendDoubleUpLeft";
import { FlagIcon } from "@phosphor-icons/react/dist/csr/Flag";
import type { Icon } from "@phosphor-icons/react";
import {
  stepMarkFor,
  stepMarkForLeadStage,
  STEP_TONE,
  UNDRAWN_STEP_GLYPH,
  type StepGlyph,
} from "@/lib/step-marks";

// The tile that stands for ONE STEP, wherever a step is named. Keyed
// on the glyph token so the catalogue (`lib/step-marks.ts`) stays a plain
// unit-testable module with no icon import. Imported per-icon from `dist/csr/<Name>`:
// the package root is a ~190KB barrel.

const STEP_ICONS: Record<StepGlyph, Icon> = {
  "hand-waving": HandWavingIcon,
  "cursor-click": CursorClickIcon,
  "calendar-plus": CalendarPlusIcon,
  "users-three": UsersThreeIcon,
  "identification-badge": IdentificationBadgeIcon,
  textbox: TextboxIcon,
  clipboard: ClipboardTextIcon,
  "currency-dollar": CurrencyDollarIcon,
  "shopping-bag-open": ShoppingBagOpenIcon,
  "phone-call": PhoneCallIcon,
  "user-focus": UserFocusIcon,
  "film-slate": FilmSlateIcon,
  "paper-plane-tilt": PaperPlaneTiltIcon,
  "paper-plane-right": PaperPlaneRightIcon,
  "pencil-simple-line": PencilSimpleLineIcon,
  "buildings": BuildingsIcon,
  "shield-check": ShieldCheckIcon,
  "at": AtIcon,
  "device-mobile": DeviceMobileIcon,
  "identification-card": IdentificationCardIcon,
  "users-four": UsersFourIcon,
  "monitor-play": MonitorPlayIcon,
  "article": ArticleIcon,
  "smiley": SmileyIcon,
  "eye": EyeIcon,
  "heart": HeartIcon,
  "queue": QueueIcon,
  "arrow-bend-up-left": ArrowBendUpLeftIcon,
  "x-logo": XLogoIcon,
  "linkedin-logo": LinkedinLogoIcon,
  "chat-centered-text": ChatCenteredTextIcon,
  "check-square": CheckSquareIcon,
  "check-square-offset": CheckSquareOffsetIcon,
  "pencil-simple": PencilSimpleIcon,
  "pencil-line": PencilLineIcon,
  "chat-centered-dots": ChatCenteredDotsIcon,
  "threads-logo": ThreadsLogoIcon,
  "mailbox": MailboxIcon,
  "whatsapp-logo": WhatsappLogoIcon,
  "robot": RobotIcon,
  "tray": TrayIcon,
  "arrow-bend-double-up-left": ArrowBendDoubleUpLeftIcon,
  flag: FlagIcon,
};

type MarkSize = "xs" | "sm" | "md";

// Byte-equal to the leg and channel marks, so a step drawn beside any of them
// reads as one vocabulary.
const TILE: Record<MarkSize, string> = {
  xs: "h-[18px] w-[18px] rounded",
  sm: "h-8 w-8 rounded-lg",
  md: "h-11 w-11 rounded-xl",
};
const GLYPH: Record<MarkSize, number> = { xs: 12, sm: 18, md: 26 };

export function StepMark({
  stepKey,
  stageKey,
  size = "sm",
  dimmed = false,
}: {
  /** The producer's step token. */
  stepKey?: string | null;
  /** A lead-panel stage key instead, mapped onto the step vocabulary. */
  stageKey?: string | null;
  size?: MarkSize;
  dimmed?: boolean;
}) {
  const key = stepKey ?? stageKey;
  if (!key) return null;
  const drawn = stepKey != null ? stepMarkFor(stepKey) : stepMarkForLeadStage(stageKey);
  // Every outcome MUST wear a tile (owner 2026-11-07): one the catalogue has not drawn yet
  // gets the neutral flag, and the gap is logged so it gets its own glyph.
  if (!drawn) console.error(`[StepMark] no glyph for outcome "${key}": add it to lib/step-marks.ts`);
  const mark = drawn ?? { glyph: UNDRAWN_STEP_GLYPH, tone: STEP_TONE };
  const StepIcon = STEP_ICONS[mark.glyph];
  return (
    <span
      className={`tone-tile flex shrink-0 items-center justify-center ${TILE[size]} ${
        mark.tone.iconBg
      } ${dimmed ? "opacity-60" : ""}`}
    >
      <StepIcon size={GLYPH[size]} weight="duotone" className={mark.tone.iconText} />
    </span>
  );
}
