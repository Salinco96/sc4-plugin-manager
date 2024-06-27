import { ComponentType, Suspense } from "react"

import { ErrorBoundary } from "@components/ErrorBoundary"

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
      <ErrorBoundary>
        <PageComponent {...data} />
        <Modal />
      </ErrorBoundary>
    </Suspense>
  )
}
