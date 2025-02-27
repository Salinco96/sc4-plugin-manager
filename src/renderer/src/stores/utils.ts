import { capitalize } from "@mui/material"
import update, { type Spec } from "immutability-helper"
import type { StoreApi } from "zustand"
import { shallow } from "zustand/shallow"
import { createWithEqualityFn, useStoreWithEqualityFn } from "zustand/traditional"

declare module "vite/types/hot" {
  interface ViteHotContext {
    stores?: {
      [name: string]: unknown
    }
  }
}

// biome-ignore lint/suspicious/noExplicitAny: any function parameters
export type Selector<S, R, Q extends any[] = any[]> = (state: S, ...args: Q) => R

export type StoreExtensions<S> = {
  [K in `get${string}`]: Selector<S, unknown>
}

type ExtendedHooks<S, E extends StoreExtensions<S>> = {
  [K in Extract<keyof S, string> as `use${Capitalize<K>}`]: () => S[K]
} & {
  [K in Extract<keyof E, string> as K extends `get${infer N}`
    ? `use${N}`
    : never]: E[K] extends Selector<S, infer R, infer Q> ? (...args: Q) => R : never
}

type ExtendedApi<S, E extends StoreExtensions<S>> = {
  [K in Extract<keyof S, string> as `get${Capitalize<K>}`]: () => S[K]
} & {
  [K in Extract<keyof E, string>]: E[K] extends Selector<S, infer R, infer Q>
    ? (...args: Q) => R
    : never
}

export type Api<S, E extends StoreExtensions<S>> = StoreApi<S> & {
  updateState: (spec: Spec<S>) => void
} & ExtendedApi<S, E>

export type Store<S, E extends StoreExtensions<S>> = {
  api: Api<S, E>
  useShallow: <T>(selector: (state: S) => T) => T
  useStore: <T>(selector: (state: S) => T) => T
} & ExtendedHooks<S, E>

export function createStore<S, E extends StoreExtensions<S>>(
  name: string,
  initialState: S,
  extensions?: E,
): Store<S, E> {
  const useStore = createWithEqualityFn(() => initialState)

  if (import.meta.hot) {
    import.meta.hot.stores ??= {}
    const cache = import.meta.hot.stores

    const state = cache[name]
    if (state) {
      useStore.setState(state)
    }

    useStore.subscribe(state => {
      cache[name] = state
    })

    import.meta.hot.accept(newModule => {
      if (newModule && cache[name]) {
        useStore.setState(cache[name])
      }
    })
  }

  const extraApi = {} as ExtendedApi<S, E>
  const extraHooks = {} as ExtendedHooks<S, E>

  for (const key in useStore.getState()) {
    const selector = (state: S) => state[key]

    const getterName = `get${capitalize(key)}` as keyof ExtendedApi<S, E>
    const getter = () => selector(useStore.getState())
    extraApi[getterName] = getter as ExtendedApi<S, E>[typeof getterName]

    const hookName = `use${capitalize(key)}` as keyof ExtendedHooks<S, E>
    const hook = () => useStore(selector)
    extraHooks[hookName] = hook as ExtendedHooks<S, E>[typeof hookName]
  }

  if (extensions) {
    for (const key in extensions) {
      const selector = extensions[key] as (state: S, ...args: unknown[]) => unknown

      const getterName = key as keyof ExtendedApi<S, E>
      const getter = (...args: unknown[]) => selector(useStore.getState(), ...args)
      extraApi[getterName] = getter as ExtendedApi<S, E>[typeof getterName]

      if (key.startsWith("get")) {
        const hookName = key.replace("get", "use") as keyof ExtendedHooks<S, E>
        const hook = (...args: unknown[]) => useStore(state => selector(state, ...args))
        extraHooks[hookName] = hook as ExtendedHooks<S, E>[typeof hookName]
      }
    }
  }

  return {
    api: {
      ...extraApi,
      ...useStore,
      updateState(spec) {
        useStore.setState(oldState => update(oldState, spec))
      },
    },
    ...extraHooks,
    useShallow(selector) {
      return useStoreWithEqualityFn(useStore, selector, shallow)
    },
    useStore(selector) {
      return useStore(selector)
    },
  }
}
