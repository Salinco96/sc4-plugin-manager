import type { Logger } from "@common/logs"
import type { TaskInfo } from "@common/state"

export interface TaskContext extends Logger, TaskInfo {
  abortCheck(): void
  cancel(reason: string): never
  fail(reason: string): never
  setLabel(label: string): void
  setProgress(current: number, total: number): void
}

export function createContext(
  key: string,
  options: {
    label?: string
    logger?: Logger
    onProgress: (context: TaskContext) => void
    signal?: AbortSignal
  },
): TaskContext {
  const prefix = `[${key}] `

  const context: TaskContext = {
    key,
    label: options.label,
    abortCheck: () => {
      options.signal?.throwIfAborted()
    },
    cancel: reason => {
      throw Error(reason ? `Cancelled - ${reason}` : "Cancelled")
    },
    debug: (message, ...data) => {
      options.logger?.debug(prefix + message, ...data)
    },
    error: (message, ...data) => {
      options.logger?.error(prefix + message, ...data)
    },
    fail: reason => {
      throw Error(reason)
    },
    info: (message, ...data) => {
      options.logger?.info(prefix + message, ...data)
    },
    setProgress: (current, total) => {
      const progress = Math.floor(100 * (current / total))
      if (context.progress !== progress) {
        context.progress = progress
        options.onProgress(context)
      }
    },
    setLabel: label => {
      if (context.label !== label) {
        context.label = label
        context.progress = undefined
        options.onProgress(context)
      }
    },
    warn: (message, ...data) => {
      options.logger?.warn(prefix + message, ...data)
    },
  }

  return context
}
