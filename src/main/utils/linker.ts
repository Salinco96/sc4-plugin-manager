const DEFAULT_FOLDER_NAME = "Overrides"

const FOLDER_NAMES: { [priority: number]: string | undefined } = {
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

export function getPluginsFolderName(priority: number): string {
  const ordinal = priority.toString().padStart(3, "0")
  const label = FOLDER_NAMES[priority] ?? DEFAULT_FOLDER_NAME
  return `${ordinal}_${label}`
}
