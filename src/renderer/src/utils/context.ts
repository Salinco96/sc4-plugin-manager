import { type Context, createContext as _createContext } from "react"
import { type StateCreator, type StoreApi, type UseBoundStore, create } from "zustand"

import type { Store } from "./store"

declare module "vite/types/hot" {
  interface ViteHotContext {
    contexts?: {
      [name: string]: unknown
    }
    state?: Omit<Store, "actions">
    store?: UseBoundStore<StoreApi<Store>>
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
): UseBoundStore<StoreApi<Store>> {
  if (import.meta.env.PROD || !import.meta.hot) {
    return create(createStore(initialState))
  }

  const cache = import.meta.hot
  cache.state ??= initialState
  const store = create(createStore(cache.state))

  import.meta.hot.on("vite:beforeUpdate", () => {
    cache.state = store.getState()
  })

  return store
}
