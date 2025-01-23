import { sortBy } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { CityID, RegionID } from "@common/regions"
import { FlexCol } from "@components/FlexBox"
import { List } from "@components/List"
import { store } from "@stores/main"

import { CityBackupListItem } from "./CityBackupListItem"

export default function CityViewBackups({
  cityId,
  regionId,
}: { cityId: CityID; regionId: RegionID }): JSX.Element {
  const city = store.useCityInfo(regionId, cityId)

  const { t } = useTranslation("CityView")

  return (
    <FlexCol fullHeight>
      <List
        emptyMessage={t("noBackups")}
        items={sortBy(city.backups, backup => backup.time.getTime())}
        renderItem={backup => (
          <CityBackupListItem backup={backup} cityId={cityId} regionId={regionId} />
        )}
      />
    </FlexCol>
  )
}
