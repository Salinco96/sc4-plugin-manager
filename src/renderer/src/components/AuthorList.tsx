import { useTranslation } from "react-i18next"

import type { AuthorID } from "@common/authors"
import { FlexCol } from "@components/FlexBox"
import { List } from "@components/List"
import { useNavigation } from "@utils/navigation"

import { AuthorListItem } from "./AuthorListItem"

export function AuthorList({ authorIds }: { authorIds: AuthorID[] }): JSX.Element {
  const { fromAuthorId } = useNavigation()

  const { t } = useTranslation("AuthorList")

  return (
    <FlexCol fullHeight>
      <List
        emptyMessage={t("emptyList")}
        items={authorIds}
        initialItem={fromAuthorId}
        renderItem={authorId => <AuthorListItem authorId={authorId} />}
      />
    </FlexCol>
  )
}
