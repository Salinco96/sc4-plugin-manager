import { Suspense } from "react"

import { Page, getPageComponent } from "./pages"
import { useLocation } from "./stores/navigation"

/**
 * Main page content.
 */
export function Content<T extends Page>(): JSX.Element {
  const { data, page } = useLocation<T>()
  const PageComponent = getPageComponent(page)

  return (
    <Suspense>
      <PageComponent {...data} />
    </Suspense>
  )
}
