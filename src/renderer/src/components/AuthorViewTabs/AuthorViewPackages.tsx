import { values } from "@salinco/nice-utils"
import { useMemo } from "react"

import type { AuthorID } from "@common/authors"
import { PackageList } from "@components/PackageList/PackageList"
import { useStore } from "@utils/store"

export default function AuthorViewPackages({ authorId }: { authorId: AuthorID }): JSX.Element {
  const packages = useStore(store => store.packages)

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
