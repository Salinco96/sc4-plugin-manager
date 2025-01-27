import { Link, Typography } from "@mui/material"

import type { PackageID } from "@common/packages"
import { setActiveTab } from "@stores/ui"
import { Page, useNavigation } from "@utils/navigation"
import type { MatchResult } from "@utils/search"

export function MatchResults({
  packageId,
  results,
}: {
  packageId?: PackageID
  results: MatchResult[]
}): JSX.Element | null {
  const { openPackageView } = useNavigation()

  return (
    <>
      <Typography variant="body2">
        <b>Match results:</b>
      </Typography>
      <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
        {results.map(({ element, name, tab, type }) => {
          const title = `${type}: ${name}`

          return (
            <Typography component="li" key={title} variant="body2">
              {packageId && tab ? (
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
                  {title}
                </Link>
              ) : (
                title
              )}
            </Typography>
          )
        })}
      </ul>
    </>
  )
}
