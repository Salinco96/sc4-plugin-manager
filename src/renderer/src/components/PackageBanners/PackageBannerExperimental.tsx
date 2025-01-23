import { ScienceOutlined as ExperimentalIcon } from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import { Banner } from "../Banner"

export function PackageBannerExperimental(): JSX.Element {
  const { t } = useTranslation("PackageBanner")

  return (
    // TODO: Suggest a replacement if possible
    <Banner color="experimental" icon={<ExperimentalIcon />} title={t("experimental.title")}>
      {t("experimental.message")}
    </Banner>
  )
}
