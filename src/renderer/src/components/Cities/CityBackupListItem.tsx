import { memo, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type { CityBackupInfo, CityID, RegionID } from "@common/regions"
import { VariantState } from "@common/types"
import { ActionButton } from "@components/ActionButton"
import { Header } from "@components/Header"
import { ListItem } from "@components/ListItem"
import { Tags } from "@components/Tags/Tags"
import { TagType, createTag } from "@components/Tags/utils"

import { loadSavePreviewPicture, removeBackup, restoreBackup } from "@stores/actions"
import { store } from "@stores/main"
import { UpdateSaveActionModal, useUpdateSaveActionModal } from "./UpdateSaveActionModal"

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeStyle: "short",
})

export const CityBackupListItem = memo(function CityBackupListItem({
  backup,
  cityId,
  regionId,
}: {
  backup: CityBackupInfo
  cityId: CityID
  regionId: RegionID
}): JSX.Element {
  const city = store.useCityInfo(regionId, cityId)

  const isCurrent = backup.version === city.version

  const [modalProps, openModal] = useUpdateSaveActionModal({
    backup,
    cityId,
    regionId,
  })

  const { t } = useTranslation("CityView")

  const [previewPicture, setPrevieWPicture] = useState<string>()

  // Try to load the PNG preview picture included in save files
  useEffect(() => {
    loadSavePreviewPicture(regionId, cityId, backup.file).then(
      entry => {
        if (entry.data) {
          const src = `data:image/${entry.type};base64, ${entry.data.base64}`
          setPrevieWPicture(src)
        } else {
          setPrevieWPicture(undefined)
        }
      },
      error => {
        if (error instanceof Error && error.message.match(/missing entry/i)) {
          setPrevieWPicture(undefined)
        } else {
          console.error(error)
        }
      },
    )
  }, [backup, cityId, regionId])

  return (
    <ListItem
      actions={
        <>
          <UpdateSaveActionModal {...modalProps} />
          <ActionButton
            actions={[
              {
                action: () => restoreBackup(regionId, cityId, backup.file),
                description: t("actions.restoreBackup.description"),
                disabled: isCurrent,
                id: "restoreBackup",
                label: t("actions.restoreBackup.label"),
              },
              city.established && {
                action: () => openModal("growify"),
                description: t("actions.growify.description"),
                id: "growify",
                label: t("actions.growify.label"),
              },
              city.established && {
                action: () => openModal("historical"),
                description: t("actions.historical.description"),
                id: "makeHistorical",
                label: t("actions.historical.label"),
              },
              {
                action: () => removeBackup(regionId, cityId, backup.file),
                color: "error",
                description: t("actions.removeBackup.description"),
                id: "removeBackup",
                label: t("actions.removeBackup.label"),
              },
            ]}
          />
        </>
      }
      header={Header}
      images={previewPicture ? [previewPicture] : undefined}
      subtitle={backup.file}
      tags={isCurrent && <Tags tags={[createTag(TagType.STATE, VariantState.CURRENT)]} />}
      title={backup.description ?? dateFormat.format(backup.time)}
    />
  )
})
