import { memo, useCallback, useState } from "react"

import {
  BedtimeOutlined as DeprecatedIcon,
  DoDisturb as IncompatibleIcon,
  ScienceOutlined as ExperimentalIcon,
  Update as UpdateIcon,
} from "@mui/icons-material"
import { Card, CardActions, CardContent, Link } from "@mui/material"

import { Page } from "@renderer/pages"
import { useHistory } from "@renderer/utils/navigation"
import { usePackageInfo } from "@renderer/utils/store"

import { PackageActions } from "./PackageActions"
import { PackageListItemBanner } from "./PackageListItemBanner"
import { PackageTags } from "./PackageTags"
import { Text } from "./Text"
import { VirtualListItemProps } from "./VirtualList"

export const PackageListItem = memo(function PackageListItem({
  item: packageId,
}: VirtualListItemProps<string>): JSX.Element | null {
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

  const variantInfo = packageInfo.variants[packageInfo.status.variantId]

  if (!variantInfo) {
    return null
  }

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
            {packageInfo.id}#{packageInfo.status.variantId}
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
        {variantInfo.deprecated && (
          <PackageListItemBanner icon={<DeprecatedIcon />} color="experimental">
            <b>Legacy:</b> This package is no longer maintained or recommended.
          </PackageListItemBanner>
        )}
        {variantInfo.experimental && (
          <PackageListItemBanner icon={<ExperimentalIcon />} color="experimental">
            <b>Experimental:</b> This package should be used <b>for testing purposes only</b>.
          </PackageListItemBanner>
        )}
        {variantInfo.incompatible?.map(reason => (
          <PackageListItemBanner key={reason} icon={<IncompatibleIcon />} color="incompatible">
            <b>Incompatible:</b> {reason}
          </PackageListItemBanner>
        ))}
        {variantInfo.issues?.map(reason => (
          <PackageListItemBanner key={reason}>
            <b>Problem:</b> {reason}
          </PackageListItemBanner>
        ))}
        {variantInfo.update && (
          <PackageListItemBanner icon={<UpdateIcon />}>
            <b>Outdated:</b> A new version of this package is available.
          </PackageListItemBanner>
        )}
        {variantInfo.conflictGroups?.map(groupId => (
          <PackageListItemBanner key={groupId}>{variantInfo.description}</PackageListItemBanner>
        ))}
      </CardContent>
      <CardActions sx={{ padding: 2 }}>
        <PackageActions packageInfo={packageInfo} />
      </CardActions>
    </Card>
  )
})
