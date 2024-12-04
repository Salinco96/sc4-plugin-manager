import { Menu, type MenuID, Submenu } from "@common/submenus"
import type { MaybeArray } from "@common/utils/types"
import { isArray, isNumber, parseHex, toHex, unique } from "@salinco/nice-utils"

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

export function writeMenu(menu: MenuID): string {
  return Menu[menu] ?? Submenu[menu]?.replaceAll("_", "/") ?? toHex(menu, 8)
}

export function writeMenus(menus: MenuID[]): string {
  return menus.map(writeMenu).join(",")
}
