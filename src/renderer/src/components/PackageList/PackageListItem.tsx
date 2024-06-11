import { memo, useCallback, useState } from "react"

import { Card, CardActions, CardContent, Link } from "@mui/material"

import { PackageActions } from "@renderer/components/PackageActions"
import { PackageBanners } from "@renderer/components/PackageBanners"
import { PackageTags } from "@renderer/components/PackageTags"
import { Text } from "@renderer/components/Text"
import { Page } from "@renderer/pages"
import { getCurrentVariant } from "@renderer/pages/PackageView"
import { useHistory } from "@renderer/utils/navigation"
import { useCurrentProfile, usePackageInfo } from "@renderer/utils/store"

import { VirtualListItemProps } from "./VirtualList"

export const PackageListItem = memo(function PackageListItem({
  item: packageId,
}: VirtualListItemProps<string>): JSX.Element | null {
  const currentProfile = useCurrentProfile()
  const packageInfo = usePackageInfo(packageId)
  const history = useHistory()

  const [focus, setFocus] = useState(false)
  const [hover, setHover] = useState(false)

  const active = focus || hover

  const openPackageView = useCallback(() => {
    history.push({ page: Page.PackageView, data: { packageId } })
  }, [history, packageId])

  if (!packageInfo) {
    return null
  }

  const variantInfo = getCurrentVariant(packageInfo, currentProfile)

  return (
    <Card elevation={active ? 8 : 1} sx={{ display: "flex", height: "100%" }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Link
          color="inherit"
          onBlur={() => setFocus(false)}
          onClick={() => openPackageView()}
          onFocus={event => setFocus(event.target === event.currentTarget)}
          onKeyDown={event => event.key === "Enter" && openPackageView()}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          sx={{
            cursor: "pointer",
            display: "block",
            textDecoration: active ? "underline" : "unset",
            width: "fit-content",
          }}
          tabIndex={0}
        >
          <Text maxLines={1} variant="h6">
            {packageInfo.name} (v{variantInfo.version})
          </Text>
          <Text maxLines={1} variant="body2">
            {packageInfo.id}#{variantInfo.id}
          </Text>
        </Link>
        <PackageTags packageInfo={packageInfo} />
        {variantInfo.description && (
          <Text
            maxLines={2}
            sx={{ height: 40, marginTop: 2 }}
            title={variantInfo.description}
            variant="body2"
          >
            {variantInfo.description}
          </Text>
        )}
        <PackageBanners packageInfo={packageInfo} />
      </CardContent>
      <CardActions sx={{ padding: 2 }}>
        <PackageActions packageInfo={packageInfo} />
      </CardActions>
    </Card>
  )
})
