import { create } from "zustand"

export enum Page {
  Packages = "Packages",
  PackageView = "PackageView",
  Profile = "Profile",
  Settings = "Settings",
}

export type PageData<T extends Page> = {
  Packages: {}
  PackageView: { packageId: string }
  Profile: {}
  Settings: {}
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
  previous?: Location<Page>
  push<T extends Page>(location: Location<T>): void
  replace<T extends Page>(location: Location<T>): void
}

const initialLocation: Location = {
  data: {},
  page: Page.Settings,
}

export const useHistory = create<History>()((set, get) => ({
  back() {
    const { current, entries } = get()
    if (entries.length) {
      set({
        current: entries.at(-1),
        entries: entries.slice(0, -1),
        previous: current,
      })
    }
  },
  current: initialLocation,
  entries: [],
  push(location) {
    const { current, entries } = get()
    set({
      current: location as Location<Page>,
      entries: [...entries, current],
      previous: current,
    })
  },
  replace(location) {
    set({
      current: location as Location<Page>,
    })
  },
}))

export const useLocation = (() => useHistory(history => history.current)) as {
  <T extends Page>(): Location<T>
}
