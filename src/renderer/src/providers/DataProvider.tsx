import { ReactNode, useEffect } from "react"

import { closeSnackbar, enqueueSnackbar } from "notistack"

import { useStore, useStoreActions } from "@renderer/utils/store"

export function DataProvider({ children }: { children: ReactNode }): JSX.Element {
  const isLoading = useStore(
    store =>
      store.profiles === undefined ||
      store.collections === undefined ||
      store.localPackages === undefined ||
      store.remotePackages === undefined ||
      store.settings === undefined,
  )

  const isDownloading = useStore(store => store.state.ongoingDownloads.length !== 0)

  const actions = useStoreActions()

  useEffect(() => {
    window.api.getCollections().then(actions.loadCollections)
    window.api.getProfiles().then(actions.loadProfiles)
    window.api.getLocalPackages().then(actions.loadLocalPackages)
    window.api.getRemotePackages().then(actions.loadRemotePackages)
    window.api.getSettings().then(actions.loadSettings)
    return window.api.subscribeToStateUpdates(actions.updateState)
  }, [actions])

  useEffect(() => {
    if (isLoading) {
      const key = enqueueSnackbar({ persist: true, variant: "progress" })
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
