import { mapDefined, values } from "@salinco/nice-utils"
import { useMemo } from "react"

import type { Exemplars } from "@common/state"
import type { VariantInfo } from "@common/variants"
import { Page, useLocation } from "@utils/navigation"
import { isHexSearch, toHexSearch } from "@utils/packages"
import { usePackageFilters } from "@utils/store"

export function useMatchingContents({
  buildingFamilies,
  buildings,
  lots,
  propFamilies,
  props,
}: Pick<VariantInfo, keyof Exemplars>) {
  const { page } = useLocation()
  const { search } = usePackageFilters()

  return useMemo(() => {
    // Show matching TGIs in package listing
    if (isHexSearch(search) && page === Page.Packages) {
      const hexSearch = toHexSearch(search)

      const contents: {
        element: string
        name: string
        tab: string
        type: string
      }[] = []

      const buildingFamily = mapDefined(
        values(buildingFamilies ?? {}),
        families => families[hexSearch],
      ).at(0)

      if (buildingFamily) {
        contents.push({
          element: `buildingFamily-${hexSearch}`,
          name: buildingFamily.name ?? hexSearch,
          tab: "lots",
          type: "Building family",
        })
      }

      const building = mapDefined(values(buildings ?? {}), buildings => buildings[hexSearch]).at(0)

      if (building) {
        contents.push({
          element: `building-${hexSearch}`,
          name: building.name ?? hexSearch,
          tab: "lots",
          type: "Building",
        })
      }

      if (
        !building &&
        !buildingFamily &&
        values(buildings ?? {}).some(buildings =>
          values(buildings).some(building => building.family === hexSearch),
        )
      ) {
        contents.push({
          element: `buildingFamily-${hexSearch}`,
          name: hexSearch,
          tab: "lots",
          type: "Building family",
        })
      }

      const lot = mapDefined(values(lots ?? {}), lots => lots[hexSearch]).at(0)

      if (lot) {
        contents.push({
          element: `lot-${hexSearch}`,
          name: lot.name ?? hexSearch,
          tab: "lots",
          type: "Lot",
        })
      }

      const propFamily = mapDefined(values(propFamilies ?? {}), families => families[hexSearch]).at(
        0,
      )

      if (propFamily) {
        contents.push({
          element: `propFamily-${hexSearch}`,
          name: propFamily.name ?? hexSearch,
          tab: "props",
          type: "Prop family",
        })
      }

      const prop = mapDefined(values(props ?? {}), props => props[hexSearch]).at(0)

      if (prop) {
        contents.push({
          element: `prop-${hexSearch}`,
          name: prop.name ?? hexSearch,
          tab: "props",
          type: "Prop",
        })
      }

      if (
        !prop &&
        !propFamily &&
        values(props ?? {}).some(props => values(props).some(prop => prop.family === hexSearch))
      ) {
        contents.push({
          element: `propFamily-${hexSearch}`,
          name: hexSearch,
          tab: "props",
          type: "Prop family",
        })
      }

      return contents
    }
  }, [buildingFamilies, buildings, lots, page, propFamilies, props, search])
}
