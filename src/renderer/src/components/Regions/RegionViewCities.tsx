import { LocationCity as EstablishedIcon } from "@mui/icons-material"
import { Alert, Switch } from "@mui/material"
import { sortBy, values } from "@salinco/nice-utils"

import type { RegionID } from "@common/regions"
import { CityListItem } from "@components/Cities/CityListItem"
import { FlexCol } from "@components/FlexBox"
import { List } from "@components/List"
import { Page, useNavigation } from "@utils/navigation"
import { useRegionInfo, useView } from "@utils/packages"
import { useTranslation } from "react-i18next"

export default function RegionViewCities({ regionId }: { regionId: RegionID }): JSX.Element {
  const region = useRegionInfo(regionId)

  const [view, setView] = useView(Page.RegionView)
  const showEstablishedOnly = !!view.cities?.showEstablishedOnly

  const { fromCityId } = useNavigation()

  const { t } = useTranslation("RegionView")

  const cityIds = sortBy(values(region.cities), city => city.name)
    .filter(city => city.established || !showEstablishedOnly)
    .map(city => city.id)

  return (
    <FlexCol fullHeight>
      <Alert
        action={
          <Switch
            checked={showEstablishedOnly}
            onChange={event => setView({ cities: { showEstablishedOnly: event.target.checked } })}
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
