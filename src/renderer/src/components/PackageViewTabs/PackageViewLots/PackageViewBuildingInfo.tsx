import {
  Agriculture as AgricultureIcon,
  CorporateFare as CommercialIcon,
  DoDisturb as IncompatibleIcon,
  Factory as IndustrialIcon,
  AccountBalance as PlopableIcon,
  Apartment as ResidentialIcon,
} from "@mui/icons-material"
import { Checkbox, Typography } from "@mui/material"
import { toHex, where } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { BuildingInfo } from "@common/buildings"
import { CategoryID } from "@common/categories"
import { TypeID } from "@common/dbpf"
import type { PackageID } from "@common/packages"
import { getMenuLabel } from "@common/submenus"
import { VariantState } from "@common/types"
import { ExemplarRef } from "@components/ExemplarRef"
import { FlexCol, FlexRow } from "@components/FlexBox"
import { Tag } from "@components/Tags/Tag"
import { TagType, createTag, serializeTag } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { ImageViewerThumbnail } from "@components/Viewer/ImageViewerThumbnail"
import { store } from "@stores/main"
import { formatNumber, formatSimoleans } from "@utils/format"

export interface PackageViewBuildingInfoProps {
  building: BuildingInfo
  isCompatible: boolean
  isDisabled: boolean
  isEnabled: boolean
  isTogglable: boolean
  packageId: PackageID
  setEnabled: (isEnabled: boolean) => void
}

export function PackageViewBuildingInfo({
  building,
  isCompatible,
  isDisabled,
  isEnabled,
  isTogglable,
  packageId,
  setEnabled,
}: PackageViewBuildingInfoProps): JSX.Element {
  const features = store.useFeatures()
  const index = store.useIndex()
  const variantInfo = store.useCurrentVariant(packageId)

  const fileInfo = variantInfo.files?.find(where("path", building.file))

  const isMaxisBuilding = index?.buildings[building.id]?.some(
    building => building.file === "SimCity_1.dat",
  )

  const isMaxisOverride = isMaxisBuilding && building.file !== "SimCity_1.dat"
  const isPatched = !!fileInfo?.patches // TODO: Check entry, not whole file!

  const { t } = useTranslation("PackageViewLots")

  const tags = building.categories?.map(category => createTag(TagType.CATEGORY, category))

  const menus =
    features.submenus && building.submenus
      ? building.submenus
      : building.menu
        ? [building.menu]
        : undefined

  const isResidential =
    building.cost === undefined &&
    (!!building.capacity?.r$ || !!building.capacity?.r$$ || !!building.capacity?.r$$$)

  const isCommercial =
    building.cost === undefined &&
    (!!building.capacity?.cs$ ||
      !!building.capacity?.cs$$ ||
      !!building.capacity?.cs$$$ ||
      !!building.capacity?.co$$ ||
      !!building.capacity?.co$$$)

  const isIndustrial =
    building.cost === undefined &&
    (!!building.capacity?.id || !!building.capacity?.im || !!building.capacity?.iht)

  const isAgriculture = building.cost === undefined && !!building.capacity?.ir

  const isPlop = !isResidential && !isCommercial && !isIndustrial && !isAgriculture

  return (
    <FlexCol
      color={isDisabled ? "rgba(0, 0, 0, 0.6)" : undefined}
      id={`building-${building.id}`}
      gap={2}
      sx={{ opacity: isDisabled ? 0.6 : undefined }}
    >
      <FlexRow centered>
        {!!building.images?.length && (
          <ImageViewerThumbnail images={building.images} mr={2} mt={1} size={84} />
        )}

        <FlexCol fullWidth>
          <FlexRow centered flex={1} gap={1}>
            {isResidential && <ResidentialIcon />}
            {isCommercial && <CommercialIcon />}
            {isIndustrial && <IndustrialIcon />}
            {isAgriculture && <AgricultureIcon />}
            {isPlop && <PlopableIcon />}
            <Text maxLines={1} variant="h6">
              {building.label ?? building.name ?? "Building"}
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

          <ExemplarRef
            file={building.file}
            group={building.group}
            id={building.id}
            type={TypeID.EXEMPLAR}
          />

          {!!tags?.length && (
            <FlexRow gap={1} mt={1}>
              {tags.map(tag => (
                <Tag key={serializeTag(tag.type, tag.value)} tag={tag} />
              ))}
            </FlexRow>
          )}
        </FlexCol>

        {isTogglable && !isMaxisBuilding && (
          <FlexRow alignSelf="start">
            <Checkbox
              icon={isCompatible ? undefined : <IncompatibleIcon />}
              checked={isEnabled}
              color="primary"
              disabled={!isCompatible}
              name={building.id}
              onClick={async event => {
                const { checked } = event.target as HTMLInputElement
                setEnabled(checked)
              }}
              title={isEnabled ? t("excludeLot") : t("includeLot")}
            />
          </FlexRow>
        )}
      </FlexRow>

      {building.description && (
        <Typography fontStyle="italic" variant="body2" whiteSpace="pre">
          {building.description}
        </Typography>
      )}

      <FlexCol gap={1}>
        {!!menus?.length && (
          <Typography variant="body2">
            <b>{`${t("menu")}: `}</b>
            {menus.map(getMenuLabel).join(", ")}
          </Typography>
        )}

        {!!building.tilesets?.length && (
          <Typography variant="body2">
            <b>{`${t("tilesets")}: `}</b>
            {building.tilesets
              .map(tileset =>
                t(toHex(tileset), {
                  defaultValue: `0x${toHex(tileset)}`,
                  ns: "BuildingStyle",
                }),
              )
              .join(", ")}
          </Typography>
        )}

        {building.cost !== undefined && (
          <Typography variant="body2">
            <b>{`${t("cost")}: `}</b>
            {formatSimoleans(building.cost)}
          </Typography>
        )}

        {building.maintenance !== undefined && (
          <Typography variant="body2">
            <b>{`${t("maintenance")}: `}</b>
            {formatSimoleans(building.maintenance)} / month
          </Typography>
        )}

        {building.bulldoze !== undefined && (
          <Typography variant="body2">
            <b>{`${t("bulldoze")}: `}</b>
            {formatSimoleans(building.bulldoze)}
          </Typography>
        )}

        {building.capacity !== undefined && (
          <Typography variant="body2">
            <b>{`${t("capacity")}: `}</b>
            {Object.entries(building.capacity)
              .reverse()
              .map(([type, count]) => `${formatNumber(count)} ${type.toUpperCase()}`)
              .join("; ")}
          </Typography>
        )}

        {building.jobs !== undefined && (
          <Typography variant="body2">
            <b>{`${t("jobs")}: `}</b>
            {Object.entries(building.jobs)
              .reverse()
              .map(([type, count]) => `${formatNumber(count)} ${type.toUpperCase()}`)
              .join("; ")}
          </Typography>
        )}

        {building.relief !== undefined && (
          <Typography variant="body2">
            <b>{`${t("relief")}: `}</b>
            {Object.entries(building.relief)
              .reverse()
              .map(([type, count]) => `${formatNumber(count)} ${type.toUpperCase()}`)
              .join("; ")}
          </Typography>
        )}

        {building.landmark !== undefined && (
          <Typography variant="body2">
            <b>{`${t("landmark")}: `}</b>
            {t("overTiles", {
              amount: formatNumber(building.landmark),
              count: building.landmarkRadius ?? 0,
            })}
          </Typography>
        )}

        {building.rating !== undefined && (
          <Typography variant="body2">
            <b>{`${t("rating")}: `}</b>
            {t("overTiles", {
              amount: formatNumber(building.rating),
              count: building.ratingRadius ?? 0,
            })}
          </Typography>
        )}

        {building.powerProduction !== undefined && (
          <Typography variant="body2">
            <b>{`${t("powerProduction")}: `}</b>
            {formatNumber(building.powerProduction)}
          </Typography>
        )}

        {building.power !== undefined && (
          <Typography variant="body2">
            <b>{`${t("power")}: `}</b>
            {formatNumber(building.power)}
          </Typography>
        )}

        {building.waterProduction !== undefined && (
          <Typography variant="body2">
            <b>{`${t("waterProduction")}: `}</b>
            {formatNumber(building.waterProduction)}
          </Typography>
        )}

        {building.water !== undefined && (
          <Typography variant="body2">
            <b>{`${t("water")}: `}</b>
            {formatNumber(building.water)}
          </Typography>
        )}

        {building.pollution !== undefined && (
          <Typography variant="body2">
            <b>{`${t("pollution")}: `}</b>
            {t("overTiles", {
              amount: formatNumber(building.pollution),
              count: building.pollutionRadius ?? 0,
            })}
          </Typography>
        )}

        {building.waterPollution !== undefined && (
          <Typography variant="body2">
            <b>{`${t("waterPollution")}: `}</b>
            {t("overTiles", {
              amount: formatNumber(building.waterPollution),
              count: building.waterPollutionRadius ?? 0,
            })}
          </Typography>
        )}

        {building.garbage !== undefined && (
          <Typography variant="body2">
            <b>{`${t("garbage")}: `}</b>
            {t("overTiles", {
              amount: formatNumber(building.garbage),
              count: building.garbageRadius ?? 0,
            })}
          </Typography>
        )}

        {building.radiation !== undefined && (
          <Typography variant="body2">
            <b>{`${t("radiation")}: `}</b>
            {t("overTiles", {
              amount: formatNumber(building.radiation),
              count: building.radiationRadius ?? 0,
            })}
          </Typography>
        )}

        {building.flamability !== undefined && (
          <Typography variant="body2">
            <b>{`${t("flamability")}: `}</b>
            {formatNumber(building.flamability)}
          </Typography>
        )}
      </FlexCol>
    </FlexCol>
  )
}
