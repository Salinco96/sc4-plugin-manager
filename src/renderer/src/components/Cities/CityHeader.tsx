import { Map as RegionIcon } from "@mui/icons-material"
import { sortBy, values } from "@salinco/nice-utils"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { ProfileID } from "@common/profiles"
import {
  type CityID,
  type RegionID,
  getCityFileName,
  getCityLinkedProfileId,
  getRegionLinkedProfileId,
  hasBackup,
} from "@common/regions"
import { ActionButton, type Variant } from "@components/ActionButton"
import { Header, type HeaderProps } from "@components/Header"
import { Page } from "@utils/navigation"
import { useCityInfo } from "@utils/packages"
import { useSettings, useStore, useStoreActions } from "@utils/store"

import { UpdateSaveActionModal, useUpdateSaveActionModal } from "./UpdateSaveActionModal"

export function CityHeader({
  cityId,
  isListItem,
  regionId,
  setActive,
}: HeaderProps<{ cityId: CityID; regionId: RegionID }>): JSX.Element {
  const actions = useStoreActions()
  const city = useCityInfo(cityId, regionId)
  const profiles = useStore(store => store.profiles)
  const settings = useSettings()

  const { t } = useTranslation("CityView")

  const [modalProps, openModal] = useUpdateSaveActionModal({
    cityId,
    regionId,
  })

  const regionProfileId = getRegionLinkedProfileId(regionId, settings, profiles)
  const cityProfileId = getCityLinkedProfileId(regionId, cityId, settings)

  const profileOptions = useMemo(() => {
    if (profiles) {
      const options = sortBy(values(profiles), profile => profile.name).map<
        Variant<ProfileID | "*">
      >(profile => ({
        id: profile.id,
        label: profile.name,
      }))

      if (regionProfileId) {
        options.unshift({
          description: "Defaults to region",
          icon: RegionIcon,
          id: "*",
          label: <i>{profiles[regionProfileId]?.name}</i>,
        })
      }

      return options
    }
  }, [profiles, regionProfileId])

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
            setVariant={profileId =>
              actions.updateSettings({
                regions: {
                  ...settings?.regions,
                  [regionId]: {
                    ...settings?.regions?.[regionId],
                    cities: {
                      ...settings?.regions?.[regionId]?.cities,
                      [cityId]: profileId === "*" ? undefined : { profile: profileId },
                    },
                  },
                },
              })
            }
            variant={cityProfileId ?? "*"}
            variants={profileOptions}
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
