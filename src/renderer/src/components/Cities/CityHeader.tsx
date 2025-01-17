import { type CityID, type RegionID, getCityFileName } from "@common/regions"
import { ActionButton } from "@components/ActionButton"
import { Header, type HeaderProps } from "@components/Header"
import { Page } from "@utils/navigation"
import { useCityInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"
import { useTranslation } from "react-i18next"

export function CityHeader({
  cityId,
  isListItem,
  regionId,
  setActive,
}: HeaderProps<{ cityId: CityID; regionId: RegionID }>): JSX.Element {
  const actions = useStoreActions()
  const city = useCityInfo(cityId, regionId)

  const { t } = useTranslation("CityView")

  return (
    <Header
      actions={
        <ActionButton
          actions={[
            {
              action: () => actions.createBackup(regionId, cityId),
              description: t("actions.createBackup.description"),
              disabled: city.backups.some(backup => backup.current),
              id: "createBackup",
              label: t("actions.createBackup.label"),
            },
          ]}
        />
      }
      isListItem={isListItem}
      location={{ data: { cityId, regionId }, page: Page.CityView }}
      setActive={setActive}
      subtitle={getCityFileName(cityId)}
      title={cityId}
    />
  )
}
