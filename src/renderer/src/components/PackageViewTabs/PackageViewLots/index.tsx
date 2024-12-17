import { List } from "@mui/material"
import { get, groupBy, mapValues, values, where } from "@salinco/nice-utils"
import { useEffect, useMemo } from "react"

import { getEnabledLots, isSC4LotFile } from "@common/lots"
import { checkCondition, checkFile } from "@common/packages"
import { useCurrentVariant } from "@utils/packages"
import {
  useCurrentProfile,
  useFeatures,
  useSettings,
  useStore,
  useStoreActions,
} from "@utils/store"

import type { PackageViewTabInfoProps } from "../tabs"
import { PackageViewLotGroup } from "./PackageViewLotGroup"

export default function PackageViewLots({ packageId }: PackageViewTabInfoProps): JSX.Element {
  const actions = useStoreActions()
  const elementId = useStore(store => store.packageView.elementId)
  const maxis = useStore(store => store.maxis)
  const features = useFeatures()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const packageConfig = profileInfo?.packages[packageId]
  const settings = useSettings()
  const variantInfo = useCurrentVariant(packageId)

  useEffect(() => {
    if (elementId) {
      document.getElementById(elementId)?.scrollIntoView({ block: "center", inline: "center" })
    }
  }, [elementId])

  const enabledLots = getEnabledLots(variantInfo.lots ?? [], packageConfig)

  const groupedLots = useMemo(() => {
    const includedFiles = new Set(
      variantInfo.files
        ?.filter(file =>
          checkFile(
            file,
            packageId,
            variantInfo,
            profileInfo,
            profileOptions,
            features,
            settings,
            undefined,
            true,
          ),
        )
        .map(file => file.path),
    )

    // Collect unique buildings by ID
    const buildings = mapValues(
      groupBy(variantInfo.buildings ?? [], get("id")),
      (buildings, buildingId) => {
        if (buildings.length !== 1) {
          const included = buildings.filter(building => includedFiles.has(building.file))
          if (included.length === 1) {
            return included[0]
          }

          const compatible = buildings.filter(
            building =>
              !isSC4LotFile(building.file) ||
              checkCondition(
                variantInfo.lots?.find(lot => lot.file === building.file)?.requirements,
                packageId,
                variantInfo,
                profileInfo,
                profileOptions,
                features,
                settings,
              ),
          )

          if (compatible.length === 1) {
            return compatible[0]
          }

          console.warn(`Duplicate building ${buildingId}`)
        }

        return buildings[0]
      },
    )

    // Collect unique building families by ID
    const buildingFamilies = mapValues(
      groupBy(variantInfo.buildingFamilies ?? [], get("id")),
      (families, familyId) => {
        if (families.length !== 1) {
          const included = families.filter(family => includedFiles.has(family.file))
          if (included.length === 1) {
            return included[0]
          }

          console.warn(`Duplicate building family ${familyId}`)
        }

        return families[0]
      },
    )

    // Collect unique lots by ID
    const lots = mapValues(groupBy(variantInfo.lots ?? [], get("id")), (lots, lotId) => {
      if (lots.length !== 1) {
        const included = lots.filter(lot => includedFiles.has(lot.file))
        if (included.length === 1) {
          return included[0]
        }

        const compatible = lots.filter(lot =>
          checkCondition(
            lot.requirements,
            packageId,
            variantInfo,
            profileInfo,
            profileOptions,
            features,
            settings,
          ),
        )

        if (compatible.length === 1) {
          return compatible[0]
        }

        console.warn(`Duplicate lot ${lotId}`)
      }

      return lots[0]
    })

    // Group lots by building
    return values(
      mapValues(
        {
          ...groupBy(
            maxis.lots.filter(
              lot => lot.building && (buildings[lot.building] || buildingFamilies[lot.building]),
            ),
            lot => lot.building ?? null,
          ),
          ...groupBy(values(lots), lot => lot.building ?? lot.id),
        },
        (lots, id) => {
          const building = buildings[id] ?? maxis.buildings.find(where("id", id))
          if (building) {
            return { building, id, lots }
          }

          const buildingFamily =
            buildingFamilies[id] ?? maxis.buildingFamilies.find(where("id", id))

          const familyBuildings = [
            ...values(buildings).filter(where("family", id)),
            ...maxis.buildings.filter(where("family", id)),
          ]

          return { buildingFamily, familyBuildings, familyId: id, id, lots }
        },
      ),
    )
  }, [features, maxis, packageId, profileInfo, profileOptions, settings, variantInfo])

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {groupedLots.map(group => (
        <PackageViewLotGroup
          {...group}
          enabledLots={enabledLots}
          key={group.id}
          packageId={packageId}
          setEnabledLots={lots => actions.setPackageOption(packageId, "lots", lots)}
        />
      ))}
    </List>
  )
}
