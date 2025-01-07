import type { ToolID } from "@common/tools"
import { Page } from "@utils/navigation"
import { useToolInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { type Action, ActionButton } from "./ActionButton"
import { Header } from "./Header"
import { ToolTags } from "./Tags/ToolTags"

export function ToolHeader({
  isListItem,
  setActive,
  toolId,
}: {
  isListItem?: boolean
  setActive?: (active: boolean) => void
  toolId: ToolID
}): JSX.Element {
  const actions = useStoreActions()
  const toolInfo = useToolInfo(toolId)

  const { t } = useTranslation("ToolActions")

  const toolActions = useMemo(() => {
    const toolActions: Action[] = []

    if (toolInfo.installed) {
      toolActions.push({
        description: t("run.description"),
        id: "run",
        label: t("run.label"),
        onClick: () => actions.runTool(toolInfo.id),
      })

      // TODO: ATM cannot remove tool copied to SC4 installation folder
      if (!toolInfo.install) {
        toolActions.push({
          description: t("remove.description"),
          id: "remove",
          label: t("remove.label"),
          onClick: () => actions.removeTool(toolInfo.id),
        })
      }
    } else {
      toolActions.push({
        description: t("add.description"),
        id: "add",
        label: t("add.label"),
        onClick: () => actions.installTool(toolInfo.id),
      })
    }

    return toolActions
  }, [actions, t, toolInfo])

  return (
    <Header
      actions={
        <ActionButton
          actions={toolActions}
          isLoading={!!toolInfo.action}
          loadingLabel={toolInfo.action && t(`actions.${toolInfo.action}`)}
        />
      }
      description={toolInfo.description}
      images={toolInfo.images}
      isListItem={isListItem}
      location={{ data: { toolId }, page: Page.ToolView }}
      setActive={setActive}
      subtitle={toolId}
      summary={toolInfo.summary}
      tags={<ToolTags toolId={toolId} />}
      thumbnail={toolInfo.thumbnail}
      title={`${toolInfo.name} (${toolInfo.version})`}
    />
  )
}
