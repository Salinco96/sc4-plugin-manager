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

  return {
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
      if (this.progress !== progress) {
        this.progress = progress
        if (this.step) {
          onStatusUpdate?.({ step: this.step, progress })
        }
      }
    },
    setStep(step) {
      if (this.step !== step) {
        this.progress = null
        this.step = step
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
}
