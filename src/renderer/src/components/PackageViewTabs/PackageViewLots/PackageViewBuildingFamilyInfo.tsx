import {
  Agriculture as AgricultureIcon,
  CorporateFare as CommercialIcon,
  DoDisturb as IncompatibleIcon,
  Factory as IndustrialIcon,
  AccountBalance as PlopableIcon,
  Apartment as ResidentialIcon,
} from "@mui/icons-material"
import { Checkbox, Typography } from "@mui/material"
import { keys, sum, where } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { BuildingInfo } from "@common/buildings"
import { CategoryID } from "@common/categories"
import type { FamilyID, FamilyInfo } from "@common/families"
import type { PackageID } from "@common/packages"
import { VariantState } from "@common/types"
import { ExemplarRef } from "@components/ExemplarRef"
import { FlexCol, FlexRow } from "@components/FlexBox"
import { Tag } from "@components/Tags/Tag"
import { TagType, createTag, serializeTag } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { formatRange } from "@utils/format"
import { useCurrentVariant } from "@utils/packages"
import { useStore } from "@utils/store"

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
  const variantInfo = useCurrentVariant(packageId)

  const filePath = buildingFamily?.file
  const fileInfo = buildingFamily && variantInfo.files?.find(where("path", filePath))

  const isMaxisFamily = useStore(
    store => !!store.maxis?.buildingFamilies?.some(family => family.id === familyId),
  )

  const maxisBuildings = useStore.shallow(store =>
    store.maxis?.buildings?.filter(building => building.families?.includes(familyId)),
  )

  const buildings = [...(familyBuildings ?? []), ...(maxisBuildings ?? [])]

  const isMaxisOverride = isMaxisFamily && filePath !== "SimCity_1.dat"
  const isPatched = !!fileInfo?.patches // TODO: Check entry, not whole file!

  const { t } = useTranslation("PackageViewLots")

  // Some data, such as tags, should be similar among buildings
  const building = buildings.at(0)
  const tags = building?.categories?.map(category => createTag(TagType.CATEGORY, category))

  // Other data can be shown as min-max
  // Note that we expect only growables here so ploppable-only fields will not be computed
  const power = buildings.map(building => building.power ?? 0)
  const water = buildings.map(building => building.water ?? 0)

  const isResidential =
    !!building &&
    building.cost === undefined &&
    (!!building.capacity?.r$ || !!building.capacity?.r$$ || !!building.capacity?.r$$$)

  const isCommercial =
    !!building &&
    building.cost === undefined &&
    (!!building.capacity?.cs$ ||
      !!building.capacity?.cs$$ ||
      !!building.capacity?.cs$$$ ||
      !!building.capacity?.co$$ ||
      !!building.capacity?.co$$$)

  const isIndustrial =
    !!building &&
    building.cost === undefined &&
    (!!building.capacity?.id || !!building.capacity?.im || !!building.capacity?.iht)

  const isAgriculture = !!building && building.cost === undefined && !!building.capacity?.ir

  const isPlop = !!building && !isResidential && !isCommercial && !isIndustrial && !isAgriculture

  return (
    <FlexCol
      color={isDisabled ? "rgba(0, 0, 0, 0.38)" : undefined}
      id={`buildingFamily-${familyId}`}
      gap={2}
    >
      <FlexRow centered>
        <FlexCol fullWidth>
          <FlexRow centered flex={1} gap={1}>
            {isResidential && <ResidentialIcon />}
            {isCommercial && <CommercialIcon />}
            {isIndustrial && <IndustrialIcon />}
            {isAgriculture && <AgricultureIcon />}
            {isPlop && <PlopableIcon />}

            <Text maxLines={1} variant="h6">
              {buildingFamily?.name ?? "Building family"}
            </Text>
            {isMaxisOverride && (
              <Tag
                color="info"
                dense
                tag={{ type: TagType.CATEGORY, value: CategoryID.OVERRIDES }}
              />
            )}
            {isPatched && <Tag dense tag={{ type: TagType.STATE, value: VariantState.PATCHED }} />}
          </FlexRow>

          <ExemplarRef file={filePath} id={familyId} />

          {!!tags?.length && (
            <FlexRow gap={1} mt={1}>
              {tags.map(tag => (
                <Tag key={serializeTag(tag.type, tag.value)} tag={tag} />
              ))}
            </FlexRow>
          )}
        </FlexCol>

        {isTogglable && !!fileInfo && (
          <FlexRow alignSelf="start">
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
          </FlexRow>
        )}
      </FlexRow>

      {!!familyBuildings?.length && (
        <FlexCol gap={1}>
          {building?.capacity && (
            <Typography variant="body2">
              <b>{`${t("capacity")}: `}</b>
              {keys(building.capacity)
                .reverse()
                .map(type => {
                  const count = familyBuildings.map(building => building.capacity?.[type] ?? 0)
                  return `${formatRange(Math.min(...count), Math.max(...count))} ${type.toUpperCase()}`
                })
                .join("; ")}
            </Typography>
          )}

          {!!sum(power) && (
            <Typography variant="body2">
              <b>{`${t("power")}: `}</b>
              {formatRange(Math.min(...power), Math.max(...power))}
            </Typography>
          )}

          {!!sum(water) && (
            <Typography variant="body2">
              <b>{`${t("water")}: `}</b>
              {formatRange(Math.min(...water), Math.max(...water))}
            </Typography>
          )}
        </FlexCol>
      )}
    </FlexCol>
  )
}
