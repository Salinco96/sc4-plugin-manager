import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
import { Checkbox, Typography } from "@mui/material"
import { collect, where } from "@salinco/nice-utils"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CategoryID } from "@common/categories"
import { DBPFFileType, type TGI } from "@common/dbpf"
import { type LotInfo, isSC4LotFile } from "@common/lots"
import { getRequirementText } from "@common/options"
import type { PackageID } from "@common/packages"
import { VariantState } from "@common/types"
import { FlexBox } from "@components/FlexBox"
import { PackageTag } from "@components/Tags/PackageTag"
import { TagType } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { ImageViewerThumbnail } from "@components/Viewer/ImageViewerThumbnail"
import { formatNumber } from "@utils/format"
import { useCurrentVariant, usePackageStatus } from "@utils/packages"
import { useStore, useStoreActions } from "@utils/store"
import { useEffectEvent } from "@utils/useEffectEvent"

import { ExemplarRef } from "../../ExemplarRef"

export interface PackageViewLotInfoProps {
  isCompatible: boolean
  isEnabled: boolean
  isTogglable: boolean
  isToggleHidden: boolean
  lot: LotInfo
  packageId: PackageID
  setEnabled: (isEnabled: boolean) => void
}

export function PackageViewLotInfo({
  isCompatible,
  isEnabled,
  isTogglable,
  isToggleHidden,
  lot,
  packageId,
  setEnabled,
}: PackageViewLotInfoProps): JSX.Element {
  const actions = useStoreActions()
  const exemplars = useStore(store => store.maxis)
  const packageStatus = usePackageStatus(packageId)
  const profileOptions = useStore(store => store.profileOptions)
  const variantInfo = useCurrentVariant(packageId)

  const isDependency = !!packageStatus?.included && !packageStatus.enabled

  const fileInfo = variantInfo.files?.find(where("path", lot.file))

  const isDisabled = (isTogglable && (!isEnabled || isDependency)) || !isCompatible
  const isMaxisLot = !!exemplars.lots.some(where("id", lot.id))
  const isMaxisOverride = isMaxisLot && lot.file !== "SimCity_1.dat"
  const isPatched = !!fileInfo?.patches // TODO: Check entry, not whole file!

  const [lotPicture, setLotPicture] = useState<string>()

  const { t } = useTranslation("PackageViewLots")

  const loadLotPicture = useEffectEvent(async () => {
    try {
      const entryId: TGI = `${DBPFFileType.PNG_LOT_PICTURES}-${lot.id}`
      const entry = await actions.loadDBPFEntry(packageId, variantInfo.id, lot.file, entryId)
      if (entry.data && "base64" in entry.data) {
        const src = `data:image/${entry.type};base64, ${entry.data.base64}`
        setLotPicture(src)
      } else {
        setLotPicture(undefined)
      }
    } catch (error) {
      if (error instanceof Error && error.message.match(/missing entry/i)) {
        setLotPicture(undefined)
      } else {
        console.error(error)
      }
    }
  })

  useEffect(() => {
    // Try to load the PNG picture sometimes included in SC4Lot files
    if (fileInfo && isSC4LotFile(fileInfo.path)) {
      loadLotPicture()
    }
  }, [fileInfo, loadLotPicture])

  const images = lot.images?.length ? lot.images : lotPicture ? [lotPicture] : undefined

  return (
    <FlexBox
      color={isDisabled ? "rgba(0, 0, 0, 0.6)" : undefined}
      id={`lot-${lot.id}`}
      direction="column"
      gap={2}
      sx={{ opacity: isDisabled ? 0.6 : undefined }}
    >
      <FlexBox alignItems="center">
        {images && <ImageViewerThumbnail images={images} mr={2} mt={1} size={84} />}

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

        {isTogglable && !isToggleHidden && (
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
                  {getRequirementText(t, requirement, value, variantInfo.options, profileOptions)}
                </Typography>
              ))}
            </ul>
          </>
        )}
      </FlexBox>
    </FlexBox>
  )
}
