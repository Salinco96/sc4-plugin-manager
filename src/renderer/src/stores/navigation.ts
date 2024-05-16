import { create } from "zustand"

import { Page, PageData } from "@renderer/pages"

export type Location<T extends Page = Page> = {
  [K in T]: {
    data: PageData<K>
    page: K
  }
}[T]

export interface History {
  back(): void
  entries: Location<Page>[]
  previous?: Location<Page>
  push<T extends Page>(location: Location<T>): void
  replace<T extends Page>(location: Location<T>): void
}

export const initialLocation: Location<"Profile"> = {
  data: {},
  page: "Profile",
}

export const useLocation = create<Location<Page>>()(() => initialLocation) as {
  <T extends Page>(): Location<T>
  getState<T extends Page>(): Location<T>
  setState<T extends Page>(location: Location<T>, replace?: boolean): void
}

export const history: History = {
  back() {
    const location = this.entries.pop()
    if (location) {
      this.previous = useLocation.getState()
      useLocation.setState(location, true)
    }
  },
  entries: [],
  push(location) {
    this.previous = useLocation.getState()
    this.entries.push(this.previous)
    useLocation.setState(location, true)
  },
  replace(location) {
    this.previous = useLocation.getState()
    useLocation.setState(location, true)
  },
}
