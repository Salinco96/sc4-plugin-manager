import { useEffect, useState } from "react"

import { Loader } from "@components/Loader"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

export function PackageViewReadme({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const variantId = useCurrentVariant(packageId).id

  const [html, setHtml] = useState<string>()

  useEffect(() => {
    actions.getPackageDocsAsHtml(packageId, variantId).then(setHtml).catch(console.error)
  }, [actions, packageId, variantId])

  if (!html) {
    return <Loader />
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} style={{ height: "100%" }} />
}
