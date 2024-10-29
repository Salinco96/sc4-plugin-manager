import { useEffect, useState } from "react"

import { Alert, AlertTitle, Button } from "@mui/material"
import { useTranslation } from "react-i18next"

import { PackageID } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

export function PackageViewLogs({ packageId }: { packageId: PackageID }): JSX.Element | null {
  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const [logs, setLogs] = useState<{ size: number; text: string } | null>()

  const { t } = useTranslation("PackageViewLogs")

  useEffect(() => {
    actions.getPackageLogs(packageId, variantId).then(setLogs).catch(console.error)
  }, [actions, packageId, variantId])

  if (logs === undefined) {
    return <Loader />
  }

  if (logs === null) {
    return (
      <FlexBox height="100%" direction="column">
        <Alert icon={false} severity="warning">
          <AlertTitle>{t("noLogs.title")}</AlertTitle>
          {t("noLogs.description")}
        </Alert>
      </FlexBox>
    )
  }

  return (
    <FlexBox height="100%" direction="column">
      <Alert
        action={
          <Button
            color="inherit"
            onClick={async () => {
              await actions.clearPackageLogs(packageId, variantId)
              setLogs(null)
            }}
            size="small"
            title={t("actions.clear.description")}
          >
            {t("actions.clear.label")}
          </Button>
        }
        icon={false}
        severity="info"
      >
        <AlertTitle sx={{ display: "inline" }}>{variantInfo.logs}</AlertTitle>
        {t("banner.description", { size: logs.size })}
      </Alert>
      <pre style={{ flex: 1 }}>{logs.text}</pre>
    </FlexBox>
  )
}
