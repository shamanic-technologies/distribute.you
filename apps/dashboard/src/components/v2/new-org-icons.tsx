"use client";

/**
 * The small icon on a proposal card in the "New organization" modal (an offer, an
 * audience segment). The producers pick it from a CLOSED vocabulary of Phosphor icon
 * names in kebab-case (`globe-hemisphere-west` is `<GlobeHemisphereWest />`), so this
 * map is that vocabulary's renderer. A token we have not mapped draws the neutral
 * target mark rather than nothing, and says so in the console: the card still reads,
 * and the gap is visible to whoever adds the token.
 *
 * Colour lives in the mark, the Keel way: a soft tile in one data colour, the glyph
 * duotone in the same colour.
 */

import type { ComponentType } from "react";
import { GlobeHemisphereWestIcon } from "@phosphor-icons/react/dist/csr/GlobeHemisphereWest";
import { GlobeHemisphereEastIcon } from "@phosphor-icons/react/dist/csr/GlobeHemisphereEast";
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin";
import { UserIcon } from "@phosphor-icons/react/dist/csr/User";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { BuildingsIcon } from "@phosphor-icons/react/dist/csr/Buildings";
import { BuildingOfficeIcon } from "@phosphor-icons/react/dist/csr/BuildingOffice";
import { CrownIcon } from "@phosphor-icons/react/dist/csr/Crown";
import { BriefcaseIcon } from "@phosphor-icons/react/dist/csr/Briefcase";
import { UserCircleIcon } from "@phosphor-icons/react/dist/csr/UserCircle";
import { RocketLaunchIcon } from "@phosphor-icons/react/dist/csr/RocketLaunch";
import { CodeIcon } from "@phosphor-icons/react/dist/csr/Code";
import { CpuIcon } from "@phosphor-icons/react/dist/csr/Cpu";
import { StorefrontIcon } from "@phosphor-icons/react/dist/csr/Storefront";
import { ShoppingCartIcon } from "@phosphor-icons/react/dist/csr/ShoppingCart";
import { FactoryIcon } from "@phosphor-icons/react/dist/csr/Factory";
import { StethoscopeIcon } from "@phosphor-icons/react/dist/csr/Stethoscope";
import { FirstAidKitIcon } from "@phosphor-icons/react/dist/csr/FirstAidKit";
import { BankIcon } from "@phosphor-icons/react/dist/csr/Bank";
import { ScalesIcon } from "@phosphor-icons/react/dist/csr/Scales";
import { GraduationCapIcon } from "@phosphor-icons/react/dist/csr/GraduationCap";
import { MegaphoneIcon } from "@phosphor-icons/react/dist/csr/Megaphone";
import { HandshakeIcon } from "@phosphor-icons/react/dist/csr/Handshake";
import { HouseLineIcon } from "@phosphor-icons/react/dist/csr/HouseLine";
import { TruckIcon } from "@phosphor-icons/react/dist/csr/Truck";
import { ForkKnifeIcon } from "@phosphor-icons/react/dist/csr/ForkKnife";
import { AirplaneTiltIcon } from "@phosphor-icons/react/dist/csr/AirplaneTilt";
import { LeafIcon } from "@phosphor-icons/react/dist/csr/Leaf";
import { PaintBrushIcon } from "@phosphor-icons/react/dist/csr/PaintBrush";
import { HeartbeatIcon } from "@phosphor-icons/react/dist/csr/Heartbeat";
import { TargetIcon } from "@phosphor-icons/react/dist/csr/Target";

import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { ShoppingBagIcon } from "@phosphor-icons/react/dist/csr/ShoppingBag";
import { TShirtIcon } from "@phosphor-icons/react/dist/csr/TShirt";
import { SneakerIcon } from "@phosphor-icons/react/dist/csr/Sneaker";
import { DiamondIcon } from "@phosphor-icons/react/dist/csr/Diamond";
import { GiftIcon } from "@phosphor-icons/react/dist/csr/Gift";
import { FlowerIcon } from "@phosphor-icons/react/dist/csr/Flower";
import { PlantIcon } from "@phosphor-icons/react/dist/csr/Plant";
import { CoffeeIcon } from "@phosphor-icons/react/dist/csr/Coffee";
import { WineIcon } from "@phosphor-icons/react/dist/csr/Wine";
import { CookieIcon } from "@phosphor-icons/react/dist/csr/Cookie";
import { PillIcon } from "@phosphor-icons/react/dist/csr/Pill";
import { ToothIcon } from "@phosphor-icons/react/dist/csr/Tooth";
import { BarbellIcon } from "@phosphor-icons/react/dist/csr/Barbell";
import { PersonSimpleRunIcon } from "@phosphor-icons/react/dist/csr/PersonSimpleRun";
import { FlowerLotusIcon } from "@phosphor-icons/react/dist/csr/FlowerLotus";
import { ScissorsIcon } from "@phosphor-icons/react/dist/csr/Scissors";
import { PaletteIcon } from "@phosphor-icons/react/dist/csr/Palette";
import { CameraIcon } from "@phosphor-icons/react/dist/csr/Camera";
import { MusicNotesIcon } from "@phosphor-icons/react/dist/csr/MusicNotes";
import { FilmSlateIcon } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { BookOpenIcon } from "@phosphor-icons/react/dist/csr/BookOpen";
import { ChalkboardTeacherIcon } from "@phosphor-icons/react/dist/csr/ChalkboardTeacher";
import { DesktopIcon } from "@phosphor-icons/react/dist/csr/Desktop";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { CloudIcon } from "@phosphor-icons/react/dist/csr/Cloud";
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { CalculatorIcon } from "@phosphor-icons/react/dist/csr/Calculator";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/csr/CurrencyDollar";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench";
import { HammerIcon } from "@phosphor-icons/react/dist/csr/Hammer";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { CarIcon } from "@phosphor-icons/react/dist/csr/Car";
import { AirplaneIcon } from "@phosphor-icons/react/dist/csr/Airplane";
import { GlobeIcon } from "@phosphor-icons/react/dist/csr/Globe";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { PhoneIcon } from "@phosphor-icons/react/dist/csr/Phone";
import { EnvelopeIcon } from "@phosphor-icons/react/dist/csr/Envelope";
import { CalendarIcon } from "@phosphor-icons/react/dist/csr/Calendar";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { PawPrintIcon } from "@phosphor-icons/react/dist/csr/PawPrint";
import { BabyIcon } from "@phosphor-icons/react/dist/csr/Baby";
import { TicketIcon } from "@phosphor-icons/react/dist/csr/Ticket";
import { GameControllerIcon } from "@phosphor-icons/react/dist/csr/GameController";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
type Glyph = ComponentType<{ size?: number; weight?: "duotone" }>;

const ICONS: Record<string, Glyph> = {
  "globe-hemisphere-west": GlobeHemisphereWestIcon,
  "globe-hemisphere-east": GlobeHemisphereEastIcon,
  "map-pin": MapPinIcon,
  "user": UserIcon,
  "users-three": UsersThreeIcon,
  "buildings": BuildingsIcon,
  "building-office": BuildingOfficeIcon,
  "crown": CrownIcon,
  "briefcase": BriefcaseIcon,
  "user-circle": UserCircleIcon,
  "rocket-launch": RocketLaunchIcon,
  "code": CodeIcon,
  "cpu": CpuIcon,
  "storefront": StorefrontIcon,
  "shopping-cart": ShoppingCartIcon,
  "factory": FactoryIcon,
  "stethoscope": StethoscopeIcon,
  "first-aid-kit": FirstAidKitIcon,
  "bank": BankIcon,
  "scales": ScalesIcon,
  "graduation-cap": GraduationCapIcon,
  "megaphone": MegaphoneIcon,
  "handshake": HandshakeIcon,
  "house-line": HouseLineIcon,
  "truck": TruckIcon,
  "fork-knife": ForkKnifeIcon,
  "airplane-tilt": AirplaneTiltIcon,
  "leaf": LeafIcon,
  "paint-brush": PaintBrushIcon,
  "heartbeat": HeartbeatIcon,
  "target": TargetIcon,
  "package": PackageIcon,
  "shopping-bag": ShoppingBagIcon,
  "t-shirt": TShirtIcon,
  "sneaker": SneakerIcon,
  "diamond": DiamondIcon,
  "gift": GiftIcon,
  "flower": FlowerIcon,
  "plant": PlantIcon,
  "coffee": CoffeeIcon,
  "wine": WineIcon,
  "cookie": CookieIcon,
  "pill": PillIcon,
  "tooth": ToothIcon,
  "barbell": BarbellIcon,
  "person-simple-run": PersonSimpleRunIcon,
  "flower-lotus": FlowerLotusIcon,
  "scissors": ScissorsIcon,
  "palette": PaletteIcon,
  "camera": CameraIcon,
  "music-notes": MusicNotesIcon,
  "film-slate": FilmSlateIcon,
  "book-open": BookOpenIcon,
  "chalkboard-teacher": ChalkboardTeacherIcon,
  "desktop": DesktopIcon,
  "device-mobile": DeviceMobileIcon,
  "cloud": CloudIcon,
  "robot": RobotIcon,
  "chart-line-up": ChartLineUpIcon,
  "calculator": CalculatorIcon,
  "currency-dollar": CurrencyDollarIcon,
  "house": HouseIcon,
  "wrench": WrenchIcon,
  "hammer": HammerIcon,
  "lightning": LightningIcon,
  "car": CarIcon,
  "airplane": AirplaneIcon,
  "globe": GlobeIcon,
  "users": UsersIcon,
  "chat-circle": ChatCircleIcon,
  "phone": PhoneIcon,
  "envelope": EnvelopeIcon,
  "calendar": CalendarIcon,
  "shield-check": ShieldCheckIcon,
  "gear": GearIcon,
  "paw-print": PawPrintIcon,
  "baby": BabyIcon,
  "ticket": TicketIcon,
  "game-controller": GameControllerIcon,
  "sparkle": SparkleIcon,
};

export function OfferIcon({ token }: { token: string | null | undefined }) {
  const Glyph = (token && ICONS[token]) || TargetIcon;
  if (token && !ICONS[token]) console.warn(`[new-org] no icon mapped for "${token}"`);
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-[8px]"
      style={{ background: "color-mix(in oklab, var(--accent) 12%, transparent)", color: "var(--accent)" }}
    >
      <Glyph size={16} weight="duotone" />
    </span>
  );
}
