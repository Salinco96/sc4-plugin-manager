import { useTranslation } from "react-i18next"

import type { AuthorID } from "@common/authors"
import { FlexBox } from "@components/FlexBox"
import { List } from "@components/List"
import { useNavigation } from "@utils/navigation"

import { AuthorListItem } from "./AuthorListItem"

export function AuthorList({ authorIds }: { authorIds: AuthorID[] }): JSX.Element {
  const { fromAuthorId } = useNavigation()

  const { t } = useTranslation("AuthorList")

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
