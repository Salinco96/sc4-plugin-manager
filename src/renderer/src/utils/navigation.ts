import { type EmptyRecord, remove } from "@salinco/nice-utils"
import { useMemo } from "react"
import { create } from "zustand"

import type { AuthorID } from "@common/authors"
import type { CollectionID } from "@common/collections"
import type { PackageID } from "@common/packages"
import type { ToolID } from "@common/tools"

export enum Page {
  Authors = "Authors",
  AuthorView = "AuthorView",
  Collections = "Collections",
  CollectionView = "CollectionView",
  Packages = "Packages",
  PackageView = "PackageView",
  Profile = "Profile",
  Settings = "Settings",
  Tools = "Tools",
  ToolView = "ToolView",
}

export type PageData<T extends Page> = {
  Authors: EmptyRecord
  AuthorView: { id: AuthorID }
  Collections: EmptyRecord
  CollectionView: { id: CollectionID }
  Packages: EmptyRecord
  PackageView: { id: PackageID }
  Profile: EmptyRecord
  Settings: EmptyRecord
  Tools: EmptyRecord
  ToolView: { id: ToolID }
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
        listeners: remove(state.listeners, listener),
      }))
    }
  },
}))

export const useLocation = (() => useHistory(history => history.current)) as <
  T extends Page,
>() => Location<T>

export interface Navigation {
  fromAuthorId?: AuthorID
  fromCollectionId?: CollectionID
  fromPackageId?: PackageID
  fromToolId?: ToolID
  openAuthorView(authorId: AuthorID): void
  openCollectionView(collectionId: CollectionID): void
  openPackageView(packageId: PackageID): void
  openToolView(toolId: ToolID): void
}

export function useNavigation(): Navigation {
  const history = useHistory()

  return useMemo<Navigation>(() => {
    const { previous } = history

    return {
      fromAuthorId: previous?.page === Page.AuthorView ? previous.data.id : undefined,
      fromCollectionId: previous?.page === Page.CollectionView ? previous.data.id : undefined,
      fromPackageId: previous?.page === Page.PackageView ? previous.data.id : undefined,
      fromToolId: previous?.page === Page.ToolView ? previous.data.id : undefined,
      openAuthorView(id: AuthorID) {
        history.push({ page: Page.AuthorView, data: { id } })
      },
      openCollectionView(id: CollectionID) {
        history.push({ page: Page.CollectionView, data: { id } })
      },
      openPackageView(id: PackageID) {
        history.push({ page: Page.PackageView, data: { id } })
      },
      openToolView(id: ToolID) {
        history.push({ page: Page.ToolView, data: { id } })
      },
    }
  }, [history])
}
