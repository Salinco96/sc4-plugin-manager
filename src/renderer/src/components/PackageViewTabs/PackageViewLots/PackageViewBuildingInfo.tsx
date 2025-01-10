import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
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
import { FlexBox } from "@components/FlexBox"
import { Tag } from "@components/Tags/Tag"
import { TagType, createTag, serializeTag } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { ImageViewerThumbnail } from "@components/Viewer/ImageViewerThumbnail"
import { formatNumber, formatSimoleans } from "@utils/format"
import { useCurrentVariant } from "@utils/packages"
import { useFeatures, useStore } from "@utils/store"

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
  const features = useFeatures()
  const variantInfo = useCurrentVariant(packageId)

  const fileInfo = variantInfo.files?.find(where("path", building.file))

  const isMaxisBuilding = useStore(
    store => !!store.maxis?.buildings?.some(where("id", building.id)),
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

  return (
    <FlexBox
      color={isDisabled ? "rgba(0, 0, 0, 0.6)" : undefined}
      id={`building-${building.id}`}
      direction="column"
      gap={2}
      sx={{ opacity: isDisabled ? 0.6 : undefined }}
    >
      <FlexBox alignItems="center">
        {!!building.images?.length && (
          <ImageViewerThumbnail images={building.images} mr={2} mt={1} size={84} />
        )}

        <FlexBox direction="column" width="100%">
          <FlexBox alignItems="center" gap={1} sx={{ flex: 1 }}>
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
          </FlexBox>

          <ExemplarRef
            file={building.file}
            group={building.group}
            id={building.id}
            type={TypeID.EXEMPLAR}
          />

          {!!tags?.length && (
            <FlexBox direction="row" gap={1} mt={1}>
              {tags.map(tag => (
                <Tag key={serializeTag(tag.type, tag.value)} tag={tag} />
              ))}
            </FlexBox>
          )}
        </FlexBox>

        {isTogglable && !isMaxisBuilding && (
          <FlexBox alignSelf="start">
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
          </FlexBox>
        )}
      </FlexBox>

      {building.description && (
        <Typography sx={{ fontStyle: "italic", whiteSpace: "pre" }} variant="body2">
          {building.description}
        </Typography>
      )}

      <FlexBox direction="column" gap={1}>
        {!!menus?.length && (
          <Typography variant="body2">
            <b>{`${t("menu")}: `}</b>
            {menus.map(getMenuLabel).join(", ")}
          </Typography>
        )}

        {!!building.tilesets?.length && (
          <Typography variant="body2">
            <b>{`${t("tilesets")}: `}</b>
            {building.tilesets.map(tileset => `0x${toHex(tileset)}`).join(", ")}
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
      </FlexBox>
    </FlexBox>
  )
}
