import { ComponentType, Suspense } from "react"

import { Loader } from "./components/Loader"
import { Modal } from "./components/Modal"
import { PageComponents } from "./pages"
import { Page, PageData, useLocation } from "./utils/navigation"

/**
 * Main page content.
 */
export function Content<T extends Page>(): JSX.Element {
  const { data, page } = useLocation<T>()

  const PageComponent = PageComponents[page] as ComponentType<PageData<T>>

  return (
    <Suspense fallback={<Loader />}>
      <PageComponent {...data} />
      <Modal />
    </Suspense>
  )
}
