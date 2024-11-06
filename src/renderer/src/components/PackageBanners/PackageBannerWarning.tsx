import { PackageWarning } from "@common/types"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerWarning({ warning }: { warning: PackageWarning }): JSX.Element {
  return <PackageBanner>{warning.message}</PackageBanner>
}
