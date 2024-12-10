import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
import { Checkbox, Typography } from "@mui/material"
import { keys, where } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { BuildingInfo } from "@common/buildings"
import { CategoryID } from "@common/categories"
import type { FamilyID, FamilyInfo } from "@common/families"
import type { PackageID } from "@common/packages"
import { VariantState } from "@common/types"
import { FlexBox } from "@components/FlexBox"
import { PackageTag } from "@components/Tags/PackageTag"
import { TagType, createTag, serializeTag } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { formatRange } from "@utils/format"
import { useCurrentVariant } from "@utils/packages"
import { useStore } from "@utils/store"

import { ExemplarRef } from "../../ExemplarRef"

export interface PackageViewBuildingFamilyInfoProps {
  buildingFamily?: FamilyInfo
  familyBuildings?: BuildingInfo[]
  familyId: FamilyID
  isCompatible: boolean
  isDisabled: boolean
  isEnabled: boolean
  isTogglable: boolean
  packageId: PackageID
  setEnabled: (isEnabled: boolean) => void
}

export function PackageViewBuildingFamilyInfo({
  buildingFamily,
  familyBuildings,
  familyId,
  isCompatible,
  isDisabled,
  isEnabled,
  isTogglable,
  packageId,
  setEnabled,
}: PackageViewBuildingFamilyInfoProps): JSX.Element {
  const exemplars = useStore(store => store.maxis)
  const variantInfo = useCurrentVariant(packageId)

  const filePath = buildingFamily?.file
  const fileInfo = buildingFamily && variantInfo.files?.find(where("path", filePath))

  const isMaxisFamily = !!exemplars.buildingFamilies.some(where("id", familyId))
  const isMaxisOverride = isMaxisFamily && filePath !== "SimCity_1.dat"
  const isPatched = !!fileInfo?.patches // TODO: Check entry, not whole file!

  const { t } = useTranslation("PackageViewLots")

  // Some data, such as tags, should be similar among buildings
  const buildingInfo = familyBuildings?.at(0)
  const tags = buildingInfo?.categories?.map(category => createTag(TagType.CATEGORY, category))

  // Other data can be shown as min-max
  // Note that we expect only growables here so ploppable-only fields will not be computed
  const power = familyBuildings?.map(building => building.power ?? 0)
  const water = familyBuildings?.map(building => building.water ?? 0)

  return (
    <FlexBox
      color={isDisabled ? "rgba(0, 0, 0, 0.38)" : undefined}
      id={`buildingFamily-${familyId}`}
      direction="column"
      gap={2}
    >
      <FlexBox alignItems="center">
        <FlexBox direction="column" width="100%">
          <FlexBox alignItems="center" gap={1} sx={{ flex: 1 }}>
            <Text maxLines={1} variant="h6">
              {buildingFamily?.name ?? "Building family"}
            </Text>
            {isMaxisOverride && (
              <PackageTag color="info" dense type={TagType.CATEGORY} value={CategoryID.OVERRIDES} />
            )}
            {isPatched && <PackageTag dense type={TagType.STATE} value={VariantState.PATCHED} />}
          </FlexBox>

          <ExemplarRef file={filePath} id={familyId} />

          {!!tags?.length && (
            <FlexBox direction="row" gap={1} mt={1}>
              {tags.map(tag => (
                <PackageTag key={serializeTag(tag.type, tag.value)} {...tag} />
              ))}
            </FlexBox>
          )}
        </FlexBox>

        {isTogglable && !!fileInfo && (
          <FlexBox alignSelf="start">
            <Checkbox
              icon={isCompatible ? undefined : <IncompatibleIcon />}
              checked={isEnabled}
              color="primary"
              disabled={!isCompatible}
              name={familyId}
              onClick={async event => {
                const { checked } = event.target as HTMLInputElement
                setEnabled(checked)
              }}
              title={isEnabled ? t("excludeLot") : t("includeLot")}
            />
          </FlexBox>
        )}
      </FlexBox>

      {!!familyBuildings?.length && (
        <FlexBox direction="column" gap={1}>
          {buildingInfo?.capacity && (
            <Typography variant="body2">
              <b>{`${t("capacity")}: `}</b>
              {keys(buildingInfo.capacity)
                .reverse()
                .map(type => {
                  const count = familyBuildings.map(building => building.capacity?.[type] ?? 0)
                  return `${formatRange(Math.min(...count), Math.max(...count))} ${type.toUpperCase()}`
                })
                .join("; ")}
            </Typography>
          )}

          {power && (
            <Typography variant="body2">
              <b>{`${t("power")}: `}</b>
              {formatRange(Math.min(...power), Math.max(...power))}
            </Typography>
          )}

          {water && (
            <Typography variant="body2">
              <b>{`${t("water")}: `}</b>
              {formatRange(Math.min(...water), Math.max(...water))}
            </Typography>
          )}
        </FlexBox>
      )}
    </FlexBox>
  )
}
