import { LocationCity as EstablishedIcon } from "@mui/icons-material"
import { Alert, Switch } from "@mui/material"
import { sortBy, values } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { RegionID } from "@common/regions"
import { CityListItem } from "@components/Cities/CityListItem"
import { FlexCol } from "@components/FlexBox"
import { List } from "@components/List"
import { store } from "@stores/main"
import { usePageState } from "@stores/ui"
import { Page, useNavigation } from "@utils/navigation"

export default function RegionViewCities({ regionId }: { regionId: RegionID }): JSX.Element {
  const region = store.useRegionInfo(regionId)

  const [state, setState] = usePageState(Page.RegionView)

  const { fromCityId } = useNavigation()

  const { t } = useTranslation("RegionView")

  const cityIds = sortBy(values(region.cities), city => city.name)
    .filter(city => city.established || !state.cities.showEstablishedOnly)
    .map(city => city.id)

  return (
    <FlexCol fullHeight>
      <Alert
        action={
          <Switch
            checked={state.cities.showEstablishedOnly}
            onChange={event => setState({ cities: { showEstablishedOnly: event.target.checked } })}
          />
        }
        icon={<EstablishedIcon fontSize="inherit" />}
        severity="info"
        sx={{ alignItems: "center", display: "flex" }}
      >
        {t("showEstablishedOnly")}
      </Alert>

      <List
        emptyMessage={t("noEstablishedCities")}
        items={cityIds}
        initialItem={fromCityId}
        renderItem={cityId => <CityListItem cityId={cityId} regionId={regionId} />}
      />
    </FlexCol>
  )
}
