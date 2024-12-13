import { compact, isDefined, parseHex, toHex, values, where } from "@salinco/nice-utils"
import { useMemo } from "react"

import { getBaseTextureId } from "@common/dbpf"
import type { FamilyInfo } from "@common/families"
import type { FloraID, FloraInfo } from "@common/mmps"
import type { ContentsInfo } from "@common/variants"
import { Page, useLocation } from "@utils/navigation"
import { isHexSearch, toHexSearch } from "@utils/packages"
import { usePackageFilters } from "@utils/store"

export function useMatchingContents({
  buildingFamilies,
  buildings,
  lots,
  mmps,
  propFamilies,
  props,
  textures,
}: ContentsInfo) {
  const { page } = useLocation()
  const { search } = usePackageFilters()

  return useMemo(() => {
    // Show matching TGIs in package listing
    if (isHexSearch(search) && page === Page.Packages) {
      const hex = toHexSearch(search)

      const building = buildings?.find(where("id", hex))

      const buildingFamily: Omit<FamilyInfo, "file"> | undefined =
        buildingFamilies?.find(where("id", hex)) ??
        (!building && buildings?.some(where("family", hex)) ? { id: hex } : undefined)

      const lot = lots?.find(where("id", hex))

      const mmp = mmps?.map(mmp => (mmp.id === hex ? mmp : getStage(mmp, hex))).find(isDefined)

      const prop = props?.find(where("id", hex))

      const propFamily: Omit<FamilyInfo, "file"> | undefined =
        propFamilies?.find(where("id", hex)) ??
        (!prop && props?.some(where("family", hex)) ? { id: hex } : undefined)

      const textureId = getBaseTextureId(parseHex(hex))

      const texture = values(textures ?? {}).some(ids => ids.includes(textureId))
        ? { id: textureId }
        : undefined

      return compact<{
        element: string
        name: string
        tab?: string
        type: string
      }>([
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
        texture && {
          element: `texture-${texture.id}`,
          name: `${texture.id.replace(/[0-9a-f]$/i, s => toHex(parseHex(s) - 4))} ... ${texture.id}`,
          tab: "textures",
          type: "Texture",
        },
      ])
    }
  }, [buildingFamilies, buildings, lots, mmps, page, propFamilies, props, search, textures])
}

function getStage(mmp: FloraInfo, id: FloraID) {
  return mmp.stages?.find(stage => stage.id === id)
}
