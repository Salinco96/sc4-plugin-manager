import { sortBy, values } from "@salinco/nice-utils"
import { useMemo } from "react"

import type { ProfileID } from "@common/profiles"
import { type RegionID, getRegionLinkedProfileId } from "@common/regions"
import { ActionButton, type Variant } from "@components/ActionButton"
import { Header, type HeaderProps } from "@components/Header"
import { ToolBelt, type ToolBeltAction } from "@components/ToolBelt"
import { Page } from "@utils/navigation"
import { useRegionInfo } from "@utils/packages"
import { useSettings, useStore, useStoreActions } from "@utils/store"

export function RegionHeader({
  isListItem,
  regionId,
  setActive,
}: HeaderProps<{ regionId: RegionID }>): JSX.Element {
  const actions = useStoreActions()
  const profiles = useStore(store => store.profiles)
  const region = useRegionInfo(regionId)
  const settings = useSettings()

  const regionProfileId = getRegionLinkedProfileId(regionId, settings, profiles)

  const cities = values(region.cities)
  const establishedCities = cities.filter(city => city.established)

  const toolbeltActions: ToolBeltAction[] = [
    {
      action: () => actions.openRegionFolder(regionId),
      description: "openRegionFolder",
      icon: "files",
      id: "openRegionFolder",
    },
  ]

  const profileOptions = useMemo(() => {
    if (profiles) {
      return sortBy(values(profiles), profile => profile.name).map<Variant<ProfileID>>(profile => ({
        id: profile.id,
        label: profile.name,
      }))
    }
  }, [profiles])

  return (
    <Header
      actions={
        <ActionButton
          actions={[]}
          variant={regionProfileId}
          variants={profileOptions}
          setVariant={profileId =>
            actions.updateSettings({
              regions: {
                ...settings?.regions,
                [regionId]: {
                  ...settings?.regions?.[regionId],
                  profile: profileId,
                },
              },
            })
          }
        />
      }
      description={`${establishedCities.length} / ${cities.length} established cities`}
      isListItem={isListItem}
      location={{ data: { regionId }, page: Page.RegionView }}
      setActive={setActive}
      subtitle={regionId}
      title={region.name}
      tools={<ToolBelt actions={toolbeltActions} />}
    />
  )
}
