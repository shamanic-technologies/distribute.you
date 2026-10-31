"use client";

import type { Icon } from "@phosphor-icons/react";
import { AddressBookIcon } from "@phosphor-icons/react/dist/csr/AddressBook";
import { AtIcon } from "@phosphor-icons/react/dist/csr/At";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { BirdIcon } from "@phosphor-icons/react/dist/csr/Bird";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { CalendarPlusIcon } from "@phosphor-icons/react/dist/csr/CalendarPlus";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { ChatCircleTextIcon } from "@phosphor-icons/react/dist/csr/ChatCircleText";
import { ChatTextIcon } from "@phosphor-icons/react/dist/csr/ChatText";
import { CircleIcon } from "@phosphor-icons/react/dist/csr/Circle";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/csr/CurrencyDollar";
import { CursorClickIcon } from "@phosphor-icons/react/dist/csr/CursorClick";
import { EnvelopeIcon } from "@phosphor-icons/react/dist/csr/Envelope";
import { FacebookLogoIcon } from "@phosphor-icons/react/dist/csr/FacebookLogo";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FlowArrowIcon } from "@phosphor-icons/react/dist/csr/FlowArrow";
import { FunnelIcon } from "@phosphor-icons/react/dist/csr/Funnel";
import { HandHeartIcon } from "@phosphor-icons/react/dist/csr/HandHeart";
import { HandshakeIcon } from "@phosphor-icons/react/dist/csr/Handshake";
import { InstagramLogoIcon } from "@phosphor-icons/react/dist/csr/InstagramLogo";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { LinkedinLogoIcon } from "@phosphor-icons/react/dist/csr/LinkedinLogo";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { MedalIcon } from "@phosphor-icons/react/dist/csr/Medal";
import { MegaphoneIcon } from "@phosphor-icons/react/dist/csr/Megaphone";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { NotePencilIcon } from "@phosphor-icons/react/dist/csr/NotePencil";
import { PhoneIcon } from "@phosphor-icons/react/dist/csr/Phone";
import { PhoneCallIcon } from "@phosphor-icons/react/dist/csr/PhoneCall";
import { QuestionIcon } from "@phosphor-icons/react/dist/csr/Question";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { ShoppingCartIcon } from "@phosphor-icons/react/dist/csr/ShoppingCart";
import { TargetIcon } from "@phosphor-icons/react/dist/csr/Target";
import { ThumbsUpIcon } from "@phosphor-icons/react/dist/csr/ThumbsUp";
import { UserCheckIcon } from "@phosphor-icons/react/dist/csr/UserCheck";
import { UserFocusIcon } from "@phosphor-icons/react/dist/csr/UserFocus";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { WavesIcon } from "@phosphor-icons/react/dist/csr/Waves";
import { YoutubeLogoIcon } from "@phosphor-icons/react/dist/csr/YoutubeLogo";
import { catalogueFaceSrc } from "@/lib/staff-catalogue";
import { PencilSimpleLineIcon } from "@phosphor-icons/react/dist/csr/PencilSimpleLine";
import { SealCheckIcon } from "@phosphor-icons/react/dist/csr/SealCheck";
import { SmileyIcon } from "@phosphor-icons/react/dist/csr/Smiley";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { BrowserIcon } from "@phosphor-icons/react/dist/csr/Browser";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { HandWavingIcon } from "@phosphor-icons/react/dist/csr/HandWaving";
import { ThreadsLogoIcon } from "@phosphor-icons/react/dist/csr/ThreadsLogo";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/csr/VideoCamera";
import { MARK_ICONS } from "@/components/v2/catalogue-mark-icons";

/**
 * The served icon NAME of a catalogue object, drawn. features-service serves Phosphor names only
 * (v0.179.116); this lists the ones it serves today. A pure display lookup: per-icon imports, never
 * the ~190KB barrel. A name not listed is logged once and drawn as a plain circle.
 */
const CATALOGUE_ICONS: Record<string, Icon> = {
  "pencil-simple-line": PencilSimpleLineIcon,
  "seal-check": SealCheckIcon,
  "smiley": SmileyIcon,
  "users-three": UsersThreeIcon,
  "video-camera": VideoCameraIcon,
  "address-book": AddressBookIcon,
  at: AtIcon,
  bell: BellIcon,
  bird: BirdIcon,
  "calendar-check": CalendarCheckIcon,
  "calendar-plus": CalendarPlusIcon,
  "chat-circle": ChatCircleIcon,
  "chat-circle-text": ChatCircleTextIcon,
  "chat-text": ChatTextIcon,
  "clipboard-text": ClipboardTextIcon,
  "currency-dollar": CurrencyDollarIcon,
  "cursor-click": CursorClickIcon,
  envelope: EnvelopeIcon,
  "facebook-logo": FacebookLogoIcon,
  "file-text": FileTextIcon,
  "flow-arrow": FlowArrowIcon,
  funnel: FunnelIcon,
  "hand-heart": HandHeartIcon,
  handshake: HandshakeIcon,
  "instagram-logo": InstagramLogoIcon,
  lightning: LightningIcon,
  "linkedin-logo": LinkedinLogoIcon,
  "list-bullets": ListBulletsIcon,
  "magnifying-glass": MagnifyingGlassIcon,
  medal: MedalIcon,
  megaphone: MegaphoneIcon,
  microphone: MicrophoneIcon,
  "note-pencil": NotePencilIcon,
  phone: PhoneIcon,
  "phone-call": PhoneCallIcon,
  question: QuestionIcon,
  "share-network": ShareNetworkIcon,
  "shopping-cart": ShoppingCartIcon,
  target: TargetIcon,
  "thumbs-up": ThumbsUpIcon,
  "user-check": UserCheckIcon,
  "user-focus": UserFocusIcon,
  "user-plus": UserPlusIcon,
  users: UsersIcon,
  waves: WavesIcon,
  "youtube-logo": YoutubeLogoIcon,
  // Channel icons the public catalogue serves (P5.1: the channel list is read from it).
  browser: BrowserIcon,
  sparkle: SparkleIcon,
  "envelope-simple": EnvelopeSimpleIcon,
  "hand-waving": HandWavingIcon,
  "threads-logo": ThreadsLogoIcon,
};

const warned = new Set<string>();

/**
 * One catalogue object's mark: a funnel's served FACE, else its served icon in a tile, tinted
 * in the served colour where the object has one (paths, pipes, workflows), quiet otherwise.
 */
export function CatalogueMark({
  icon,
  color,
  face,
  name,
  size = 28,
}: {
  icon?: string | null;
  color?: string | null;
  face?: string | null;
  name: string;
  size?: number;
}) {
  const src = catalogueFaceSrc(face);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full bg-[var(--bg-inset)] shadow-[inset_0_0_0_1px_var(--line)]"
        style={{ width: size, height: size }}
      />
    );
  }
  // A workflow or template mark (MARKS-1022) reads the served mark vocabulary too.
  const Glyph = icon ? (CATALOGUE_ICONS[icon] ?? MARK_ICONS[icon]) : undefined;
  if (icon && !Glyph && !warned.has(icon)) {
    warned.add(icon);
    console.error("[v2] catalogue icon not drawn here yet", { icon, name });
  }
  const G = Glyph ?? CircleIcon;
  const tinted = !!color && /^#[0-9a-f]{6}$/i.test(color);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${size <= 18 ? "rounded-[5px]" : "rounded-[8px]"} ${
        tinted ? "" : "bg-[var(--bg-inset)] text-[var(--fg-2)] shadow-[inset_0_0_0_1px_var(--line)]"
      }`}
      style={{
        width: size,
        height: size,
        ...(tinted ? { background: `${color}24`, color: color as string } : {}),
      }}
    >
      <G size={Math.round(size * 0.6)} weight="duotone" />
    </span>
  );
}
