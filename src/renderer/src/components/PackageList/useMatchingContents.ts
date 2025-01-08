import { compact, isDefined, parseHex, values, where } from "@salinco/nice-utils"
import { useMemo } from "react"

import { getTextureIdRange } from "@common/dbpf"
import type { FloraID, FloraInfo } from "@common/mmps"
import type { ContentsInfo } from "@common/variants"
import { Page, useLocation } from "@utils/navigation"
import { isHexSearch, toHexSearch } from "@utils/packages"
import { usePackageFilters } from "@utils/store"

export function useMatchingContents(contents: ContentsInfo | undefined) {
  const { page } = useLocation()
  const { search } = usePackageFilters()

  return useMemo(() => {
    if (contents && isHexSearch(search) && page === Page.Packages) {
      return getMatchingContents(contents, search)
    }
  }, [contents, page, search])
}

export function getMatchingContents(contents: ContentsInfo, search: string) {
  const { buildingFamilies, buildings, lots, mmps, models, propFamilies, props, textures } =
    contents

  const hex = toHexSearch(search)

  const building = buildings?.find(where("id", hex))

  const buildingFamily =
    buildingFamilies?.find(family => family.id === hex) ??
    (!building && buildings?.some(building => building.families?.includes(hex))
      ? { id: hex }
      : undefined)

  const lot = lots?.find(where("id", hex))

  const mmp = mmps?.map(mmp => (mmp.id === hex ? mmp : getStage(mmp, hex))).find(isDefined)

  const modelIds = values(models ?? {}).flatMap(ids => ids.filter(id => id.startsWith(hex)))

  const prop = props?.find(where("id", hex))

  const propFamily =
    propFamilies?.find(family => family.id === hex) ??
    (!prop && props?.some(prop => prop.families?.includes(hex)) ? { id: hex } : undefined)

  const textureIdRange = getTextureIdRange(parseHex(hex))

  const hasTexture = values(textures ?? {}).some(ids => ids.includes(textureIdRange[0]))

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
    ...modelIds.map(id => ({
      element: `model-${id}`,
      name: id,
      type: "Model",
    })),
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
    hasTexture
      ? {
          element: `texture-${textureIdRange[0]}`,
          name: textureIdRange.join(" ... "),
          tab: "textures",
          type: "Texture",
        }
      : undefined,
  ])
}

function getStage(mmp: FloraInfo, id: FloraID) {
  return mmp.stages?.find(stage => stage.id === id)
}
