import { keys, sortBy } from "@salinco/nice-utils"

import { getAuthorName } from "@common/authors"
import { AuthorList } from "@components/AuthorList"
import { store } from "@stores/main"

function Authors(): JSX.Element {
  const authors = store.useAuthors()

  const authorIds = sortBy(keys(authors), authorId => getAuthorName(authorId, authors))

  return <AuthorList authorIds={authorIds} />
}

export default Authors
