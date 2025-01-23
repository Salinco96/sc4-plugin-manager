import { Link, Typography } from "@mui/material"
import { memo, useMemo } from "react"

import type { PackageID } from "@common/packages"
import { ListItem } from "@components/ListItem"
import { PackageBanners } from "@components/PackageBanners/PackageBanners"
import { PackageHeader } from "@components/PackageHeader"
import { store } from "@stores/main"
import { setActiveTab } from "@stores/ui"
import { Page, useLocation, useNavigation } from "@utils/navigation"
import { getMatchingContents, isHexSearch } from "@utils/search"

export const PackageListItem = memo(function PackageListItem({
  isDisabled,
  packageId,
}: {
  isDisabled?: boolean
  packageId: PackageID
}): JSX.Element {
  const { page } = useLocation()
  const { openPackageView } = useNavigation()

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
        <>
          <Typography variant="body2">
            <b>Match results:</b>
          </Typography>
          <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
            {matchingContents.map(({ element, name, tab, type }) => (
              <Typography component="li" key={type} variant="body2">
                {tab ? (
                  <Link
                    color="inherit"
                    onClick={() => {
                      setActiveTab(Page.PackageView, tab, element)
                      openPackageView(packageId)
                    }}
                    sx={{
                      cursor: "pointer",
                      textDecoration: "none",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    {type}: {name}
                  </Link>
                ) : (
                  `${type}: ${name}`
                )}
              </Typography>
            ))}
          </ul>
        </>
      )}
    </ListItem>
  )
})
