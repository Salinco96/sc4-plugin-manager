import { type EmptyRecord, remove } from "@salinco/nice-utils"
import { useMemo } from "react"
import { create } from "zustand"

import type { AuthorID } from "@common/authors"
import type { CollectionID } from "@common/collections"
import type { PackageID } from "@common/packages"
import type { CityID, RegionID } from "@common/regions"
import type { ToolID } from "@common/tools"

export enum Page {
  Authors = "Authors",
  AuthorView = "AuthorView",
  CityView = "CityView",
  Collections = "Collections",
  CollectionView = "CollectionView",
  Packages = "Packages",
  PackageView = "PackageView",
  Plugins = "Plugins",
  Profile = "Profile",
  Regions = "Regions",
  RegionView = "RegionView",
  Settings = "Settings",
  Tools = "Tools",
  ToolView = "ToolView",
}

export type PageData<T extends Page> = {
  Authors: EmptyRecord
  AuthorView: { authorId: AuthorID }
  CityView: { cityId: CityID; regionId: RegionID }
  Collections: EmptyRecord
  CollectionView: { collectionId: CollectionID }
  Packages: EmptyRecord
  PackageView: { packageId: PackageID }
  Plugins: { path?: string }
  Profile: EmptyRecord
  Settings: EmptyRecord
  Regions: EmptyRecord
  RegionView: { regionId: RegionID }
  Tools: EmptyRecord
  ToolView: { toolId: ToolID }
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
  fromCityId?: CityID
  fromCollectionId?: CollectionID
  fromPackageId?: PackageID
  fromRegionId?: RegionID
  fromToolId?: ToolID
  openAuthorView(authorId: AuthorID): void
  openCityView(cityId: CityID, regionId: RegionID): void
  openCollectionView(collectionId: CollectionID): void
  openPackageView(packageId: PackageID): void
  openPluginsView(path?: string): void
  openRegionView(regionId: RegionID): void
  openToolView(toolId: ToolID): void
}

export function useNavigation(): Navigation {
  const history = useHistory()

  return useMemo<Navigation>(() => {
    const { previous } = history

    return {
      fromAuthorId: previous?.page === Page.AuthorView ? previous.data.authorId : undefined,
      fromCityId: previous?.page === Page.CityView ? previous.data.cityId : undefined,
      fromCollectionId:
        previous?.page === Page.CollectionView ? previous.data.collectionId : undefined,
      fromPackageId: previous?.page === Page.PackageView ? previous.data.packageId : undefined,
      fromRegionId: previous?.page === Page.RegionView ? previous.data.regionId : undefined,
      fromToolId: previous?.page === Page.ToolView ? previous.data.toolId : undefined,
      openAuthorView(authorId) {
        history.push({ page: Page.AuthorView, data: { authorId } })
      },
      openCityView(cityId, regionId) {
        history.push({ page: Page.CityView, data: { cityId, regionId } })
      },
      openCollectionView(collectionId) {
        history.push({ page: Page.CollectionView, data: { collectionId } })
      },
      openPackageView(packageId) {
        history.push({ page: Page.PackageView, data: { packageId } })
      },
      openPluginsView(path) {
        history.push({ page: Page.Plugins, data: { path } })
      },
      openRegionView(regionId) {
        history.push({ page: Page.RegionView, data: { regionId } })
      },
      openToolView(toolId) {
        history.push({ page: Page.ToolView, data: { toolId } })
      },
    }
  }, [history])
}
