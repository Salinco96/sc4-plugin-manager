import { Context, createContext as _createContext } from "react"

declare module "vite/types/hot" {
  interface ViteHotContext {
    contexts?: {
      [name: string]: unknown
    }
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
