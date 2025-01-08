import { Link, Typography } from "@mui/material"
import { memo } from "react"

import type { PackageID } from "@common/packages"
import { ListItem } from "@components/ListItem"
import { PackageHeader } from "@components/PackageHeader"
import { Page, useHistory } from "@utils/navigation"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"
import { useMatchingContents } from "./useMatchingContents"

export const PackageListItem = memo(function PackageListItem({
  isDisabled,
  packageId,
}: {
  isDisabled?: boolean
  packageId: PackageID
}): JSX.Element {
  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)
  const history = useHistory()

  const matchingContents = useMatchingContents(variantInfo)

  return (
    <ListItem header={PackageHeader} isDisabled={isDisabled} packageId={packageId}>
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
                      history.push({ page: Page.PackageView, data: { packageId } })
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
