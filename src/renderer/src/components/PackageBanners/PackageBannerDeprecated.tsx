import { BedtimeOutlined as DeprecatedIcon } from "@mui/icons-material"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerDeprecated(): JSX.Element {
  return (
    // TODO: Suggest a replacement if possible
    <PackageBanner color="experimental" header="Legacy" icon={<DeprecatedIcon />}>
      This package is no longer maintained or recommended.
    </PackageBanner>
  )
}
