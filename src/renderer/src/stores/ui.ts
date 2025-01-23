import { type SnackbarKey, closeSnackbar as _closeSnackbar, enqueueSnackbar } from "notistack"
import { useCallback } from "react"

import { Page } from "@utils/navigation"
import type { SnackbarProps, SnackbarType } from "@utils/snackbar"
import { createStore } from "./utils"

export type PageState<T extends Page> = ({
  [page in Page]: {
    activeTab?: string
    elementId?: string
  }
} & {
  [Page.AuthorView]: {
    activeTab: string
  }
  [Page.CityView]: {
    activeTab: string
  }
  [Page.CollectionView]: {
    activeTab: string
  }
  [Page.PackageView]: {
    activeTab: string
  }
  [Page.RegionView]: {
    activeTab: string
    cities: {
      showEstablishedOnly: boolean
    }
  }
  [Page.ToolView]: {
    activeTab: string
  }
})[T]

export interface UiState {
  pages: {
    [page in Page]: PageState<page>
  }
  snackbars: {
    [type in SnackbarType]?: SnackbarKey
  }
}

const initialState: UiState = {
  pages: {
    [Page.Authors]: {},
    [Page.AuthorView]: {
      activeTab: "packages",
    },
    [Page.CityView]: {
      activeTab: "backups",
    },
    [Page.Collections]: {},
    [Page.CollectionView]: {
      activeTab: "packages",
    },
    [Page.Packages]: {},
    [Page.PackageView]: {
      activeTab: "summary",
    },
    [Page.Profile]: {},
    [Page.Regions]: {},
    [Page.RegionView]: {
      activeTab: "cities",
      cities: {
        showEstablishedOnly: true,
      },
    },
    [Page.Tools]: {},
    [Page.ToolView]: {
      activeTab: "summary",
    },
    [Page.Settings]: {},
  },
  snackbars: {},
}

export const ui = createStore("ui", initialState, {
  getActiveTab(state: UiState, page: Page) {
    return state.pages[page].activeTab
  },
})

export function closeSnackbar(type: SnackbarType): void {
  const id = ui.api.getSnackbars()[type]
  if (id !== undefined) {
    _closeSnackbar(id)
    ui.api.updateState({ snackbars: { $unset: [type] } })
  }
}

export function openSnackbar<T extends SnackbarType>(type: T, props: SnackbarProps<T>): void {
  let id = ui.api.getSnackbars()[type]
  if (id === undefined) {
    id = enqueueSnackbar({ persist: true, variant: type, ...props })
    ui.api.updateState({ snackbars: { [type]: { $set: id } } })
  }
}

export function setActiveTab(page: Page, activeTab: string, elementId?: string): void {
  setPageState(page, { activeTab, elementId })
}

export function setPageState<T extends Page>(page: T, state: Partial<PageState<T>>): void {
  ui.api.updateState({ pages: { [page]: { $merge: state } } })
}

export function showErrorToast(message: string): void {
  enqueueSnackbar(message, { variant: "error" })
}

export function showInfoToast(message: string): void {
  enqueueSnackbar(message, { variant: "info" })
}

export function showSuccessToast(message: string): void {
  enqueueSnackbar(message, { variant: "success" })
}

export function usePageState<T extends Page>(
  page: T,
): [state: PageState<T>, setState: (state: Partial<PageState<T>>) => void] {
  return [
    ui.useStore(useCallback(state => state.pages[page], [page])),
    useCallback(state => ui.api.updateState({ pages: { [page]: { $merge: state } } }), [page]),
  ]
}
