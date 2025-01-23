import { type ComponentType, Suspense, useEffect } from "react"

import { ErrorBoundary, type ErrorComponentProps } from "@components/ErrorBoundary"

import { Loader } from "./components/Loader"
import { PageComponents } from "./pages"
import { type Page, type PageData, useHistory, useLocation } from "./utils/navigation"

export function ContentErrorComponent({ clearError, error }: ErrorComponentProps) {
  const { subscribe } = useHistory()

  // Clear error when changing location
  useEffect(() => subscribe(clearError), [clearError, subscribe])

  return <>{error.message}</>
}

/**
 * Main page content.
 */
export function Content<T extends Page>(): JSX.Element {
  const { data, page } = useLocation<T>()

  const PageComponent = PageComponents[page] as ComponentType<PageData<T>>

  return (
    <Suspense fallback={<Loader />}>
      <ErrorBoundary ErrorComponent={ContentErrorComponent}>
        <PageComponent {...data} />
      </ErrorBoundary>
    </Suspense>
  )
}
