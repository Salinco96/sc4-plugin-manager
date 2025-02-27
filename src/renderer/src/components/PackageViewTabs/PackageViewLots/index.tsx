import { ViewInAr as DependencyIcon } from "@mui/icons-material"
import { Alert, AlertTitle, List } from "@mui/material"
import { forEach, get, groupBy, mapValues, sortBy, unionBy, values } from "@salinco/nice-utils"
import { useEffect, useMemo } from "react"

import type { BuildingID, BuildingInfo } from "@common/buildings"
import type { FamilyID, FamilyInfo } from "@common/families"
import { type LotInfo, getEnabledLots, isSC4LotFile, isTogglableLot } from "@common/lots"
import { type PackageID, checkCondition, checkFile } from "@common/packages"
import { FlexCol } from "@components/FlexBox"
import { setPackageOption } from "@stores/actions"
import { store } from "@stores/main"
import { ui } from "@stores/ui"
import { Page } from "@utils/navigation"

import { PackageViewLotGroup } from "./PackageViewLotGroup"

export default function PackageViewLots({ packageId }: { packageId: PackageID }): JSX.Element {
  const elementId = ui.useStore(state => state.pages[Page.PackageView]?.elementId)

  const features = store.useFeatures()
  const index = store.useIndex()
  const packageStatus = store.usePackageStatus(packageId)
  const profileInfo = store.useCurrentProfile()
  const profileOptions = store.useProfileOptions()
  const settings = store.useSettings()
  const variantInfo = store.useCurrentVariant(packageId)

  const packageConfig = profileInfo?.packages[packageId]

  const isDependency = !!packageStatus?.included && !packageStatus.enabled

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
            false,
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
          const included = families.filter(family => family.file && includedFiles.has(family.file))
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

    const groupedByBuilding: {
      [id in BuildingID | FamilyID]?: {
        building?: BuildingInfo
        buildingFamily?: FamilyInfo
        familyBuildings?: BuildingInfo[]
        familyId?: FamilyID
        groupId: BuildingID | FamilyID
        lots: LotInfo[]
      }
    } = {}

    // Group lots by family
    forEach(lots, lot => {
      const buildingId = lot.building

      if (buildingId) {
        const building = buildings[buildingId] ?? index?.buildings[buildingId]?.[0]

        const buildingFamily =
          buildingFamilies[buildingId] ?? index?.buildingFamilies[buildingId]?.family

        if (building || buildingFamily) {
          groupedByBuilding[buildingId] ??= {
            building,
            buildingFamily,
            familyId: buildingFamily?.id,
            groupId: buildingId,
            lots: [],
          }

          groupedByBuilding[buildingId].lots.push(lot)
        }
      }
    })

    if (index) {
      forEach(index.lots, ([lot]) => {
        const buildingId = lot.building

        if (buildingId) {
          const building = buildings[buildingId]
          const buildingFamily = buildingFamilies[buildingId]

          if (building || buildingFamily) {
            groupedByBuilding[buildingId] ??= {
              building,
              buildingFamily,
              familyId: buildingFamily?.id,
              groupId: buildingId,
              lots: [],
            }

            groupedByBuilding[buildingId].lots.push(lot)
          }
        }
      })
    }

    // Sort props within families
    forEach(groupedByBuilding, group => {
      const { familyId } = group

      if (familyId) {
        group.familyBuildings = unionBy(
          values(buildings).filter(building => building.families?.includes(familyId)),
          index?.buildingFamilies[familyId]?.buildings ?? [],
          building => building.id,
        )
      }
    })

    // Sort families
    return sortBy(
      values(groupedByBuilding),
      group => group.buildingFamily?.name || group.building?.name || group.groupId,
    )
  }, [features, index, packageId, profileInfo, profileOptions, settings, variantInfo])

  return (
    <FlexCol fullHeight>
      {isDependency && groupedLots.some(group => group.lots.some(isTogglableLot)) && (
        <Alert icon={<DependencyIcon fontSize="inherit" />} severity="warning">
          <AlertTitle>SC4Lot files are not included</AlertTitle>
          This package is only included because it is listed as a dependency. To enable all lots,
          enable this package explicitly.
        </Alert>
      )}

      <List sx={{ display: "flex", flexDirection: "column", gap: 2, overflow: "auto", padding: 2 }}>
        {groupedLots.map(group => (
          <PackageViewLotGroup
            {...group}
            enabledLots={enabledLots}
            key={group.groupId}
            packageId={packageId}
            setEnabledLots={lots => setPackageOption(packageId, "lots", lots)}
          />
        ))}
      </List>
    </FlexCol>
  )
}
