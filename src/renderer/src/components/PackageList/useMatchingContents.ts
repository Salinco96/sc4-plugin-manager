import type { BuildingInfo } from "@common/buildings"
import type { FamilyInfo } from "@common/families"
import type { LotInfo } from "@common/lots"
import type { FloraID, FloraInfo } from "@common/mmps"
import type { PropInfo } from "@common/props"
import type { ContentsInfo } from "@common/variants"
import { compact, values } from "@salinco/nice-utils"
import { Page, useLocation } from "@utils/navigation"
import { isHexSearch, toHexSearch } from "@utils/packages"
import { usePackageFilters } from "@utils/store"
import { useMemo } from "react"

// todo: move to utils
export function iterate<T, R>(
  iterable: Iterable<T>,
  fn: (value: T) => R | undefined,
): R | undefined {
  for (const value of iterable) {
    const result = fn(value)
    if (result !== undefined) {
      return result
    }
  }
}

export function useMatchingContents({
  buildingFamilies,
  buildings,
  lots,
  mmps,
  propFamilies,
  props,
}: ContentsInfo) {
  const { page } = useLocation()
  const { search } = usePackageFilters()

  return useMemo(() => {
    // Show matching TGIs in package listing
    if (isHexSearch(search) && page === Page.Packages) {
      const hex = toHexSearch(search)

      let building: BuildingInfo | undefined
      let buildingFamily: Omit<FamilyInfo, "file"> | undefined
      let lot: LotInfo | undefined
      let mmp: Omit<FloraInfo, "file"> | undefined
      let prop: PropInfo | undefined
      let propFamily: Omit<FamilyInfo, "file"> | undefined

      if (buildingFamilies) {
        buildingFamily = iterate(values(buildingFamilies), families => families[hex])
      }

      if (buildings) {
        building = iterate(values(buildings), buildings => buildings[hex])

        if (!building && !buildingFamily) {
          const hasFamily = values(buildings).some(buildings =>
            values(buildings).some(building => building.family === hex),
          )

          if (hasFamily) {
            buildingFamily = { id: hex }
          }
        }
      }

      if (lots) {
        lot = iterate(values(lots), lots => lots[hex])
      }

      if (mmps) {
        mmp = iterate(
          values(mmps),
          mmps => mmps[hex] ?? iterate(values(mmps), mmp => getStage(mmp, hex)),
        )
      }

      if (propFamilies) {
        propFamily = iterate(values(propFamilies), families => families[hex])
      }

      if (props) {
        prop = iterate(values(props), props => props[hex])

        if (!prop && !propFamily) {
          const hasFamily = values(props).some(props =>
            values(props).some(prop => prop.family === hex),
          )

          if (hasFamily) {
            propFamily = { id: hex }
          }
        }
      }

      return compact([
        buildingFamily && {
          element: `buildingFamily-${buildingFamily.id}`,
          name: buildingFamily.name ?? buildingFamily.id,
          tab: "lots",
          type: "Building family",
        },
        building && {
          element: `building-${building.id}`,
          name: building.name ?? building.id,
          tab: "lots",
          type: "Building",
        },
        lot && {
          element: `lot-${lot.id}`,
          name: lot.name ?? lot.id,
          tab: "lots",
          type: "Lot",
        },
        mmp && {
          element: `mmp-${mmp.id}`,
          name: mmp.name ?? mmp.id,
          tab: "mmps",
          type: "MMP",
        },
        propFamily && {
          element: `propFamily-${propFamily.id}`,
          name: propFamily.name ?? propFamily.id,
          tab: "props",
          type: "Prop family",
        },
        prop && {
          element: `prop-${prop.id}`,
          name: prop.name ?? prop.id,
          tab: "props",
          type: "Prop",
        },
      ])
    }
  }, [buildingFamilies, buildings, lots, mmps, page, propFamilies, props, search])
}

function getStage(mmp: FloraInfo, id: FloraID) {
  return mmp.stages?.find(stage => stage.id === id)
}
