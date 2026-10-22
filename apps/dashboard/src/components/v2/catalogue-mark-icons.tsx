"use client";

/**
 * The workflow and template marks features-service serves (MARKS-1022, `GET /public/catalogue/mark-icons`,
 * 200 Phosphor names, append-only): every one imported per icon (never the barrel), so no served
 * name falls back to the circle. Generated from the served list on 2026-10-23; a name added later
 * is logged by `CatalogueMark` and drawn as a circle until it is added here.
 */
import type { Icon } from "@phosphor-icons/react";
import { AcornIcon } from "@phosphor-icons/react/dist/csr/Acorn";
import { AirplaneTiltIcon } from "@phosphor-icons/react/dist/csr/AirplaneTilt";
import { AlienIcon } from "@phosphor-icons/react/dist/csr/Alien";
import { AnchorIcon } from "@phosphor-icons/react/dist/csr/Anchor";
import { ApertureIcon } from "@phosphor-icons/react/dist/csr/Aperture";
import { AppleLogoIcon } from "@phosphor-icons/react/dist/csr/AppleLogo";
import { AtomIcon } from "@phosphor-icons/react/dist/csr/Atom";
import { AvocadoIcon } from "@phosphor-icons/react/dist/csr/Avocado";
import { AxeIcon } from "@phosphor-icons/react/dist/csr/Axe";
import { BabyCarriageIcon } from "@phosphor-icons/react/dist/csr/BabyCarriage";
import { BalloonIcon } from "@phosphor-icons/react/dist/csr/Balloon";
import { BarbellIcon } from "@phosphor-icons/react/dist/csr/Barbell";
import { BarnIcon } from "@phosphor-icons/react/dist/csr/Barn";
import { BaseballIcon } from "@phosphor-icons/react/dist/csr/Baseball";
import { BasketIcon } from "@phosphor-icons/react/dist/csr/Basket";
import { BasketballIcon } from "@phosphor-icons/react/dist/csr/Basketball";
import { BathtubIcon } from "@phosphor-icons/react/dist/csr/Bathtub";
import { BeachBallIcon } from "@phosphor-icons/react/dist/csr/BeachBall";
import { BeerSteinIcon } from "@phosphor-icons/react/dist/csr/BeerStein";
import { BellSimpleIcon } from "@phosphor-icons/react/dist/csr/BellSimple";
import { BicycleIcon } from "@phosphor-icons/react/dist/csr/Bicycle";
import { BinocularsIcon } from "@phosphor-icons/react/dist/csr/Binoculars";
import { BoatIcon } from "@phosphor-icons/react/dist/csr/Boat";
import { BoneIcon } from "@phosphor-icons/react/dist/csr/Bone";
import { BookOpenIcon } from "@phosphor-icons/react/dist/csr/BookOpen";
import { BootIcon } from "@phosphor-icons/react/dist/csr/Boot";
import { BowlFoodIcon } from "@phosphor-icons/react/dist/csr/BowlFood";
import { BowlingBallIcon } from "@phosphor-icons/react/dist/csr/BowlingBall";
import { BrainIcon } from "@phosphor-icons/react/dist/csr/Brain";
import { BreadIcon } from "@phosphor-icons/react/dist/csr/Bread";
import { BridgeIcon } from "@phosphor-icons/react/dist/csr/Bridge";
import { BriefcaseIcon } from "@phosphor-icons/react/dist/csr/Briefcase";
import { BroomIcon } from "@phosphor-icons/react/dist/csr/Broom";
import { BugBeetleIcon } from "@phosphor-icons/react/dist/csr/BugBeetle";
import { ButterflyIcon } from "@phosphor-icons/react/dist/csr/Butterfly";
import { CactusIcon } from "@phosphor-icons/react/dist/csr/Cactus";
import { CakeIcon } from "@phosphor-icons/react/dist/csr/Cake";
import { CalculatorIcon } from "@phosphor-icons/react/dist/csr/Calculator";
import { CameraIcon } from "@phosphor-icons/react/dist/csr/Camera";
import { CampfireIcon } from "@phosphor-icons/react/dist/csr/Campfire";
import { CarProfileIcon } from "@phosphor-icons/react/dist/csr/CarProfile";
import { CarrotIcon } from "@phosphor-icons/react/dist/csr/Carrot";
import { CastleTurretIcon } from "@phosphor-icons/react/dist/csr/CastleTurret";
import { CatIcon } from "@phosphor-icons/react/dist/csr/Cat";
import { CherriesIcon } from "@phosphor-icons/react/dist/csr/Cherries";
import { ChurchIcon } from "@phosphor-icons/react/dist/csr/Church";
import { CloudSunIcon } from "@phosphor-icons/react/dist/csr/CloudSun";
import { CloverIcon } from "@phosphor-icons/react/dist/csr/Clover";
import { CoatHangerIcon } from "@phosphor-icons/react/dist/csr/CoatHanger";
import { CoffeeIcon } from "@phosphor-icons/react/dist/csr/Coffee";
import { CoinVerticalIcon } from "@phosphor-icons/react/dist/csr/CoinVertical";
import { CompassIcon } from "@phosphor-icons/react/dist/csr/Compass";
import { CookieIcon } from "@phosphor-icons/react/dist/csr/Cookie";
import { CowIcon } from "@phosphor-icons/react/dist/csr/Cow";
import { CrownIcon } from "@phosphor-icons/react/dist/csr/Crown";
import { CubeIcon } from "@phosphor-icons/react/dist/csr/Cube";
import { DogIcon } from "@phosphor-icons/react/dist/csr/Dog";
import { DiamondIcon } from "@phosphor-icons/react/dist/csr/Diamond";
import { DiceFiveIcon } from "@phosphor-icons/react/dist/csr/DiceFive";
import { DiscIcon } from "@phosphor-icons/react/dist/csr/Disc";
import { DnaIcon } from "@phosphor-icons/react/dist/csr/Dna";
import { DoorOpenIcon } from "@phosphor-icons/react/dist/csr/DoorOpen";
import { DressIcon } from "@phosphor-icons/react/dist/csr/Dress";
import { DropIcon } from "@phosphor-icons/react/dist/csr/Drop";
import { EarIcon } from "@phosphor-icons/react/dist/csr/Ear";
import { EggIcon } from "@phosphor-icons/react/dist/csr/Egg";
import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { FactoryIcon } from "@phosphor-icons/react/dist/csr/Factory";
import { FeatherIcon } from "@phosphor-icons/react/dist/csr/Feather";
import { FireIcon } from "@phosphor-icons/react/dist/csr/Fire";
import { FishIcon } from "@phosphor-icons/react/dist/csr/Fish";
import { FlagPennantIcon } from "@phosphor-icons/react/dist/csr/FlagPennant";
import { FlameIcon } from "@phosphor-icons/react/dist/csr/Flame";
import { FlashlightIcon } from "@phosphor-icons/react/dist/csr/Flashlight";
import { FlowerIcon } from "@phosphor-icons/react/dist/csr/Flower";
import { FlowerLotusIcon } from "@phosphor-icons/react/dist/csr/FlowerLotus";
import { FlowerTulipIcon } from "@phosphor-icons/react/dist/csr/FlowerTulip";
import { FootballIcon } from "@phosphor-icons/react/dist/csr/Football";
import { FootprintsIcon } from "@phosphor-icons/react/dist/csr/Footprints";
import { ForkKnifeIcon } from "@phosphor-icons/react/dist/csr/ForkKnife";
import { GameControllerIcon } from "@phosphor-icons/react/dist/csr/GameController";
import { GarageIcon } from "@phosphor-icons/react/dist/csr/Garage";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { GhostIcon } from "@phosphor-icons/react/dist/csr/Ghost";
import { GiftIcon } from "@phosphor-icons/react/dist/csr/Gift";
import { GlobeHemisphereWestIcon } from "@phosphor-icons/react/dist/csr/GlobeHemisphereWest";
import { GraduationCapIcon } from "@phosphor-icons/react/dist/csr/GraduationCap";
import { GuitarIcon } from "@phosphor-icons/react/dist/csr/Guitar";
import { HammerIcon } from "@phosphor-icons/react/dist/csr/Hammer";
import { HandFistIcon } from "@phosphor-icons/react/dist/csr/HandFist";
import { HandPeaceIcon } from "@phosphor-icons/react/dist/csr/HandPeace";
import { HardHatIcon } from "@phosphor-icons/react/dist/csr/HardHat";
import { HeadphonesIcon } from "@phosphor-icons/react/dist/csr/Headphones";
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { HexagonIcon } from "@phosphor-icons/react/dist/csr/Hexagon";
import { HorseIcon } from "@phosphor-icons/react/dist/csr/Horse";
import { HourglassIcon } from "@phosphor-icons/react/dist/csr/Hourglass";
import { IceCreamIcon } from "@phosphor-icons/react/dist/csr/IceCream";
import { IslandIcon } from "@phosphor-icons/react/dist/csr/Island";
import { JeepIcon } from "@phosphor-icons/react/dist/csr/Jeep";
import { KeyIcon } from "@phosphor-icons/react/dist/csr/Key";
import { KeyboardIcon } from "@phosphor-icons/react/dist/csr/Keyboard";
import { KnifeIcon } from "@phosphor-icons/react/dist/csr/Knife";
import { LampIcon } from "@phosphor-icons/react/dist/csr/Lamp";
import { LeafIcon } from "@phosphor-icons/react/dist/csr/Leaf";
import { LighthouseIcon } from "@phosphor-icons/react/dist/csr/Lighthouse";
import { LightbulbIcon } from "@phosphor-icons/react/dist/csr/Lightbulb";
import { LockKeyIcon } from "@phosphor-icons/react/dist/csr/LockKey";
import { MagicWandIcon } from "@phosphor-icons/react/dist/csr/MagicWand";
import { MagnetIcon } from "@phosphor-icons/react/dist/csr/Magnet";
import { MaskHappyIcon } from "@phosphor-icons/react/dist/csr/MaskHappy";
import { MedalMilitaryIcon } from "@phosphor-icons/react/dist/csr/MedalMilitary";
import { MicroscopeIcon } from "@phosphor-icons/react/dist/csr/Microscope";
import { MoonStarsIcon } from "@phosphor-icons/react/dist/csr/MoonStars";
import { MountainsIcon } from "@phosphor-icons/react/dist/csr/Mountains";
import { MouseSimpleIcon } from "@phosphor-icons/react/dist/csr/MouseSimple";
import { MusicNotesIcon } from "@phosphor-icons/react/dist/csr/MusicNotes";
import { NeedleIcon } from "@phosphor-icons/react/dist/csr/Needle";
import { NutIcon } from "@phosphor-icons/react/dist/csr/Nut";
import { OrangeSliceIcon } from "@phosphor-icons/react/dist/csr/OrangeSlice";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { PaintBrushIcon } from "@phosphor-icons/react/dist/csr/PaintBrush";
import { PaletteIcon } from "@phosphor-icons/react/dist/csr/Palette";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { ParachuteIcon } from "@phosphor-icons/react/dist/csr/Parachute";
import { PawPrintIcon } from "@phosphor-icons/react/dist/csr/PawPrint";
import { PenNibIcon } from "@phosphor-icons/react/dist/csr/PenNib";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { PepperIcon } from "@phosphor-icons/react/dist/csr/Pepper";
import { PersonSimpleBikeIcon } from "@phosphor-icons/react/dist/csr/PersonSimpleBike";
import { PianoKeysIcon } from "@phosphor-icons/react/dist/csr/PianoKeys";
import { PicnicTableIcon } from "@phosphor-icons/react/dist/csr/PicnicTable";
import { PinwheelIcon } from "@phosphor-icons/react/dist/csr/Pinwheel";
import { PizzaIcon } from "@phosphor-icons/react/dist/csr/Pizza";
import { PlanetIcon } from "@phosphor-icons/react/dist/csr/Planet";
import { PlantIcon } from "@phosphor-icons/react/dist/csr/Plant";
import { PopcornIcon } from "@phosphor-icons/react/dist/csr/Popcorn";
import { PottedPlantIcon } from "@phosphor-icons/react/dist/csr/PottedPlant";
import { PuzzlePieceIcon } from "@phosphor-icons/react/dist/csr/PuzzlePiece";
import { RabbitIcon } from "@phosphor-icons/react/dist/csr/Rabbit";
import { RadioIcon } from "@phosphor-icons/react/dist/csr/Radio";
import { RainbowIcon } from "@phosphor-icons/react/dist/csr/Rainbow";
import { RocketLaunchIcon } from "@phosphor-icons/react/dist/csr/RocketLaunch";
import { RowsIcon } from "@phosphor-icons/react/dist/csr/Rows";
import { RulerIcon } from "@phosphor-icons/react/dist/csr/Ruler";
import { SailboatIcon } from "@phosphor-icons/react/dist/csr/Sailboat";
import { ScissorsIcon } from "@phosphor-icons/react/dist/csr/Scissors";
import { ScrewdriverIcon } from "@phosphor-icons/react/dist/csr/Screwdriver";
import { ShieldStarIcon } from "@phosphor-icons/react/dist/csr/ShieldStar";
import { ShovelIcon } from "@phosphor-icons/react/dist/csr/Shovel";
import { ShrimpIcon } from "@phosphor-icons/react/dist/csr/Shrimp";
import { SkullIcon } from "@phosphor-icons/react/dist/csr/Skull";
import { SnowflakeIcon } from "@phosphor-icons/react/dist/csr/Snowflake";
import { SoccerBallIcon } from "@phosphor-icons/react/dist/csr/SoccerBall";
import { SpadeIcon } from "@phosphor-icons/react/dist/csr/Spade";
import { SpiralIcon } from "@phosphor-icons/react/dist/csr/Spiral";
import { StarFourIcon } from "@phosphor-icons/react/dist/csr/StarFour";
import { StoolIcon } from "@phosphor-icons/react/dist/csr/Stool";
import { StudentIcon } from "@phosphor-icons/react/dist/csr/Student";
import { SunHorizonIcon } from "@phosphor-icons/react/dist/csr/SunHorizon";
import { SunglassesIcon } from "@phosphor-icons/react/dist/csr/Sunglasses";
import { SwordIcon } from "@phosphor-icons/react/dist/csr/Sword";
import { TShirtIcon } from "@phosphor-icons/react/dist/csr/TShirt";
import { TaxiIcon } from "@phosphor-icons/react/dist/csr/Taxi";
import { TennisBallIcon } from "@phosphor-icons/react/dist/csr/TennisBall";
import { TentIcon } from "@phosphor-icons/react/dist/csr/Tent";
import { TestTubeIcon } from "@phosphor-icons/react/dist/csr/TestTube";
import { TipiIcon } from "@phosphor-icons/react/dist/csr/Tipi";
import { ToothIcon } from "@phosphor-icons/react/dist/csr/Tooth";
import { ToteIcon } from "@phosphor-icons/react/dist/csr/Tote";
import { TractorIcon } from "@phosphor-icons/react/dist/csr/Tractor";
import { TrainIcon } from "@phosphor-icons/react/dist/csr/Train";
import { TreeIcon } from "@phosphor-icons/react/dist/csr/Tree";
import { TreeEvergreenIcon } from "@phosphor-icons/react/dist/csr/TreeEvergreen";
import { TreePalmIcon } from "@phosphor-icons/react/dist/csr/TreePalm";
import { TrophyIcon } from "@phosphor-icons/react/dist/csr/Trophy";
import { TruckIcon } from "@phosphor-icons/react/dist/csr/Truck";
import { UmbrellaIcon } from "@phosphor-icons/react/dist/csr/Umbrella";
import { VolleyballIcon } from "@phosphor-icons/react/dist/csr/Volleyball";
import { WatchIcon } from "@phosphor-icons/react/dist/csr/Watch";
import { WindIcon } from "@phosphor-icons/react/dist/csr/Wind";
import { WineIcon } from "@phosphor-icons/react/dist/csr/Wine";
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench";
import { YinYangIcon } from "@phosphor-icons/react/dist/csr/YinYang";
import { LegoIcon } from "@phosphor-icons/react/dist/csr/Lego";
import { CheeseIcon } from "@phosphor-icons/react/dist/csr/Cheese";
import { SneakerIcon } from "@phosphor-icons/react/dist/csr/Sneaker";
import { GogglesIcon } from "@phosphor-icons/react/dist/csr/Goggles";
import { HamburgerIcon } from "@phosphor-icons/react/dist/csr/Hamburger";
import { LifebuoyIcon } from "@phosphor-icons/react/dist/csr/Lifebuoy";
import { WindmillIcon } from "@phosphor-icons/react/dist/csr/Windmill";
import { DiscoBallIcon } from "@phosphor-icons/react/dist/csr/DiscoBall";
import { MartiniIcon } from "@phosphor-icons/react/dist/csr/Martini";
import { ChampagneIcon } from "@phosphor-icons/react/dist/csr/Champagne";
import { PopsicleIcon } from "@phosphor-icons/react/dist/csr/Popsicle";
import { CardsIcon } from "@phosphor-icons/react/dist/csr/Cards";
import { ArmchairIcon } from "@phosphor-icons/react/dist/csr/Armchair";
import { FlaskIcon } from "@phosphor-icons/react/dist/csr/Flask";
import { LadderIcon } from "@phosphor-icons/react/dist/csr/Ladder";
import { PiggyBankIcon } from "@phosphor-icons/react/dist/csr/PiggyBank";

export const MARK_ICONS: Record<string, Icon> = {
  acorn: AcornIcon,
  "airplane-tilt": AirplaneTiltIcon,
  alien: AlienIcon,
  anchor: AnchorIcon,
  aperture: ApertureIcon,
  "apple-logo": AppleLogoIcon,
  atom: AtomIcon,
  avocado: AvocadoIcon,
  axe: AxeIcon,
  "baby-carriage": BabyCarriageIcon,
  balloon: BalloonIcon,
  barbell: BarbellIcon,
  barn: BarnIcon,
  baseball: BaseballIcon,
  basket: BasketIcon,
  basketball: BasketballIcon,
  bathtub: BathtubIcon,
  "beach-ball": BeachBallIcon,
  "beer-stein": BeerSteinIcon,
  "bell-simple": BellSimpleIcon,
  bicycle: BicycleIcon,
  binoculars: BinocularsIcon,
  boat: BoatIcon,
  bone: BoneIcon,
  "book-open": BookOpenIcon,
  boot: BootIcon,
  "bowl-food": BowlFoodIcon,
  "bowling-ball": BowlingBallIcon,
  brain: BrainIcon,
  bread: BreadIcon,
  bridge: BridgeIcon,
  briefcase: BriefcaseIcon,
  broom: BroomIcon,
  "bug-beetle": BugBeetleIcon,
  butterfly: ButterflyIcon,
  cactus: CactusIcon,
  cake: CakeIcon,
  calculator: CalculatorIcon,
  camera: CameraIcon,
  campfire: CampfireIcon,
  "car-profile": CarProfileIcon,
  carrot: CarrotIcon,
  "castle-turret": CastleTurretIcon,
  cat: CatIcon,
  cherries: CherriesIcon,
  church: ChurchIcon,
  "cloud-sun": CloudSunIcon,
  clover: CloverIcon,
  "coat-hanger": CoatHangerIcon,
  coffee: CoffeeIcon,
  "coin-vertical": CoinVerticalIcon,
  compass: CompassIcon,
  cookie: CookieIcon,
  cow: CowIcon,
  crown: CrownIcon,
  cube: CubeIcon,
  dog: DogIcon,
  diamond: DiamondIcon,
  "dice-five": DiceFiveIcon,
  disc: DiscIcon,
  dna: DnaIcon,
  "door-open": DoorOpenIcon,
  dress: DressIcon,
  drop: DropIcon,
  ear: EarIcon,
  egg: EggIcon,
  eye: EyeIcon,
  factory: FactoryIcon,
  feather: FeatherIcon,
  fire: FireIcon,
  fish: FishIcon,
  "flag-pennant": FlagPennantIcon,
  flame: FlameIcon,
  flashlight: FlashlightIcon,
  flower: FlowerIcon,
  "flower-lotus": FlowerLotusIcon,
  "flower-tulip": FlowerTulipIcon,
  football: FootballIcon,
  footprints: FootprintsIcon,
  "fork-knife": ForkKnifeIcon,
  "game-controller": GameControllerIcon,
  garage: GarageIcon,
  "gear-six": GearSixIcon,
  ghost: GhostIcon,
  gift: GiftIcon,
  "globe-hemisphere-west": GlobeHemisphereWestIcon,
  "graduation-cap": GraduationCapIcon,
  guitar: GuitarIcon,
  hammer: HammerIcon,
  "hand-fist": HandFistIcon,
  "hand-peace": HandPeaceIcon,
  "hard-hat": HardHatIcon,
  headphones: HeadphonesIcon,
  heart: HeartIcon,
  hexagon: HexagonIcon,
  horse: HorseIcon,
  hourglass: HourglassIcon,
  "ice-cream": IceCreamIcon,
  island: IslandIcon,
  jeep: JeepIcon,
  key: KeyIcon,
  keyboard: KeyboardIcon,
  knife: KnifeIcon,
  lamp: LampIcon,
  leaf: LeafIcon,
  lighthouse: LighthouseIcon,
  lightbulb: LightbulbIcon,
  "lock-key": LockKeyIcon,
  "magic-wand": MagicWandIcon,
  magnet: MagnetIcon,
  "mask-happy": MaskHappyIcon,
  "medal-military": MedalMilitaryIcon,
  microscope: MicroscopeIcon,
  "moon-stars": MoonStarsIcon,
  mountains: MountainsIcon,
  "mouse-simple": MouseSimpleIcon,
  "music-notes": MusicNotesIcon,
  needle: NeedleIcon,
  nut: NutIcon,
  "orange-slice": OrangeSliceIcon,
  package: PackageIcon,
  "paint-brush": PaintBrushIcon,
  palette: PaletteIcon,
  "paper-plane-tilt": PaperPlaneTiltIcon,
  parachute: ParachuteIcon,
  "paw-print": PawPrintIcon,
  "pen-nib": PenNibIcon,
  "pencil-simple": PencilSimpleIcon,
  pepper: PepperIcon,
  "person-simple-bike": PersonSimpleBikeIcon,
  "piano-keys": PianoKeysIcon,
  "picnic-table": PicnicTableIcon,
  pinwheel: PinwheelIcon,
  pizza: PizzaIcon,
  planet: PlanetIcon,
  plant: PlantIcon,
  popcorn: PopcornIcon,
  "potted-plant": PottedPlantIcon,
  "puzzle-piece": PuzzlePieceIcon,
  rabbit: RabbitIcon,
  radio: RadioIcon,
  rainbow: RainbowIcon,
  "rocket-launch": RocketLaunchIcon,
  rows: RowsIcon,
  ruler: RulerIcon,
  sailboat: SailboatIcon,
  scissors: ScissorsIcon,
  screwdriver: ScrewdriverIcon,
  "shield-star": ShieldStarIcon,
  shovel: ShovelIcon,
  shrimp: ShrimpIcon,
  skull: SkullIcon,
  snowflake: SnowflakeIcon,
  "soccer-ball": SoccerBallIcon,
  spade: SpadeIcon,
  spiral: SpiralIcon,
  "star-four": StarFourIcon,
  stool: StoolIcon,
  student: StudentIcon,
  "sun-horizon": SunHorizonIcon,
  sunglasses: SunglassesIcon,
  sword: SwordIcon,
  "t-shirt": TShirtIcon,
  taxi: TaxiIcon,
  "tennis-ball": TennisBallIcon,
  tent: TentIcon,
  "test-tube": TestTubeIcon,
  tipi: TipiIcon,
  tooth: ToothIcon,
  tote: ToteIcon,
  tractor: TractorIcon,
  train: TrainIcon,
  tree: TreeIcon,
  "tree-evergreen": TreeEvergreenIcon,
  "tree-palm": TreePalmIcon,
  trophy: TrophyIcon,
  truck: TruckIcon,
  umbrella: UmbrellaIcon,
  volleyball: VolleyballIcon,
  watch: WatchIcon,
  wind: WindIcon,
  wine: WineIcon,
  wrench: WrenchIcon,
  "yin-yang": YinYangIcon,
  lego: LegoIcon,
  cheese: CheeseIcon,
  sneaker: SneakerIcon,
  goggles: GogglesIcon,
  hamburger: HamburgerIcon,
  lifebuoy: LifebuoyIcon,
  windmill: WindmillIcon,
  "disco-ball": DiscoBallIcon,
  martini: MartiniIcon,
  champagne: ChampagneIcon,
  popsicle: PopsicleIcon,
  cards: CardsIcon,
  armchair: ArmchairIcon,
  flask: FlaskIcon,
  ladder: LadderIcon,
  "piggy-bank": PiggyBankIcon,
};

/** Every served name this file draws (with the catalogue's own), for the coverage test. */
export const SERVED_MARK_ICON_NAMES: readonly string[] = ["acorn", "airplane-tilt", "alien", "anchor", "aperture", "apple-logo", "atom", "avocado", "axe", "baby-carriage", "balloon", "barbell", "barn", "baseball", "basket", "basketball", "bathtub", "beach-ball", "beer-stein", "bell-simple", "bicycle", "binoculars", "boat", "bone", "book-open", "boot", "bowl-food", "bowling-ball", "brain", "bread", "bridge", "briefcase", "broom", "bug-beetle", "butterfly", "cactus", "cake", "calculator", "camera", "campfire", "car-profile", "carrot", "castle-turret", "cat", "cherries", "church", "cloud-sun", "clover", "coat-hanger", "coffee", "coin-vertical", "compass", "cookie", "cow", "crown", "cube", "dog", "diamond", "dice-five", "disc", "dna", "door-open", "dress", "drop", "ear", "egg", "eye", "factory", "feather", "fire", "fish", "flag-pennant", "flame", "flashlight", "flower", "flower-lotus", "flower-tulip", "football", "footprints", "fork-knife", "game-controller", "garage", "gear-six", "ghost", "gift", "globe-hemisphere-west", "graduation-cap", "guitar", "hammer", "hand-fist", "hand-peace", "hard-hat", "headphones", "heart", "hexagon", "horse", "hourglass", "ice-cream", "island", "jeep", "key", "keyboard", "knife", "lamp", "leaf", "lighthouse", "lightbulb", "lock-key", "magic-wand", "magnet", "mask-happy", "medal-military", "microscope", "moon-stars", "mountains", "mouse-simple", "music-notes", "needle", "nut", "orange-slice", "package", "paint-brush", "palette", "paper-plane-tilt", "parachute", "paw-print", "pen-nib", "pencil-simple", "pepper", "person-simple-bike", "piano-keys", "picnic-table", "pinwheel", "pizza", "planet", "plant", "popcorn", "potted-plant", "puzzle-piece", "rabbit", "radio", "rainbow", "rocket-launch", "rows", "ruler", "sailboat", "scissors", "screwdriver", "shield-star", "shovel", "shrimp", "skull", "snowflake", "soccer-ball", "spade", "spiral", "star-four", "stool", "student", "sun-horizon", "sunglasses", "sword", "t-shirt", "taxi", "tennis-ball", "tent", "test-tube", "tipi", "tooth", "tote", "tractor", "train", "tree", "tree-evergreen", "tree-palm", "trophy", "truck", "umbrella", "volleyball", "watch", "wind", "wine", "wrench", "yin-yang", "lego", "cheese", "sneaker", "goggles", "hamburger", "lifebuoy", "windmill", "disco-ball", "martini", "champagne", "popsicle", "cards", "armchair", "flask", "ladder", "piggy-bank"];
