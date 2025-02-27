import update from "immutability-helper"
import { type ReactNode, useEffect } from "react"

import { type MainState, store } from "@stores/main"
import { openSnackbar } from "@stores/ui"
import { computePackageList } from "@utils/packages"
import { status } from "../stores/status"

export function DataProvider({ children }: { children: ReactNode }): JSX.Element {
  const isDownloading = status.useStore(status =>
    status.tasks.some(task => task.key.startsWith("download:")),
  )

  const isRunning = status.useStore(
    status => !!status.tasks.some(task => task.label && !task.key.startsWith("download:")),
  )

  useEffect(() => {
    return window.api.subscribe({
      updateState({ data, ...options }) {
        console.debug("updateState", data, options)

        store.api.setState(state => {
          const newState = update<MainState>(state, data)

          if (options.recompute) {
            return { ...newState, ...computePackageList(newState, false) }
          }

          return newState
        }, true)
      },
      updateStatus(data) {
        status.api.setState(data)
      },
    })
  }, [])

  useEffect(() => {
    if (isRunning) {
      openSnackbar("load-progress", {})
    }
  }, [isRunning])

  useEffect(() => {
    if (isDownloading) {
      openSnackbar("download-progress", {})
    }
  }, [isDownloading])

  return <>{children}</>
}
