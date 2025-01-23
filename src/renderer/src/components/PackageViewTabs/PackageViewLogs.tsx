import { Alert, AlertTitle, Button } from "@mui/material"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import { FlexCol } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { clearPackageLogs, getPackageLogs } from "@stores/actions"
import { store } from "@stores/main"

export default function PackageViewLogs({
  packageId,
}: { packageId: PackageID }): JSX.Element | null {
  const variantInfo = store.useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const [logs, setLogs] = useState<{ size: number; text: string } | null>()

  const { t } = useTranslation("PackageViewLogs")

  useEffect(() => {
    getPackageLogs(packageId, variantId).then(setLogs).catch(console.error)
  }, [packageId, variantId])

  if (logs === undefined) {
    return <Loader />
  }

  if (logs === null) {
    return (
      <FlexCol fullHeight>
        <Alert icon={false} severity="warning">
          <AlertTitle>{t("noLogs.title")}</AlertTitle>
          {t("noLogs.description")}
        </Alert>
      </FlexCol>
    )
  }

  return (
    <FlexCol fullHeight>
      <Alert
        action={
          <Button
            color="inherit"
            onClick={async () => {
              await clearPackageLogs(packageId, variantId)
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
    </FlexCol>
  )
}
