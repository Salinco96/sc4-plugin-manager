import type { ToolID } from "@common/tools"
import { getWarningMessage } from "@common/warnings"
import { Banner } from "@components/Banner"
import { store } from "@stores/main"

export function ToolBanners({
  toolId,
}: {
  toolId: ToolID
}): JSX.Element {
  const toolInfo = store.useToolInfo(toolId)

  return (
    <>
      {toolInfo.warnings?.map((warning, index) => (
        <Banner key={index} title={warning.title}>
          {getWarningMessage(warning)}
        </Banner>
      ))}
    </>
  )
}
