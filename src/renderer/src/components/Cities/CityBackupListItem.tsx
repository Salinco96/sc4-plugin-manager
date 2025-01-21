import type { CityBackupInfo, CityID, RegionID } from "@common/regions"
import { VariantState } from "@common/types"
import { ActionButton } from "@components/ActionButton"
import { Header } from "@components/Header"
import { ListItem } from "@components/ListItem"
import { Tags } from "@components/Tags/Tags"
import { TagType, createTag } from "@components/Tags/utils"
import { useCityInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"
import { memo } from "react"
import { useTranslation } from "react-i18next"
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
  const actions = useStoreActions()
  const city = useCityInfo(cityId, regionId)

  const isCurrent = backup.version === city.version

  const [modalProps, openModal] = useUpdateSaveActionModal({
    backup,
    cityId,
    regionId,
  })

  const { t } = useTranslation("CityView")

  return (
    <ListItem
      actions={
        <>
          <UpdateSaveActionModal {...modalProps} />
          <ActionButton
            actions={[
              {
                action: () => actions.restoreBackup(regionId, cityId, backup.file),
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
                action: () => actions.removeBackup(regionId, cityId, backup.file),
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
      subtitle={backup.file}
      tags={isCurrent && <Tags tags={[createTag(TagType.STATE, VariantState.CURRENT)]} />}
      title={backup.description ?? dateFormat.format(backup.time)}
    />
  )
})
