import { memo, useMemo } from "react"

import type { PackageID } from "@common/packages"
import { ListItem } from "@components/ListItem"
import { PackageBanners } from "@components/PackageBanners/PackageBanners"
import { PackageHeader } from "@components/PackageHeader"
import { store } from "@stores/main"
import { Page, useLocation } from "@utils/navigation"
import { getMatchingContents, isHexSearch } from "@utils/search"
import { MatchResults } from "./MatchResults"

export const PackageListItem = memo(function PackageListItem({
  isDisabled,
  packageId,
}: {
  isDisabled?: boolean
  packageId: PackageID
}): JSX.Element {
  const { page } = useLocation()

  const { search } = store.usePackageFilters()
  const variantInfo = store.useCurrentVariant(packageId)

  const matchingContents = useMemo(() => {
    if (isHexSearch(search) && page === Page.Packages) {
      return getMatchingContents(variantInfo, search.trim().toLowerCase())
    }
  }, [page, search, variantInfo])

  return (
    <ListItem
      banners={PackageBanners}
      header={PackageHeader}
      isDisabled={isDisabled}
      packageId={packageId}
    >
      {!!matchingContents?.length && (
        <MatchResults packageId={packageId} results={matchingContents} />
      )}
    </ListItem>
  )
})
