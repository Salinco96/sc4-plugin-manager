import { type CityID, type RegionID, getCityFileName, hasBackup } from "@common/regions"
import { ActionButton } from "@components/ActionButton"
import { Header, type HeaderProps } from "@components/Header"
import { Page } from "@utils/navigation"
import { useCityInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"
import { useTranslation } from "react-i18next"
import { UpdateSaveActionModal, useUpdateSaveActionModal } from "./UpdateSaveActionModal"

export function CityHeader({
  cityId,
  isListItem,
  regionId,
  setActive,
}: HeaderProps<{ cityId: CityID; regionId: RegionID }>): JSX.Element {
  const actions = useStoreActions()
  const city = useCityInfo(cityId, regionId)

  const { t } = useTranslation("CityView")

  const [modalProps, openModal] = useUpdateSaveActionModal({
    cityId,
    regionId,
  })

  return (
    <Header
      actions={
        <>
          <UpdateSaveActionModal {...modalProps} />
          <ActionButton
            actions={[
              {
                action: () => actions.createBackup(regionId, cityId),
                description: t("actions.createBackup.description"),
                disabled: hasBackup(city),
                id: "createBackup",
                label: t("actions.createBackup.label"),
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
                id: "historical",
                label: t("actions.historical.label"),
              },
            ]}
          />
        </>
      }
      isListItem={isListItem}
      location={{ data: { cityId, regionId }, page: Page.CityView }}
      setActive={setActive}
      subtitle={getCityFileName(cityId)}
      title={cityId}
    />
  )
}
