import { memo } from "react"
import { useTranslation } from "react-i18next"

import type { CityBackupInfo, CityID, RegionID } from "@common/regions"
import { VariantState } from "@common/types"
import { ActionButton } from "@components/ActionButton"
import { Header } from "@components/Header"
import { ListItem } from "@components/ListItem"
import { Tags } from "@components/Tags/Tags"
import { TagType, createTag } from "@components/Tags/utils"
import { useStoreActions } from "@utils/store"

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

  const { t } = useTranslation("CityView")

  return (
    <ListItem
      actions={
        <ActionButton
          actions={[
            {
              action: () => actions.restoreBackup(regionId, cityId, backup.file),
              description: t("actions.restoreBackup.description"),
              disabled: backup.current,
              id: "restoreBackup",
              label: t("actions.restoreBackup.label"),
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
      }
      header={Header}
      subtitle={backup.file}
      tags={backup.current && <Tags tags={[createTag(TagType.STATE, VariantState.CURRENT)]} />}
      title={backup.description ?? dateFormat.format(backup.time)}
    />
  )
})
