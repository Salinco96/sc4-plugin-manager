import { ReactNode, useEffect } from "react"

import { closeSnackbar, enqueueSnackbar } from "notistack"

import { useStore, useStoreActions } from "@renderer/utils/store"

export function DataProvider({ children }: { children: ReactNode }): JSX.Element {
  const isDownloading = useStore(store => store.state.ongoingDownloads.length !== 0)
  const isLoading = useStore(store => store.state.loadStatus !== null)

  const actions = useStoreActions()

  useEffect(() => window.api.subscribeToStateUpdates(actions.updateState), [actions])

  useEffect(() => {
    if (isLoading) {
      const key = enqueueSnackbar({ persist: true, variant: "load-progress" })
      return () => closeSnackbar(key)
    }
  }, [isLoading])

  useEffect(() => {
    if (isDownloading) {
      const key = enqueueSnackbar({ persist: true, variant: "download-progress" })
      return () => closeSnackbar(key)
    }
  }, [isDownloading])

  return <>{children}</>
}
