import { BuildingStyle } from "@common/buildings"
import { Menu, type MenuID, Submenu } from "@common/submenus"
import { type MaybeArray, parseStringArray } from "@common/utils/types"
import {
  containsAll,
  difference,
  isArray,
  isNumber,
  isString,
  parseHex,
  sort,
  toHex,
  unique,
  values,
} from "@salinco/nice-utils"

const ALL_MAXIS_TILESETS = "Maxis"
const MAXIS_TILESETS = values(BuildingStyle).filter(isNumber)

export function parseMenu(value: number | string): MenuID {
  if (isNumber(value)) {
    return value as MenuID
  }

  return (Menu[value as keyof typeof Menu] ??
    Submenu[value.replaceAll("/", "_") as keyof typeof Submenu] ??
    parseHex(value)) as MenuID
}

export function parseMenus(value: MaybeArray<number | string>): MenuID[] {
  if (isNumber(value)) {
    return [value as MenuID]
  }

  const values = isArray(value) ? value : value.split(",")
  return unique(values.map(parseMenu))
}

export function parseTilesets(value: MaybeArray<number | string>): BuildingStyle[] {
  return unique(
    (isArray(value) ? value : isString(value) ? parseStringArray(value) : [value]).flatMap(
      tileset => {
        if (tileset === ALL_MAXIS_TILESETS) {
          return MAXIS_TILESETS
        }

        if (isNumber(tileset)) {
          return [tileset]
        }

        return [BuildingStyle[tileset as keyof typeof BuildingStyle] ?? parseHex(tileset)]
      },
    ),
  )
}

export function writeMenu(menu: MenuID): string {
  return Menu[menu] ?? Submenu[menu]?.replaceAll("_", "/") ?? toHex(menu, 8)
}

export function writeMenus(menus: MenuID[]): string {
  return menus.map(writeMenu).join(",")
}

export function writeTilesets(tilesets: BuildingStyle[]): string | undefined {
  if (containsAll(tilesets, MAXIS_TILESETS)) {
    const others = difference(tilesets, MAXIS_TILESETS)
    if (others.length) {
      return [ALL_MAXIS_TILESETS, ...sort(others).map(tileset => toHex(tileset))].join(",")
    }

    return undefined
  }

  return sort(tilesets)
    .map(tileset => BuildingStyle[tileset] ?? toHex(tileset))
    .join(",")
}
