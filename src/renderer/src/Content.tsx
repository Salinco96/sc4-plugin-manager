import { Suspense } from "react"

import { Modal } from "./components/Modal"
import { Page, getPageComponent } from "./pages"
import { Loading } from "./pages/Loading"
import { useLocation } from "./utils/navigation"

/**
 * Main page content.
 */
export function Content<T extends Page>(): JSX.Element {
  const { data, page } = useLocation<T>()
  const PageComponent = getPageComponent(page)

  return (
    <Suspense fallback={<Loading />}>
      <PageComponent {...data} />
      <Modal />
    </Suspense>
  )
}
