import { Language as WebIcon } from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import type { AuthorID } from "@common/authors"
import { FlexBox } from "@components/FlexBox"
import { useAuthors, useStoreActions } from "@utils/store"

import { ToolButton } from "./ToolButton"

export function AuthorTools({ authorId }: { authorId: AuthorID }): JSX.Element {
  const actions = useStoreActions()
  const authors = useAuthors()

  const authorInfo = authors[authorId]

  const { t } = useTranslation("AuthorView")

  return (
    <FlexBox alignItems="center" gap={0.5} mx={0.5}>
      {authorInfo?.url && (
        <ToolButton
          description={t("openUrl")}
          icon={WebIcon}
          onClick={() => actions.openAuthorURL(authorId)}
        />
      )}
    </FlexBox>
  )
}
