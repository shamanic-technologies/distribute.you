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
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/csr/CurrencyDollar";
import { CursorClickIcon } from "@phosphor-icons/react/dist/csr/CursorClick";
import { EnvelopeIcon } from "@phosphor-icons/react/dist/csr/Envelope";
import { FacebookLogoIcon } from "@phosphor-icons/react/dist/csr/FacebookLogo";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FlowArrowIcon } from "@phosphor-icons/react/dist/csr/FlowArrow";
import { FunnelIcon } from "@phosphor-icons/react/dist/csr/Funnel";
import { HandshakeIcon } from "@phosphor-icons/react/dist/csr/Handshake";
import { InstagramLogoIcon } from "@phosphor-icons/react/dist/csr/InstagramLogo";
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
import { UserCheckIcon } from "@phosphor-icons/react/dist/csr/UserCheck";
import { UserFocusIcon } from "@phosphor-icons/react/dist/csr/UserFocus";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { WavesIcon } from "@phosphor-icons/react/dist/csr/Waves";
import { YoutubeLogoIcon } from "@phosphor-icons/react/dist/csr/YoutubeLogo";
import { catalogueFaceSrc } from "@/lib/staff-catalogue";

/**
 * The served icon NAME of a catalogue object, drawn. features-service says Phosphor; a few
 * channels serve another set's name for the same picture (`mail`, `share-2`, `mic`), so both
 * spellings are listed. A pure display lookup: per-icon imports, never the ~190KB barrel.
 */
const CATALOGUE_ICONS: Record<string, Icon> = {
  "address-book": AddressBookIcon,
  "at-sign": AtIcon,
  award: MedalIcon,
  bell: BellIcon,
  bird: BirdIcon,
  "calendar-check": CalendarCheckIcon,
  "calendar-plus": CalendarPlusIcon,
  "chat-circle-text": ChatCircleTextIcon,
  "currency-dollar": CurrencyDollarIcon,
  "cursor-click": CursorClickIcon,
  envelope: EnvelopeIcon,
  facebook: FacebookLogoIcon,
  "file-text": FileTextIcon,
  filter: FunnelIcon,
  "flow-arrow": FlowArrowIcon,
  handshake: HandshakeIcon,
  "help-circle": QuestionIcon,
  instagram: InstagramLogoIcon,
  linkedin: LinkedinLogoIcon,
  list: ListBulletsIcon,
  mail: EnvelopeIcon,
  megaphone: MegaphoneIcon,
  "message-circle": ChatCircleIcon,
  "message-square": ChatTextIcon,
  mic: MicrophoneIcon,
  "note-pencil": NotePencilIcon,
  phone: PhoneIcon,
  "phone-call": PhoneCallIcon,
  radar: TargetIcon,
  search: MagnifyingGlassIcon,
  "share-2": ShareNetworkIcon,
  "shopping-cart": ShoppingCartIcon,
  "user-check": UserCheckIcon,
  "user-focus": UserFocusIcon,
  "user-plus": UserPlusIcon,
  users: UsersIcon,
  waves: WavesIcon,
  youtube: YoutubeLogoIcon,
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
  const Glyph = icon ? CATALOGUE_ICONS[icon] : undefined;
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
