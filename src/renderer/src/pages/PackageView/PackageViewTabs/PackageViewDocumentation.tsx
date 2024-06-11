import { useEffect, useState } from "react"

import { Loading } from "@renderer/pages/Loading"
import { useCurrentVariant } from "@renderer/utils/packages"
import { useStoreActions } from "@renderer/utils/store"

export function PackageViewDocumentation({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const variantId = useCurrentVariant(packageId).id

  const [html, setHtml] = useState<string>()

  useEffect(() => {
    actions.getPackageDocsAsHtml(packageId, variantId).then(setHtml).catch(console.error)
  }, [actions, packageId, variantId])

  if (!html) {
    return <Loading />
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} style={{ height: "100%" }} />
}
