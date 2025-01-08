import type { ToolID } from "@common/tools"
import { Page } from "@utils/navigation"
import { useToolInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { type Action, ActionButton } from "./ActionButton"
import { Header } from "./Header"
import { ToolTags } from "./Tags/ToolTags"
import type { ToolBeltAction } from "./ToolBelt"

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
        action: () => actions.runTool(toolInfo.id),
        description: t("run.description"),
        id: "run",
        label: t("run.label"),
      })

      // TODO: ATM cannot remove tool copied to SC4 installation folder
      if (!toolInfo.install) {
        toolActions.push({
          action: () => actions.removeTool(toolInfo.id),
          description: t("remove.description"),
          id: "remove",
          label: t("remove.label"),
        })
      }
    } else {
      toolActions.push({
        action: () => actions.installTool(toolInfo.id),
        description: t("add.description"),
        id: "add",
        label: t("add.label"),
      })
    }

    return toolActions
  }, [actions, t, toolInfo])

  const toolbeltActions = useMemo(() => {
    const toolbeltActions: ToolBeltAction[] = []

    if (toolInfo?.url) {
      toolbeltActions.push({
        action: () => actions.openToolURL(toolId, "url"),
        description: toolInfo.url.includes("simtropolis") ? "openSimtropolis" : "openUrl",
        icon: "website",
        id: "url",
      })
    }

    if (toolInfo?.repository) {
      toolbeltActions.push({
        action: () => actions.openToolURL(toolId, "repository"),
        description: toolInfo.repository.includes("github") ? "openGitHub" : "openRepository",
        icon: toolInfo.repository.includes("github") ? "github" : "repository",
        id: "repository",
      })
    }

    if (toolInfo?.support) {
      toolbeltActions.push({
        action: () => actions.openToolURL(toolId, "support"),
        description: "openSupport",
        icon: "support",
        id: "support",
      })
    }

    if (toolInfo?.installed) {
      const exeParentPath = toolInfo.exe.split("/").slice(0, -1).join("/")

      toolbeltActions.push({
        action: () => actions.openToolFile(toolId, exeParentPath),
        description: "openFiles",
        icon: "files",
        id: "files",
      })
    }

    return toolbeltActions
  }, [actions, toolId, toolInfo])

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
      tools={toolbeltActions}
    />
  )
}
