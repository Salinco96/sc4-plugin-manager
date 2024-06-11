import {
  BedtimeOutlined as DeprecatedIcon,
  DoDisturb as IncompatibleIcon,
  NotListedLocation as MissingIcon,
  ScienceOutlined as ExperimentalIcon,
  Update as UpdateIcon,
} from "@mui/icons-material"
import { Button } from "@mui/material"

import { PackageInfo } from "@common/types"
import { getCurrentVariant, getPackageStatus } from "@renderer/pages/PackageView"
import { useCurrentProfile, useStoreActions } from "@renderer/utils/store"

import { PackageListItemBanner } from "./PackageList/PackageListItemBanner"

export function PackageBanners({ packageInfo }: { packageInfo: PackageInfo }): JSX.Element {
  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()
  const packageStatus = getPackageStatus(packageInfo, currentProfile)
  const variantInfo = getCurrentVariant(packageInfo, currentProfile)

  return (
    <>
      {variantInfo.deprecated && (
        // TODO: Suggest a replacement if possible
        <PackageListItemBanner icon={<DeprecatedIcon />} color="experimental">
          <b>Legacy:</b> This package is no longer maintained or recommended.
        </PackageListItemBanner>
      )}
      {variantInfo.experimental && (
        // TODO: Suggest a replacement if possible
        <PackageListItemBanner icon={<ExperimentalIcon />} color="experimental">
          <b>Experimental:</b> This package should be used <b>for testing purposes only</b>.
        </PackageListItemBanner>
      )}
      {packageStatus.enabled && !variantInfo.installed && (
        <PackageListItemBanner
          action={
            <Button
              aria-label="Install selected variant"
              color="inherit"
              onClick={() => actions.addPackage(packageInfo.id, variantInfo.id)}
              title="Install selected variant"
              variant="text"
            >
              Install
            </Button>
          }
          icon={<MissingIcon />}
        >
          <b>Missing:</b>{" "}
          {Object.values(packageInfo.variants).some(variant => variant.installed)
            ? "The selected variant is not installed."
            : "This package is not installed."}
        </PackageListItemBanner>
      )}
      {packageStatus.issues[variantInfo.id]?.map(reason =>
        packageStatus.enabled ? (
          <PackageListItemBanner key={reason}>
            <b>Conflict:</b> {reason}
          </PackageListItemBanner>
        ) : (
          <PackageListItemBanner
            action={
              <Button
                aria-label="Replace existing packages"
                color="inherit"
                onClick={() => actions.addPackage(packageInfo.id, variantInfo.id)}
                title="Replace existing packages"
                variant="text"
              >
                Replace
              </Button>
            }
            key={reason}
            icon={<IncompatibleIcon />}
            color="incompatible"
          >
            <b>Incompatible:</b> {reason}
          </PackageListItemBanner>
        ),
      )}
      {variantInfo.update && (
        <PackageListItemBanner icon={<UpdateIcon />}>
          <b>Outdated:</b> A new version of this package is available.
        </PackageListItemBanner>
      )}
    </>
  )
}
