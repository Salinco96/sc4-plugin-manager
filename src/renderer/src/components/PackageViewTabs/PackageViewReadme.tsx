import { useEffect, useState } from "react"

import { PackageID } from "@common/packages"
import { Loader } from "@components/Loader"
import { MarkdownView } from "@components/MarkdownView"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

export function PackageViewReadme({ packageId }: { packageId: PackageID }): JSX.Element | null {
  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const [readme, setReadme] = useState<{ html?: string; md?: string }>()

  useEffect(() => {
    actions.getPackageReadme(packageId, variantId).then(setReadme).catch(console.error)
  }, [actions, packageId, variantId])

  if (!readme) {
    return <Loader />
  }

  if (readme.html) {
    return <div dangerouslySetInnerHTML={{ __html: readme.html }} style={{ height: "100%" }} />
  }

  if (readme.md) {
    return <MarkdownView md={readme.md} />
  }

  return null
}
