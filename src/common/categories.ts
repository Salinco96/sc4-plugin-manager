import { t } from "./i18n"
import { PackageState, VariantInfo } from "./types"

export enum PackageCategory {
  AGRICULTURE = "agriculture",
  AIRPLANES = "airplanes",
  AIRPORTS = "airports",
  AUDIO = "audio",
  AUTOMATA = "automata",
  BIKES = "bikes",
  BLOCKERS = "blockers",
  BUGFIXES = "bugfixes",
  BUS = "bus",
  CAM = "cam",
  CANALS = "canals",
  CHEATS = "cheats",
  CIVICS = "civics",
  COMMERCIAL = "commercial",
  COMMERCIAL_CO2 = "commercial-co2",
  COMMERCIAL_CO3 = "commercial-co3",
  COMMERCIAL_CS1 = "commercial-cs1",
  COMMERCIAL_CS2 = "commercial-cs2",
  COMMERCIAL_CS3 = "commercial-cs3",
  CUSTOM = "custom",
  DEPENDENCIES = "dependencies",
  DLL = "dll",
  EDUCATION = "education",
  ENERGY = "energy",
  FERRY = "ferry",
  FILLERS = "fillers",
  FLORA = "flora",
  FREIGHT_RAIL = "freight-rail",
  GAMEPLAY = "gameplay",
  GOVERNMENT = "government",
  GRAPHICS = "graphics",
  HEALTH = "health",
  INDUSTRIAL = "industrial",
  INDUSTRIAL_ID = "industrial-id",
  INDUSTRIAL_IHT = "industrial-iht",
  INDUSTRIAL_IM = "industrial-im",
  IRM = "irm",
  LANDMARKS = "landmarks",
  MARINA = "marina",
  MODS = "mods",
  MONORAIL = "monorail",
  MMPS = "mmps",
  NAM = "nam",
  ORDINANCES = "ordinances",
  OVERRIDES = "overrides",
  PARKINGS = "parkings",
  PARKS = "parks",
  PASSENGER_RAIL = "passenger-rail",
  PEDESTRIANS = "pedestrians",
  PROPS = "props",
  RAIL = "rail",
  RELIGION = "religion",
  RESIDENTIAL = "residential",
  RESIDENTIAL_R1 = "residential-r1",
  RESIDENTIAL_R2 = "residential-r2",
  RESIDENTIAL_R3 = "residential-r3",
  REWARDS = "rewards",
  SAFETY = "safety",
  SEAPORTS = "seaports",
  SHIPS = "ships",
  SIDEWALKS = "sidewalks",
  SPAM = "spam",
  STREETLIGHTS = "streetlights",
  SUBWAY = "subway",
  TERMINALS = "terminals",
  TEXTURES = "textures",
  TRAM = "tram",
  TRANSPORT = "transport",
  TRAINS = "trains",
  UTILITIES = "utilities",
  WASTE = "waste",
  WATER = "water",
  WATERFRONT = "waterfront",
}

export const defaultCategory: number = 800

const categoryMapping: {
  [category: number]: PackageCategory[]
} = {
  0: [PackageCategory.MODS],
  7: [PackageCategory.MODS, PackageCategory.TRANSPORT, PackageCategory.NAM],
  10: [PackageCategory.MODS, PackageCategory.CHEATS],
  20: [PackageCategory.MODS, PackageCategory.GRAPHICS],
  30: [PackageCategory.MODS, PackageCategory.GAMEPLAY],
  31: [PackageCategory.MODS, PackageCategory.GAMEPLAY, PackageCategory.ORDINANCES],
  32: [PackageCategory.MODS, PackageCategory.GAMEPLAY, PackageCategory.CAM],
  60: [PackageCategory.MODS, PackageCategory.DLL],
  100: [PackageCategory.DEPENDENCIES],
  110: [PackageCategory.DEPENDENCIES, PackageCategory.TEXTURES],
  120: [PackageCategory.DEPENDENCIES, PackageCategory.PROPS],
  130: [PackageCategory.DEPENDENCIES, PackageCategory.AUDIO],
  200: [PackageCategory.RESIDENTIAL],
  202: [PackageCategory.RESIDENTIAL, PackageCategory.CAM],
  210: [PackageCategory.RESIDENTIAL, PackageCategory.RESIDENTIAL_R1],
  212: [PackageCategory.RESIDENTIAL, PackageCategory.RESIDENTIAL_R1, PackageCategory.CAM],
  220: [PackageCategory.RESIDENTIAL, PackageCategory.RESIDENTIAL_R2],
  222: [PackageCategory.RESIDENTIAL, PackageCategory.RESIDENTIAL_R2, PackageCategory.CAM],
  230: [PackageCategory.RESIDENTIAL, PackageCategory.RESIDENTIAL_R3],
  232: [PackageCategory.RESIDENTIAL, PackageCategory.RESIDENTIAL_R3, PackageCategory.CAM],
  300: [PackageCategory.COMMERCIAL],
  302: [PackageCategory.COMMERCIAL, PackageCategory.CAM],
  310: [PackageCategory.COMMERCIAL, PackageCategory.COMMERCIAL_CS1],
  312: [PackageCategory.COMMERCIAL, PackageCategory.COMMERCIAL_CS1, PackageCategory.CAM],
  320: [PackageCategory.COMMERCIAL, PackageCategory.COMMERCIAL_CS2],
  322: [PackageCategory.COMMERCIAL, PackageCategory.COMMERCIAL_CS2, PackageCategory.CAM],
  330: [PackageCategory.COMMERCIAL, PackageCategory.COMMERCIAL_CS3],
  332: [PackageCategory.COMMERCIAL, PackageCategory.COMMERCIAL_CS3, PackageCategory.CAM],
  340: [PackageCategory.COMMERCIAL, PackageCategory.COMMERCIAL_CO2],
  342: [PackageCategory.COMMERCIAL, PackageCategory.COMMERCIAL_CO2, PackageCategory.CAM],
  350: [PackageCategory.COMMERCIAL, PackageCategory.COMMERCIAL_CO3],
  352: [PackageCategory.COMMERCIAL, PackageCategory.COMMERCIAL_CO3, PackageCategory.CAM],
  360: [PackageCategory.LANDMARKS],
  361: [PackageCategory.LANDMARKS, PackageCategory.REWARDS],
  362: [PackageCategory.LANDMARKS, PackageCategory.RESIDENTIAL],
  363: [PackageCategory.LANDMARKS, PackageCategory.COMMERCIAL],
  364: [PackageCategory.LANDMARKS, PackageCategory.INDUSTRIAL],
  400: [PackageCategory.INDUSTRIAL],
  401: [PackageCategory.INDUSTRIAL, PackageCategory.IRM],
  410: [PackageCategory.INDUSTRIAL, PackageCategory.AGRICULTURE],
  411: [PackageCategory.INDUSTRIAL, PackageCategory.AGRICULTURE, PackageCategory.SPAM],
  412: [PackageCategory.INDUSTRIAL, PackageCategory.AGRICULTURE, PackageCategory.CAM],
  420: [PackageCategory.INDUSTRIAL, PackageCategory.INDUSTRIAL_ID],
  421: [PackageCategory.INDUSTRIAL, PackageCategory.INDUSTRIAL_ID, PackageCategory.IRM],
  422: [PackageCategory.INDUSTRIAL, PackageCategory.INDUSTRIAL_ID, PackageCategory.CAM],
  430: [PackageCategory.INDUSTRIAL, PackageCategory.INDUSTRIAL_IM],
  431: [PackageCategory.INDUSTRIAL, PackageCategory.INDUSTRIAL_IM, PackageCategory.IRM],
  432: [PackageCategory.INDUSTRIAL, PackageCategory.INDUSTRIAL_IM, PackageCategory.CAM],
  440: [PackageCategory.INDUSTRIAL, PackageCategory.INDUSTRIAL_IHT],
  441: [PackageCategory.INDUSTRIAL, PackageCategory.INDUSTRIAL_IHT, PackageCategory.IRM],
  442: [PackageCategory.INDUSTRIAL, PackageCategory.INDUSTRIAL_IHT, PackageCategory.CAM],
  500: [PackageCategory.UTILITIES],
  510: [PackageCategory.UTILITIES, PackageCategory.ENERGY],
  520: [PackageCategory.UTILITIES, PackageCategory.WATER],
  530: [PackageCategory.UTILITIES, PackageCategory.WASTE],
  600: [PackageCategory.CIVICS],
  610: [PackageCategory.CIVICS, PackageCategory.SAFETY],
  620: [PackageCategory.CIVICS, PackageCategory.EDUCATION],
  630: [PackageCategory.CIVICS, PackageCategory.HEALTH],
  640: [PackageCategory.CIVICS, PackageCategory.GOVERNMENT],
  650: [PackageCategory.CIVICS, PackageCategory.RELIGION],
  660: [PackageCategory.PARKS],
  670: [PackageCategory.PARKS, PackageCategory.MMPS],
  672: [PackageCategory.PARKS, PackageCategory.MMPS, PackageCategory.FLORA],
  676: [PackageCategory.PARKS, PackageCategory.MMPS, PackageCategory.STREETLIGHTS],
  677: [PackageCategory.PARKS, PackageCategory.MMPS, PackageCategory.PARKINGS],
  678: [PackageCategory.PARKS, PackageCategory.MMPS, PackageCategory.BIKES],
  679: [PackageCategory.PARKS, PackageCategory.MMPS, PackageCategory.PEDESTRIANS],
  700: [PackageCategory.TRANSPORT],
  707: [PackageCategory.TRANSPORT, PackageCategory.PARKINGS],
  708: [PackageCategory.TRANSPORT, PackageCategory.BIKES],
  721: [PackageCategory.TRANSPORT, PackageCategory.BUS],
  722: [PackageCategory.TRANSPORT, PackageCategory.SUBWAY],
  723: [PackageCategory.TRANSPORT, PackageCategory.TRAM],
  724: [PackageCategory.TRANSPORT, PackageCategory.BUS, PackageCategory.SUBWAY],
  725: [PackageCategory.TRANSPORT, PackageCategory.BUS, PackageCategory.TRAM],
  730: [PackageCategory.TRANSPORT, PackageCategory.RAIL],
  731: [PackageCategory.TRANSPORT, PackageCategory.RAIL, PackageCategory.PASSENGER_RAIL],
  732: [PackageCategory.TRANSPORT, PackageCategory.RAIL, PackageCategory.FREIGHT_RAIL],
  733: [PackageCategory.TRANSPORT, PackageCategory.RAIL, PackageCategory.MONORAIL],
  738: [PackageCategory.TRANSPORT, PackageCategory.RAIL, PackageCategory.FILLERS],
  739: [PackageCategory.TRANSPORT, PackageCategory.RAIL, PackageCategory.MMPS],
  740: [PackageCategory.TRANSPORT, PackageCategory.AIRPORTS],
  741: [PackageCategory.TRANSPORT, PackageCategory.AIRPORTS, PackageCategory.TERMINALS],
  746: [PackageCategory.TRANSPORT, PackageCategory.AIRPORTS, PackageCategory.AIRPLANES],
  748: [PackageCategory.TRANSPORT, PackageCategory.AIRPORTS, PackageCategory.FILLERS],
  749: [PackageCategory.TRANSPORT, PackageCategory.AIRPORTS, PackageCategory.MMPS],
  750: [PackageCategory.TRANSPORT, PackageCategory.WATERFRONT],
  751: [PackageCategory.TRANSPORT, PackageCategory.WATERFRONT, PackageCategory.CANALS],
  752: [PackageCategory.TRANSPORT, PackageCategory.WATERFRONT, PackageCategory.FERRY],
  753: [PackageCategory.TRANSPORT, PackageCategory.WATERFRONT, PackageCategory.SEAPORTS],
  754: [PackageCategory.TRANSPORT, PackageCategory.WATERFRONT, PackageCategory.MARINA],
  756: [PackageCategory.TRANSPORT, PackageCategory.WATERFRONT, PackageCategory.SHIPS],
  758: [PackageCategory.TRANSPORT, PackageCategory.WATERFRONT, PackageCategory.FILLERS],
  759: [PackageCategory.TRANSPORT, PackageCategory.WATERFRONT, PackageCategory.MMPS],
  790: [PackageCategory.TRANSPORT, PackageCategory.AUTOMATA],
  793: [PackageCategory.TRANSPORT, PackageCategory.AUTOMATA, PackageCategory.TRAINS],
  794: [PackageCategory.TRANSPORT, PackageCategory.AUTOMATA, PackageCategory.AIRPLANES],
  795: [PackageCategory.TRANSPORT, PackageCategory.AUTOMATA, PackageCategory.SHIPS],
  800: [PackageCategory.MODS, PackageCategory.CUSTOM],
  900: [PackageCategory.MODS, PackageCategory.OVERRIDES],
  920: [PackageCategory.MODS, PackageCategory.GRAPHICS, PackageCategory.OVERRIDES],
  970: [PackageCategory.TRANSPORT, PackageCategory.OVERRIDES],
  972: [PackageCategory.TRANSPORT, PackageCategory.NAM, PackageCategory.OVERRIDES],
  990: [PackageCategory.MODS, PackageCategory.BLOCKERS],
}

function mapCategory(category: number): PackageCategory[] {
  const categoriesXXX = categoryMapping[category]
  if (categoriesXXX) {
    return categoriesXXX
  }

  const categoriesXX0 = categoryMapping[category - (category % 10)]
  if (categoriesXX0) {
    return categoriesXX0
  }

  const categoriesX00 = categoryMapping[category - (category % 100)]
  if (categoriesX00) {
    return categoriesX00
  }

  return categoryMapping[0]
}

export function getCategories(variantInfo: VariantInfo): PackageCategory[] {
  return mapCategory(variantInfo.category)
}

export function getCategoryLabel(category: PackageCategory): string {
  return t(category, { ns: "PackageCategory" })
}

export function getCategoryPath(category: number): string {
  const categories = mapCategory(category)

  return `${category.toString(10).padStart(3, "0")} - ${getCategoryLabel(categories[categories.length - 1])}`
}

export function getStateLabel(state: PackageState): string {
  return t(state, { ns: "PackageState" })
}

export function isCategory(variantInfo: VariantInfo, category: PackageCategory): boolean {
  return getCategories(variantInfo).includes(category)
}

export function isValidCategory(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 999
}

export function parseCategory(category: string): number {
  const match = category.match(/^\d{1,3}/)
  return (match ? Number.parseInt(match[0], 10) : defaultCategory) as number
}
