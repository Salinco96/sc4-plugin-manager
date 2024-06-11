import { ScienceOutlined as ExperimentalIcon } from "@mui/icons-material"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerExperimental(): JSX.Element {
  return (
    // TODO: Suggest a replacement if possible
    <PackageBanner color="experimental" header="Experimental" icon={<ExperimentalIcon />}>
      This package should be used <b>for testing purposes only</b>.
    </PackageBanner>
  )
}
