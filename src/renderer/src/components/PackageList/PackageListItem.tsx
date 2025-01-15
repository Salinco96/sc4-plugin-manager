import { Link, Typography } from "@mui/material"
import { memo, useMemo } from "react"

import type { PackageID } from "@common/packages"
import { ListItem } from "@components/ListItem"
import { PackageBanners } from "@components/PackageBanners/PackageBanners"
import { PackageHeader } from "@components/PackageHeader"
import { Page, useHistory, useLocation } from "@utils/navigation"
import { useCurrentVariant } from "@utils/packages"
import { getMatchingContents, isHexSearch } from "@utils/search"
import { usePackageFilters, useStoreActions } from "@utils/store"

export const PackageListItem = memo(function PackageListItem({
  isDisabled,
  packageId,
}: {
  isDisabled?: boolean
  packageId: PackageID
}): JSX.Element {
  const { page } = useLocation()
  const { search } = usePackageFilters()

  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)
  const history = useHistory()

  const matchingContents = useMemo(() => {
    if (isHexSearch(search) && page === Page.Packages) {
      return getMatchingContents(variantInfo, search.trim().toLowerCase())
    }
  }, [page, search, variantInfo])

  return (
    <ListItem
      banners={<PackageBanners packageId={packageId} />}
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
                      actions.setActiveTab(Page.PackageView, tab, element)
                      history.push({ page: Page.PackageView, data: { id: packageId } })
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
