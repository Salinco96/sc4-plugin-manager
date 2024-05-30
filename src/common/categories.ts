declare const Tag: unique symbol

// 0 is pass-through, e.g. 337 will look (in order) for 337, then 330, then 300, then 0
const CATEGORIES: { [categoryId: number]: string } = {
  0: "Mods",
  30: "Colossus Addon Mod",
  60: "DLL Mods",
  100: "Dependencies",
  110: "Textures",
  120: "Props",
  200: "Residential",
  210: "Residential (R$)",
  220: "Residential (R$$)",
  230: "Residential (R$$$)",
  280: "Residential (Custom)",
  290: "Residential (Overrides)",
  300: "Commercial",
  310: "Commercial (CS$)",
  320: "Commercial (CS$$)",
  330: "Commercial (CS$$$)",
  340: "Commercial (CO$$)",
  350: "Commercial (CO$$$)",
  360: "Landmarks",
  380: "Commercial (Custom)",
  390: "Commercial (Overrides)",
  400: "Industrial",
  410: "Industrial (Agriculture)",
  420: "Industrial (Dirty)",
  430: "Industrial (Manufacture)",
  440: "Industrial (High-Tech)",
  480: "Industrial (Custom)",
  490: "Industrial (Overrides)",
  500: "Utilities",
  510: "Energy",
  520: "Water",
  530: "Waste",
  580: "Utilities (Custom)",
  590: "Utilities (Overrides)",
  600: "Civics",
  610: "Safety",
  620: "Education",
  630: "Healthcare",
  640: "Governement",
  650: "Religion",
  660: "Parks",
  680: "Civics (Custom)",
  690: "Civics (Overrides)",
  700: "Transport",
  710: "Automata",
  770: "Network Addon Mod",
  780: "Transport (Custom)",
  790: "Transport (Overrides)",
  800: "Custom",
  900: "Overrides",
  960: "Maxis Blockers",
  970: "Network Overrides",
  980: "Overrides (Custom)",
}

export type CategoryID = number & { [Tag]: "CategoryId" }

export function formatCategory(categoryId: CategoryID, short?: boolean): string {
  return `${categoryId.toString(10).padStart(3, "0")}${short ? "" : ` - ${getCategoryLabel(categoryId)}`}`
}

export function parseCategoryID(category: string): CategoryID {
  const match = category.match(/^\d{3}/)?.[0]
  return (match ? Number.parseInt(match, 10) : 800) as CategoryID
}

export function getCategoryLabel(categoryId: CategoryID): string {
  return (
    // xxx
    CATEGORIES[categoryId] ??
    // xx0
    CATEGORIES[categoryId - (categoryId % 10)] ??
    // x00
    CATEGORIES[categoryId - (categoryId % 100)] ??
    // 000
    CATEGORIES[0]
  )
}

export function isValidCategoryID(value: number): value is CategoryID {
  return Number.isInteger(value) && value >= 0 && value <= 999
}
