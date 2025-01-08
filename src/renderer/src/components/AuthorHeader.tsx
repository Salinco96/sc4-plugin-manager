import type { AuthorID } from "@common/authors"
import { Page } from "@utils/navigation"
import { useAuthors, useStoreActions } from "@utils/store"
import { useMemo } from "react"
import { Header } from "./Header"
import { getAuthorName } from "./Tags/utils"
import type { ToolBeltAction } from "./ToolBelt"

export function AuthorHeader({
  isListItem,
  setActive,
  authorId,
}: {
  isListItem?: boolean
  setActive?: (active: boolean) => void
  authorId: AuthorID
}): JSX.Element {
  const actions = useStoreActions()
  const authors = useAuthors()
  const authorInfo = authors[authorId]

  const toolbeltActions: ToolBeltAction[] = useMemo(() => {
    const toolbeltActions: ToolBeltAction[] = []

    if (authorInfo?.url) {
      toolbeltActions.push({
        action: () => actions.openAuthorURL(authorId),
        description: authorInfo.url.includes("simtropolis") ? "openSimtropolis" : "openUrl",
        icon: "website",
        id: "url",
      })
    }

    return toolbeltActions
  }, [actions, authorId, authorInfo])

  return (
    <Header
      isListItem={isListItem}
      location={{ data: { authorId }, page: Page.AuthorView }}
      setActive={setActive}
      subtitle={authorId}
      thumbnail={authorInfo?.thumbnail ?? getDefaultThumbnail(authorId)}
      thumbnailSize="small"
      title={getAuthorName(authorId, authors)}
      tools={toolbeltActions}
    />
  )
}

function getDefaultThumbnail(authorId: AuthorID): string {
  const initial = authorId[0].toUpperCase()
  const color = 100 + (authorId.length % 8) * 20
  return `https://www.simtropolis.com/objects/profiles/avatars/${initial}-${color}.thumb.png`
}
