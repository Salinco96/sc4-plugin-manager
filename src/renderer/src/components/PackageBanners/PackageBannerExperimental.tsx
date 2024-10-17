import { ScienceOutlined as ExperimentalIcon } from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerExperimental(): JSX.Element {
  const { t } = useTranslation("PackageBanner")

  return (
    // TODO: Suggest a replacement if possible
    <PackageBanner
      color="experimental"
      header={t("experimental.title")}
      icon={<ExperimentalIcon />}
    >
      {t("experimental.message")}
    </PackageBanner>
  )
}
