import { useMemo } from "react"

import { create } from "zustand"

import type { AuthorID } from "@common/authors"
import type { PackageID } from "@common/packages"
import { removeElement } from "@common/utils/arrays"
import type { EmptyRecord } from "@common/utils/types"

export enum Page {
  Authors = "Authors",
  AuthorView = "AuthorView",
  Packages = "Packages",
  PackageView = "PackageView",
  Profile = "Profile",
  Settings = "Settings",
}

export type PageData<T extends Page> = {
  Authors: EmptyRecord
  AuthorView: { authorId: AuthorID }
  Packages: EmptyRecord
  PackageView: { packageId: PackageID }
  Profile: EmptyRecord
  Settings: EmptyRecord
}[T]

export type Location<T extends Page = Page> = {
  [K in T]: {
    data: PageData<K>
    page: K
  }
}[T]

export interface History {
  back(): void
  current: Location<Page>
  entries: Location<Page>[]
  listeners: Array<(location: Location<Page>) => void>
  previous?: Location<Page>
  push<T extends Page>(location: Location<T>): void
  replace<T extends Page>(location: Location<T>): void
  subscribe(listener: (location: Location<Page>) => void): () => void
}

const initialLocation: Location = {
  data: {},
  page: Page.Settings,
}

export const useHistory = create<History>()((set, get) => ({
  back() {
    const { current, entries, listeners } = get()
    if (entries.length) {
      const location = entries.at(-1)

      set({
        current: location,
        entries: entries.slice(0, -1),
        previous: current,
      })

      for (const listener of listeners) {
        listener(location as Location<Page>)
      }
    }
  },
  current: initialLocation,
  entries: [],
  listeners: [],
  push(location) {
    const { current, entries, listeners } = get()
    set({
      current: location as Location<Page>,
      entries: [...entries, current],
      previous: current,
    })

    for (const listener of listeners) {
      listener(location as Location<Page>)
    }
  },
  replace(location) {
    const { listeners } = get()
    set({
      current: location as Location<Page>,
    })

    for (const listener of listeners) {
      listener(location as Location<Page>)
    }
  },
  subscribe(listener) {
    set(state => ({
      listeners: [...state.listeners, listener],
    }))

    return () => {
      set(state => ({
        listeners: removeElement(state.listeners, listener),
      }))
    }
  },
}))

export const useLocation = (() => useHistory(history => history.current)) as <
  T extends Page,
>() => Location<T>

export interface Navigation {
  openPackageView(packageId: PackageID): void
}

export function useNavigation(): Navigation {
  const history = useHistory()

  return useMemo<Navigation>(() => {
    return {
      openPackageView(packageId: PackageID) {
        history.push({ page: Page.PackageView, data: { packageId } })
      },
    }
  }, [history])
}
