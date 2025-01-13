import { type Context, createContext as _createContext } from "react"
import type { StateCreator, StoreApi, UseBoundStore } from "zustand"
import { shallow } from "zustand/shallow"
import { createWithEqualityFn, useStoreWithEqualityFn } from "zustand/traditional"

import type { Store } from "./store"

declare module "vite/types/hot" {
  interface ViteHotContext {
    contexts?: {
      [name: string]: unknown
    }
    state?: Store
  }
}

// Fix hot-reloading
export function createContext<T>(name: string, defaultValue: T): Context<T> {
  if (import.meta.env.PROD || !import.meta.hot) {
    return _createContext(defaultValue)
  }

  import.meta.hot.contexts ??= {}
  const cache = import.meta.hot.contexts

  const cached = cache[name]
  if (cached) {
    return cached as Context<T>
  }

  const context = _createContext(defaultValue)

  import.meta.hot.on("vite:beforeUpdate", () => {
    cache[name] = context
  })

  return context
}

// Fix hot-reloading
export function getStore(
  initialState: Omit<Store, "actions">,
  createStore: (initialState: Omit<Store, "actions">) => StateCreator<Store>,
): UseBoundStore<StoreApi<Store>> & { shallow: <T>(selector: (store: Store) => T) => T } {
  const store = createWithEqualityFn(createStore(initialState))

  const hmr = import.meta.hot
  if (hmr) {
    const state = hmr.state
    if (state) {
      store.setState(state)
    }

    store.subscribe(state => {
      hmr.state = state
    })

    hmr.accept(newModule => {
      if (newModule && hmr.state) {
        store.setState(hmr.state)
      }
    })
  }

  return Object.assign(store, {
    shallow: <T>(selector: (store: Store) => T) => useStoreWithEqualityFn(store, selector, shallow),
  })
}
