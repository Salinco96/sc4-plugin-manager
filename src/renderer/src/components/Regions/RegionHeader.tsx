import { sortBy, values } from "@salinco/nice-utils"
import { useMemo } from "react"

import type { ProfileID } from "@common/profiles"
import { type RegionID, getRegionLinkedProfileId } from "@common/regions"
import { ActionButton, type Variant } from "@components/ActionButton"
import { Header, type HeaderProps } from "@components/Header"
import { ToolBelt, type ToolBeltAction } from "@components/ToolBelt"
import { linkRegion, openRegionDirectory } from "@stores/actions"
import { store } from "@stores/main"
import { Page } from "@utils/navigation"

export function RegionHeader({
  isListItem,
  regionId,
  setActive,
}: HeaderProps<{ regionId: RegionID }>): JSX.Element {
  const profiles = store.useProfiles()
  const region = store.useRegionInfo(regionId)
  const settings = store.useSettings()

  const regionProfileId = getRegionLinkedProfileId(regionId, settings, profiles)

  const cities = values(region.cities)
  const establishedCities = cities.filter(city => city.established)

  const toolbeltActions: ToolBeltAction[] = [
    {
      action: () => openRegionDirectory(regionId),
      description: "openRegionDirectory",
      icon: "files",
      id: "openRegionDirectory",
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
          setVariant={profileId => linkRegion(regionId, profileId)}
          variant={regionProfileId}
          variants={profileOptions}
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
