import { ReactNode, useEffect } from "react"

import { useStore, useStoreActions } from "@renderer/utils/store"

export function DataProvider({ children }: { children: ReactNode }): JSX.Element {
  const isDownloading = useStore(store => store.ongoingDownloads.length !== 0)
  const isExtracting = useStore(store => store.ongoingExtracts.length !== 0)
  const isLoading = useStore(store => store.loadStatus !== null)

  const actions = useStoreActions()

  useEffect(() => window.api.subscribe(actions), [actions])

  useEffect(() => {
    if (isLoading) {
      actions.openSnackbar("load-progress", {})
    }
  }, [isLoading])

  useEffect(() => {
    if (isDownloading || isExtracting) {
      actions.openSnackbar("download-progress", {})
    }
  }, [isDownloading, isExtracting])

  return <>{children}</>
}
