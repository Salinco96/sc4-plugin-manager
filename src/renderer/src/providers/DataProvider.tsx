import { compact, isEmpty } from "@salinco/nice-utils"
import { type ReactNode, useEffect } from "react"

import { store } from "@stores/main"
import { status } from "@stores/status"
import { openSnackbar } from "@stores/ui"
import { computePackageList } from "@utils/packages"

export function DataProvider({ children }: { children: ReactNode }): JSX.Element {
  const isDownloading = status.useStore(status => !isEmpty(status.downloads))
  const isLinking = status.useStore(status => !!status.linker)
  const isLoading = status.useStore(status => !!status.loader)

  useEffect(() => {
    return window.api.subscribe({
      updateState(data, options) {
        console.debug("updateState", data, options)

        store.api.setState(state => {
          const newState = {
            ...state,
            ...data,
            packages: data.packages
              ? compact(options.merge ? { ...state.packages, ...data.packages } : data.packages)
              : state.packages,
            profiles: data.profiles
              ? compact(options.merge ? { ...state.profiles, ...data.profiles } : data.profiles)
              : state.profiles,
          }

          if (options.recompute) {
            return { ...newState, ...computePackageList(newState, false) }
          }

          return newState
        })
      },
      updateStatus(data) {
        status.api.setState(state => {
          const newState = {
            ...state,
            ...data,
            downloads: data.downloads
              ? compact({ ...state.downloads, ...data.downloads })
              : state.downloads,
          }

          return newState
        })
      },
    })
  }, [])

  useEffect(() => {
    if (isLinking || isLoading) {
      openSnackbar("load-progress", {})
    }
  }, [isLinking, isLoading])

  useEffect(() => {
    if (isDownloading) {
      openSnackbar("download-progress", {})
    }
  }, [isDownloading])

  return <>{children}</>
}
