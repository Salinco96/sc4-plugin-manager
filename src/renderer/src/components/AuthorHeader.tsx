import { useMemo } from "react"

import type { AuthorID } from "@common/authors"
import { getAuthorName } from "@common/authors"
import { Page } from "@utils/navigation"

import { openAuthorUrl } from "@stores/actions"
import { store } from "@stores/main"
import { Header } from "./Header"
import { ToolBelt, type ToolBeltAction } from "./ToolBelt"

export function AuthorHeader({
  isListItem,
  setActive,
  authorId,
}: {
  isListItem?: boolean
  setActive?: (active: boolean) => void
  authorId: AuthorID
}): JSX.Element {
  const authors = store.useAuthors()
  const authorInfo = authors[authorId]

  const toolbeltActions: ToolBeltAction[] = useMemo(() => {
    const toolbeltActions: ToolBeltAction[] = []

    if (authorInfo?.url) {
      toolbeltActions.push({
        action: () => openAuthorUrl(authorId),
        description: authorInfo.url.includes("simtropolis") ? "openSimtropolis" : "openUrl",
        icon: "website",
        id: "url",
      })
    }

    return toolbeltActions
  }, [authorId, authorInfo])

  return (
    <Header
      isListItem={isListItem}
      location={{ data: { authorId }, page: Page.AuthorView }}
      setActive={setActive}
      subtitle={authorId}
      thumbnail={authorInfo?.thumbnail ?? getDefaultThumbnail(authorId)}
      thumbnailSize="small"
      title={getAuthorName(authorId, authors)}
      tools={<ToolBelt actions={toolbeltActions} />}
    />
  )
}

function getDefaultThumbnail(authorId: AuthorID): string {
  const initial = authorId[0].toUpperCase()
  const color = 100 + (authorId.length % 8) * 20
  return `https://www.simtropolis.com/objects/profiles/avatars/${initial}-${color}.thumb.png`
}
