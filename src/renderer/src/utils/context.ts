import { type Context, createContext as _createContext } from "react"
import { type StateCreator, type StoreApi, type UseBoundStore, create } from "zustand"

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
): UseBoundStore<StoreApi<Store>> {
  const store = create(createStore(initialState))

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

  return store
}
