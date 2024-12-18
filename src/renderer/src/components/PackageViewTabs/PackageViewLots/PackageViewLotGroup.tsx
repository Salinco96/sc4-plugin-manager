import { Card, CardContent, Divider, ListItem } from "@mui/material"
import { add, containsAll, difference, remove, union } from "@salinco/nice-utils"
import { Fragment } from "react"

import type { BuildingInfo } from "@common/buildings"
import type { FamilyID, FamilyInfo } from "@common/families"
import { type LotInfo, isCompatibleLot, isTogglableLot } from "@common/lots"
import type { PackageID } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { useCurrentVariant, usePackageStatus } from "@utils/packages"
import { useCurrentProfile, useFeatures, useSettings, useStore } from "@utils/store"

import { PackageViewBuildingFamilyInfo } from "./PackageViewBuildingFamilyInfo"
import { PackageViewBuildingInfo } from "./PackageViewBuildingInfo"
import { PackageViewLotInfo } from "./PackageViewLotInfo"

export interface PackageViewLotGroupProps {
  building?: BuildingInfo
  buildingFamily?: FamilyInfo
  enabledLots: string[]
  familyId?: FamilyID
  familyBuildings?: BuildingInfo[]
  lots: LotInfo[]
  packageId: PackageID
  setEnabledLots: (enabledLots: string[]) => void
}

export function PackageViewLotGroup({
  building,
  buildingFamily,
  enabledLots,
  familyId = buildingFamily?.id,
  familyBuildings,
  lots,
  packageId,
  setEnabledLots,
}: PackageViewLotGroupProps): JSX.Element {
  const features = useFeatures()
  const settings = useSettings()
  const packageStatus = usePackageStatus(packageId)
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const variantInfo = useCurrentVariant(packageId)

  const isDependency = !!packageStatus?.included && !packageStatus.enabled

  const compatibleLots = lots
    .filter(lot =>
      isCompatibleLot(lot, packageId, variantInfo, profileInfo, profileOptions, features, settings),
    )
    .map(lot => lot.id)

  const togglableLots = lots.filter(isTogglableLot).map(lot => lot.id)

  const isDisabled = !compatibleLots.some(
    id => !togglableLots.includes(id) || (enabledLots.includes(id) && !isDependency),
  )

  return (
    <ListItem sx={{ padding: 0 }}>
      <Card elevation={1} sx={{ display: "flex", width: "100%" }}>
        <CardContent sx={{ width: "100%" }}>
          <FlexBox direction="column" gap={2}>
            {building && (
              <PackageViewBuildingInfo
                building={building}
                isCompatible={!!compatibleLots.length}
                isDisabled={isDisabled}
                isEnabled={containsAll(enabledLots, togglableLots)}
                isTogglable={!!togglableLots.length}
                packageId={packageId}
                setEnabled={enabled => {
                  if (enabled) {
                    setEnabledLots(union(enabledLots, togglableLots))
                  } else {
                    setEnabledLots(difference(enabledLots, togglableLots))
                  }
                }}
              />
            )}

            {familyId && !building && (
              <PackageViewBuildingFamilyInfo
                buildingFamily={buildingFamily}
                familyBuildings={familyBuildings}
                familyId={familyId}
                isCompatible={!!compatibleLots.length}
                isDisabled={isDisabled}
                isEnabled={containsAll(enabledLots, togglableLots)}
                isTogglable={!!togglableLots.length}
                packageId={packageId}
                setEnabled={enabled => {
                  if (enabled) {
                    setEnabledLots(union(enabledLots, togglableLots))
                  } else {
                    setEnabledLots(difference(enabledLots, togglableLots))
                  }
                }}
              />
            )}
          </FlexBox>

          {lots.map((lot, index) => (
            <Fragment key={lot.id}>
              {(building || familyId || index > 0) && <Divider sx={{ marginY: 2 }} />}
              <PackageViewLotInfo
                isCompatible={compatibleLots.includes(lot.id)}
                isEnabled={enabledLots.includes(lot.id) && compatibleLots.includes(lot.id)}
                isTogglable={togglableLots.includes(lot.id)}
                isToggleHidden={lot.file === building?.file}
                lot={lot}
                packageId={packageId}
                setEnabled={enabled => {
                  if (enabled) {
                    setEnabledLots(add(enabledLots, lot.id))
                  } else {
                    setEnabledLots(remove(enabledLots, lot.id))
                  }
                }}
              />
            </Fragment>
          ))}
        </CardContent>
      </Card>
    </ListItem>
  )
}
