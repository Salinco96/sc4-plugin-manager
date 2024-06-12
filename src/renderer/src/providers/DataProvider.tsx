import { ReactNode, useEffect } from "react"

import { useStore, useStoreActions } from "@utils/store"

export function DataProvider({ children }: { children: ReactNode }): JSX.Element {
  const isDownloading = useStore(store => !!store.status?.ongoingDownloads.length)
  const isExtracting = useStore(store => !!store.status?.ongoingExtracts.length)
  const isLinking = useStore(store => !!store.status?.linker)
  const isLoading = useStore(store => !!store.status?.loader)

  const actions = useStoreActions()

  useEffect(() => window.api.subscribe(actions), [actions])

  useEffect(() => {
    if (isLinking || isLoading) {
      actions.openSnackbar("load-progress", {})
    }
  }, [isLinking, isLoading])

  useEffect(() => {
    if (isDownloading || isExtracting) {
      actions.openSnackbar("download-progress", {})
    }
  }, [isDownloading, isExtracting])

  return <>{children}</>
}
