import type { Logger } from "@common/logs"
import type { TaskInfo } from "@common/state"

export interface TaskContext extends Logger {
  readonly key: string
  progress: number | null
  step: string | null
  raise(message: string): never
  setProgress(current: number, total: number): void
  setStep(step: string | null): void
}

export function createContext(
  key: string,
  onStatusUpdate?: (info: TaskInfo | null) => void,
): TaskContext {
  const prefix = `[${key}]`

  const context: TaskContext = {
    key,
    progress: null,
    step: null,
    debug(...params) {
      console.debug(prefix, ...params)
    },
    error(...params) {
      console.error(prefix, ...params)
    },
    info(...params) {
      console.info(prefix, ...params)
    },
    raise(message) {
      throw Error(message)
    },
    setProgress(current, total) {
      const progress = Math.floor(100 * (current / total))
      if (context.progress !== progress) {
        context.progress = progress
        if (context.step) {
          onStatusUpdate?.({ step: context.step, progress })
        }
      }
    },
    setStep(step) {
      if (context.step !== step) {
        context.progress = null
        context.step = step
        if (step) {
          onStatusUpdate?.({ step })
        } else {
          onStatusUpdate?.(null)
        }
      }
    },
    warn(...params) {
      console.warn(prefix, ...params)
    },
  }

  return context
}
