import { type ReactNode, useEffect } from "react"

import { isEmpty } from "@common/utils/objects"
import { useStore, useStoreActions } from "@utils/store"

export function DataProvider({ children }: { children: ReactNode }): JSX.Element {
  const isDownloading = useStore(store => !isEmpty(store.downloads))
  const isLinking = useStore(store => !!store.linker)
  const isLoading = useStore(store => !!store.loader)

  const actions = useStoreActions()

  useEffect(() => window.api.subscribe(actions), [actions])

  useEffect(() => {
    if (isLinking || isLoading) {
      actions.openSnackbar("load-progress", {})
    }
  }, [actions, isLinking, isLoading])

  useEffect(() => {
    if (isDownloading) {
      actions.openSnackbar("download-progress", {})
    }
  }, [actions, isDownloading])

  return <>{children}</>
}
