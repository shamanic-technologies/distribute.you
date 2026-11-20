"use client";

import type { Icon } from "@phosphor-icons/react";
// Duotone-only twins of the Phosphor icons (each Phosphor module ships six weights; MON-PAGE-SPEED-FLOOR-1120).
import {
  AddressBookIcon,
  AtIcon,
  BellIcon,
  BirdIcon,
  CalendarCheckIcon,
  CalendarPlusIcon,
  ChatCircleIcon,
  ChatCircleTextIcon,
  ChatTextIcon,
  CircleIcon,
  ClipboardTextIcon,
  CurrencyDollarIcon,
  CursorClickIcon,
  EnvelopeIcon,
  FacebookLogoIcon,
  FileTextIcon,
  FlowArrowIcon,
  FunnelIcon,
  HandHeartIcon,
  HandshakeIcon,
  InstagramLogoIcon,
  LightningIcon,
  LinkedinLogoIcon,
  ListBulletsIcon,
  MagnifyingGlassIcon,
  MedalIcon,
  MegaphoneIcon,
  MicrophoneIcon,
  NotePencilIcon,
  PhoneIcon,
  PhoneCallIcon,
  QuestionIcon,
  ShareNetworkIcon,
  ShoppingCartIcon,
  TargetIcon,
  ThumbsUpIcon,
  UserCheckIcon,
  UserFocusIcon,
  UserPlusIcon,
  UsersIcon,
  WavesIcon,
  YoutubeLogoIcon,
  PencilSimpleLineIcon,
  SealCheckIcon,
  SmileyIcon,
  UsersThreeIcon,
  BrowserIcon,
  SparkleIcon,
  EnvelopeSimpleIcon,
  HandWavingIcon,
  ThreadsLogoIcon,
  TrayIcon,
  VideoCameraIcon,
  LinkIcon,
  ChatCircleDotsIcon,
  QueueIcon,
  EnvelopeOpenIcon,
  NewspaperIcon,
  CheckCircleIcon,
  WhatsappLogoIcon,
  XLogoIcon,
} from "@/components/v2/duotone-icons";
import { catalogueFaceSrc } from "@/lib/staff-catalogue";
import { MARK_ICONS } from "@/components/v2/catalogue-mark-icons";

/**
 * The served icon NAME of a catalogue object, drawn. features-service serves Phosphor names only
 * (v0.179.116); this lists the ones it serves today. A pure display lookup: per-icon imports, never
 * the ~190KB barrel. A name not listed is logged once and drawn as a plain circle.
 */
const CATALOGUE_ICONS: Record<string, Icon> = {
  "link": LinkIcon,
  "chat-circle-dots": ChatCircleDotsIcon,
  "queue": QueueIcon,
  "envelope-open": EnvelopeOpenIcon,
  "newspaper": NewspaperIcon,
  "check-circle": CheckCircleIcon,
  "whatsapp-logo": WhatsappLogoIcon,
  "x-logo": XLogoIcon,
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
  tray: TrayIcon,
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
