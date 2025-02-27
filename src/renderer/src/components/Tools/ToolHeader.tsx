import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { ToolID } from "@common/tools"
import { type Action, ActionButton } from "@components/ActionButton"
import { Header, type HeaderProps } from "@components/Header"
import { ToolBelt, type ToolBeltAction } from "@components/ToolBelt"
import { installTool, openToolDirectory, openToolUrl, removeTool, runTool } from "@stores/actions"
import { store } from "@stores/main"
import { Page } from "@utils/navigation"
import { ToolTags } from "./ToolTags"

export function ToolHeader({
  isListItem,
  setActive,
  toolId,
}: HeaderProps<{ toolId: ToolID }>): JSX.Element {
  const toolInfo = store.useToolInfo(toolId)

  const { t } = useTranslation("ToolActions")

  const toolActions = useMemo(() => {
    const toolActions: Action[] = []

    if (toolInfo.installed) {
      toolActions.push({
        action: () => runTool(toolInfo.id),
        description: t("run.description"),
        id: "run",
        label: t("run.label"),
      })

      toolActions.push({
        action: () => removeTool(toolInfo.id),
        description: t("remove.description"),
        id: "remove",
        label: t("remove.label"),
      })
    } else {
      toolActions.push({
        action: () => installTool(toolInfo.id),
        description: t("add.description"),
        id: "add",
        label: t("add.label"),
      })
    }

    return toolActions
  }, [t, toolInfo])

  const toolbeltActions = useMemo(() => {
    const toolbeltActions: ToolBeltAction[] = []

    if (toolInfo?.url) {
      toolbeltActions.push({
        action: () => openToolUrl(toolId, "url"),
        description: toolInfo.url.includes("simtropolis") ? "openSimtropolis" : "openUrl",
        icon: "website",
        id: "url",
      })
    }

    if (toolInfo?.repository) {
      toolbeltActions.push({
        action: () => openToolUrl(toolId, "repository"),
        description: toolInfo.repository.includes("github") ? "openGitHub" : "openRepository",
        icon: toolInfo.repository.includes("github") ? "github" : "repository",
        id: "repository",
      })
    }

    if (toolInfo?.support) {
      toolbeltActions.push({
        action: () => openToolUrl(toolId, "support"),
        description: "openSupport",
        icon: "support",
        id: "support",
      })
    }

    if (toolInfo?.installed) {
      toolbeltActions.push({
        action: () => openToolDirectory(toolId),
        description: "openFiles",
        icon: "files",
        id: "files",
      })
    }

    return toolbeltActions
  }, [toolId, toolInfo])

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
      tools={<ToolBelt actions={toolbeltActions} />}
    />
  )
}
