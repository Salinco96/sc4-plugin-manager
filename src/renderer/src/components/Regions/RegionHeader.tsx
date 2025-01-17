import { values } from "@salinco/nice-utils"

import type { RegionID } from "@common/regions"
import { Header, type HeaderProps } from "@components/Header"
import { ToolBelt, type ToolBeltAction } from "@components/ToolBelt"
import { Page } from "@utils/navigation"
import { useRegionInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"

export function RegionHeader({
  isListItem,
  regionId,
  setActive,
}: HeaderProps<{ regionId: RegionID }>): JSX.Element {
  const actions = useStoreActions()
  const region = useRegionInfo(regionId)

  console.log(actions)

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

  return (
    <Header
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
