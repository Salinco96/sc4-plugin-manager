import type { AuthorID } from "@common/authors"
import { FlexBox } from "@components/FlexBox"
import { List } from "@components/List"
import { Page, useHistory } from "@utils/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { AuthorListItem } from "./AuthorListItem"

export function AuthorList({ authorIds }: { authorIds: AuthorID[] }): JSX.Element {
  const history = useHistory()

  const { t } = useTranslation("AuthorList")

  const fromAuthorId = useMemo(() => {
    if (history.previous?.page === Page.AuthorView) {
      return history.previous.data.authorId
    }
  }, [history])

  return (
    <FlexBox direction="column" height="100%">
      <List
        emptyMessage={t("emptyList")}
        items={authorIds}
        initialItem={fromAuthorId}
        renderItem={authorId => <AuthorListItem authorId={authorId} />}
      />
    </FlexBox>
  )
}
