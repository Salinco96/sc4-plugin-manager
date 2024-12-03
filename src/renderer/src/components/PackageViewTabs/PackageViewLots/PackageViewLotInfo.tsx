import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
import { Checkbox, Typography } from "@mui/material"
import { collect } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import { CategoryID } from "@common/categories"
import type { LotInfo } from "@common/lots"
import { getRequirementLabel, getRequirementValueLabel } from "@common/options"
import type { PackageID } from "@common/packages"
import { VariantState } from "@common/types"
import { FlexBox } from "@components/FlexBox"
import { PackageTag } from "@components/Tags/PackageTag"
import { TagType } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { ImageViewerThumbnail } from "@components/Viewer/ImageViewerThumbnail"
import { formatNumber } from "@utils/format"
import { useCurrentVariant } from "@utils/packages"
import { useStore } from "@utils/store"
import { ExemplarRef } from "./ExemplarRef"

export interface PackageViewLotInfoProps {
  isCompatible: boolean
  isEnabled: boolean
  isTogglable: boolean
  lot: LotInfo
  packageId: PackageID
  setEnabled: (isEnabled: boolean) => void
}

export function PackageViewLotInfo({
  isCompatible,
  isEnabled,
  isTogglable,
  lot,
  packageId,
  setEnabled,
}: PackageViewLotInfoProps): JSX.Element {
  const exemplars = useStore(store => store.exemplars)
  const profileOptions = useStore(store => store.profileOptions)
  const variantInfo = useCurrentVariant(packageId)

  const fileInfo = variantInfo.files?.find(file => file.path === lot.file)
  const maxisLot = exemplars.lots[lot.id]

  const isMaxisOverride = maxisLot !== undefined && lot.file !== "SimCity_1.dat"
  const isPatched = !!fileInfo?.patches // TODO: Check entry, not whole file!

  const { t } = useTranslation("PackageViewLots")

  return (
    <FlexBox id={`lot-${lot.id}`} direction="column" gap={2}>
      <FlexBox alignItems="center">
        {!!lot.images?.length && (
          <ImageViewerThumbnail images={lot.images} mr={2} mt={1} size={84} />
        )}

        <FlexBox direction="column" width="100%">
          <FlexBox alignItems="center" gap={1} sx={{ flex: 1 }}>
            <Text maxLines={1} variant="h6">
              {lot.name ?? "Lot"}
            </Text>
            {isMaxisOverride && (
              <PackageTag dense color="info" type={TagType.CATEGORY} value={CategoryID.OVERRIDES} />
            )}
            {isPatched && <PackageTag dense type={TagType.STATE} value={VariantState.PATCHED} />}
          </FlexBox>

          <ExemplarRef file={lot.file} id={lot.id} />
        </FlexBox>

        {isTogglable && (
          <FlexBox alignSelf="start">
            <Checkbox
              icon={isCompatible ? undefined : <IncompatibleIcon />}
              checked={isEnabled}
              color="primary"
              disabled={!isCompatible}
              name={lot.id}
              onClick={async event => {
                const { checked } = event.target as HTMLInputElement
                setEnabled(checked)
              }}
              title={isEnabled ? t("excludeLot") : t("includeLot")}
            />
          </FlexBox>
        )}
      </FlexBox>

      <FlexBox direction="column" gap={1}>
        {!!lot.density?.length && (
          <Typography variant="body2">
            <b>{`${t("density")}: `}</b>
            {lot.density.map(density => t(density, { ns: "ZoneDensity" })).join(", ")}
          </Typography>
        )}

        {lot.stage !== undefined && (
          <Typography variant="body2">
            <b>{`${t("stage")}: `}</b>
            {formatNumber(lot.stage)}
          </Typography>
        )}

        {lot.size !== undefined && (
          <Typography variant="body2">
            <b>{`${t("size")}: `}</b>
            {lot.size}
          </Typography>
        )}

        {lot.requirements !== undefined && (
          <>
            <Typography variant="body2">
              <b>{`${t("requirements")}: `}</b>
            </Typography>
            <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
              {collect(lot.requirements, (value, requirement) => (
                <Typography component="li" key={requirement} variant="body2">
                  {`${getRequirementLabel(
                    t,
                    requirement,
                    variantInfo.options,
                    profileOptions,
                  )}: ${getRequirementValueLabel(
                    t,
                    requirement,
                    value,
                    variantInfo.options,
                    profileOptions,
                  )}`}
                </Typography>
              ))}
            </ul>
          </>
        )}
      </FlexBox>
    </FlexBox>
  )
}
