import type { RegionID } from "@common/regions"
import { FlexCol } from "@components/FlexBox"
import { List } from "@components/List"
import { useNavigation } from "@utils/navigation"

import { RegionListItem } from "./RegionListItem"

export function RegionList({ regionIds }: { regionIds: RegionID[] }): JSX.Element {
  const { fromRegionId } = useNavigation()

  return (
    <FlexCol fullHeight>
      <List
        items={regionIds}
        initialItem={fromRegionId}
        renderItem={regionId => <RegionListItem regionId={regionId} />}
      />
    </FlexCol>
  )
}
