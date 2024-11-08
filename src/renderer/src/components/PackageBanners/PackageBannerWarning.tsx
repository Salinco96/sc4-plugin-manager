import { PackageWarning } from "@common/types"
import { getWarningMessage } from "@common/warnings"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerWarning({ warning }: { warning: PackageWarning }): JSX.Element {
  return <PackageBanner header={warning.title}>{getWarningMessage(warning)}</PackageBanner>
}
