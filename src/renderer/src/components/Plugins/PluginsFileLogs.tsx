import { Alert, AlertTitle, Button } from "@mui/material"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type { PluginsFileInfo } from "@common/plugins"
import { FlexCol } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { removePlugin } from "@stores/actions"

export function PluginsFileLogs({ file }: { file: PluginsFileInfo }) {
  const [logs, setLogs] = useState<{ size: number; text: string } | null>()

  const { t } = useTranslation("PackageViewLogs") // TODO

  const logsPath = file.logs

  useEffect(() => {
    setLogs(logsPath ? { size: logsPath.length, text: logsPath } : null)
    //  TODO: getPackageLogs(packageId, variantId).then(setLogs).catch(console.error)
  }, [logsPath])

  if (logs === undefined) {
    return <Loader />
  }

  if (logs === null || !logsPath) {
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
              await removePlugin(logsPath)
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
        <AlertTitle sx={{ display: "inline" }}>{file.logs}</AlertTitle>
        {t("banner.description", { size: logs.size })}
      </Alert>
      <pre style={{ flex: 1 }}>{logs.text}</pre>
    </FlexCol>
  )
}
