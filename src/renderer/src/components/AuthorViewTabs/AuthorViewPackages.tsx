import { values } from "@salinco/nice-utils"
import { useMemo } from "react"

import type { AuthorID } from "@common/authors"
import { PackageList } from "@components/PackageList/PackageList"
import { store } from "@stores/main"

export default function AuthorViewPackages({ authorId }: { authorId: AuthorID }): JSX.Element {
  const packages = store.usePackages()

  const packageIds = useMemo(() => {
    if (!packages) {
      return []
    }

    return values(packages)
      .filter(({ variants }) =>
        values(variants).some(variant => !variant.disabled && variant.authors.includes(authorId)),
      )
      .map(packageInfo => packageInfo.id)
  }, [authorId, packages])

  return <PackageList packageIds={packageIds} />
}
