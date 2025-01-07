import { keys, sortBy } from "@salinco/nice-utils"

import { AuthorList } from "@components/AuthorList"
import { getAuthorName } from "@components/Tags/utils" // TODO
import { useAuthors } from "@utils/store"

function Authors(): JSX.Element {
  const authors = useAuthors()

  const authorIds = sortBy(keys(authors), authorId => getAuthorName(authorId, authors))

  return <AuthorList authorIds={authorIds} />
}

export default Authors
