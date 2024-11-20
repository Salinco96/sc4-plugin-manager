import { useCallback, useInsertionEffect, useRef } from "react"

// biome-ignore lint/suspicious/noExplicitAny: function params generic
export function useEffectEvent<R, Q extends any[]>(fn: (...args: Q) => R): (...args: Q) => R {
  const ref = useRef(fn)

  useInsertionEffect(() => {
    ref.current = fn
  })

  return useCallback((...args) => ref.current(...args), [])
}
