import { memo, useCallback, useState } from "react"

import Card from "@mui/material/Card"
import CardActions from "@mui/material/CardActions"
import CardContent from "@mui/material/CardContent"
import Typography from "@mui/material/Typography"

import { PackageInfo } from "@common/types"
import { history } from "@renderer/stores/navigation"

import { PackageActions } from "./PackageActions"
import { PackageTags } from "./PackageTags"
import { VirtualListItemProps } from "./VirtualList"

export const PackageListItem = memo(function PackageListItem({
  item: packageInfo,
}: VirtualListItemProps<PackageInfo>): JSX.Element | null {
  const [focus, setFocus] = useState(false)
  const [hover, setHover] = useState(false)
  const [hoverWithin, setHoverWithin] = useState(false)

  const active = focus || (hover && !hoverWithin)

  const openPackageView = useCallback(() => {
    history.push({ page: "PackageView", data: { packageId: packageInfo.id } })
  }, [packageInfo.id])

  if (!packageInfo) {
    return null
  }

  return (
    <Card
      elevation={active ? 8 : 1}
      onBlur={() => setFocus(false)}
      onClick={() => {
        if (active) {
          openPackageView()
        }
      }}
      onFocus={event => {
        setFocus(event.target === event.currentTarget)
      }}
      onKeyDown={event => {
        if (event.key === "Enter" && focus) {
          openPackageView()
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setHoverWithin(false)
      }}
      sx={{ cursor: active ? "pointer" : undefined, display: "flex", height: "100%" }}
      tabIndex={0}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6">
          {packageInfo.name} (v{packageInfo.installed ?? packageInfo.version})
        </Typography>
        <Typography variant="body2">{packageInfo.id}</Typography>
        <PackageTags onHover={setHoverWithin} packageInfo={packageInfo} />
      </CardContent>
      <CardActions sx={{ padding: 2 }}>
        <PackageActions
          onHover={setHoverWithin}
          onMenuOpen={() => setHover(false)}
          packageInfo={packageInfo}
        />
      </CardActions>
    </Card>
  )
})
