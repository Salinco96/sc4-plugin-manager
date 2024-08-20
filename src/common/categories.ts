import { t } from "./i18n"
import { PackageState, VariantInfo } from "./types"

const PRIORITY_DEFAULT_LABEL = "Overrides"

const PRIORITY_LABELS: { [priority: number]: string | undefined } = {
  0: "Mods",
  10: "Cheats",
  20: "Graphics",
  30: "Gameplay",
  100: "Dependencies",
  200: "Residential",
  300: "Commercial",
  360: "Landmarks",
  400: "Industry",
  410: "Agriculture",
  500: "Utilities",
  600: "Civics",
  660: "Parks",
  670: "MMPs",
  700: "Transport",
  720: "NAM",
  730: "Rail",
  740: "Airports",
  750: "Waterfront",
  760: "Automata",
  990: "Blockers",
}

export function getStateLabel(state: PackageState): string {
  return t(state, { ns: "PackageState" })
}

export function getCategories(variantInfo: VariantInfo): string[] {
  return variantInfo.categories
}

export function getCategoryLabel(category: string): string {
  return t(category, { defaultValue: category, ns: "PackageCategory" })
}

export function getPriorityLabel(priority: number): string {
  const ordinal = priority.toString().padStart(3, "0")
  const label = PRIORITY_LABELS[priority] ?? PRIORITY_DEFAULT_LABEL
  return `${ordinal}_${label}`
}

export function isCategory(variantInfo: VariantInfo, category: string): boolean {
  return variantInfo.categories.includes(category)
}
