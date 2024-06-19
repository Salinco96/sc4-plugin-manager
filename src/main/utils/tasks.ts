import { Logger } from "@common/logs"
import { TaskInfo } from "@common/state"

import { isDev } from "./env"

export interface Task<T> {
  progress?: number
  promise: Promise<T>
  reject: (error: Error) => void
  resolve: (result: T) => void
}

export interface TaskManagerOptions {
  onTaskUpdate?(ongoingTasks: TaskInfo[]): void
  parallel?: number
}

export type TaskHandler<T = void> = (context: TaskContext<T>) => Promise<T>

export interface TaskContext<T = void> extends Logger {
  readonly handler: TaskHandler<T>
  readonly key: string
  raise(message: string): never
  raiseInDev(message: string): void
  setProgress(progress: number): void
}

export class TaskManager<T = void> {
  public readonly cache: Map<string, T> = new Map()
  public readonly name: string
  public readonly onTaskUpdate?: (ongoingTasks: TaskInfo[]) => void
  public readonly ongoingTasks: string[] = []
  public readonly parallel: number
  public readonly pendingTasks: Map<string, TaskContext<T>> = new Map()
  public readonly tasks: Map<string, Task<T>> = new Map()

  public constructor(name: string, options: TaskManagerOptions = {}) {
    this.parallel = options.parallel ?? 1
    this.name = name
    this.onTaskUpdate = options.onTaskUpdate
  }

  public hasOngoingTasks(): boolean {
    return this.ongoingTasks.length !== 0
  }

  public hasPendingTasks(): boolean {
    return this.pendingTasks.size !== 0
  }

  public isOngoing(key: string): boolean {
    return this.ongoingTasks.includes(key)
  }

  public isPending(key: string): boolean {
    return this.pendingTasks.has(key)
  }

  public isCached(key: string): boolean {
    return this.cache.has(key)
  }

  public invalidateCache(key: string) {
    this.cache.delete(key)
  }

  public async queue(
    key: string,
    handler: TaskHandler<T>,
    options: { cache?: boolean; invalidate?: boolean } = {},
  ): Promise<T> {
    const existingTask = this.tasks.get(key)

    if (options.invalidate) {
      this.cache.delete(key)
    }

    if (existingTask) {
      // Invalidate already-running/scheduled task by scheduling a new one
      if (options.invalidate) {
        const context = this.getContext(key, handler)
        this.pendingTasks.set(key, context)
      }

      // Return existing task
      return existingTask.promise
    }

    // Cached result of previous run
    if (options.cache && this.cache.has(key)) {
      return this.cache.get(key) as T
    }

    // Create new task
    const task = {} as Task<T>
    const promise = new Promise<T>((resolve, reject) => {
      task.reject = reject
      task.resolve = resolve
      const context = this.getContext(key, handler)
      if (this.ongoingTasks.length < this.parallel) {
        this.run(key, context)
        this.sendTaskUpdate()
      } else {
        this.pendingTasks.set(key, context)
      }
    })

    task.promise = promise
    this.tasks.set(key, task)

    // Set cache on task success
    if (options.cache) {
      promise.then(result => this.cache.set(key, result))
    }

    // Clean up task once done
    promise.finally(() => this.tasks.delete(key))

    return promise
  }

  protected async run(key: string, context: TaskContext<T>): Promise<void> {
    try {
      this.ongoingTasks.push(key)
      const result = await context.handler(context)
      const task = this.tasks.get(key)
      // If task with same key is already pending, it means that current task was invalidated
      if (task && !this.pendingTasks.has(key)) {
        task.resolve(result)
      }
    } catch (error) {
      const task = this.tasks.get(key)
      // If task with same key is already pending, it means that current task was invalidated
      if (task && !this.pendingTasks.has(key)) {
        task.reject(error as Error)
      } else {
        context.warn("Error raised but task was invalidated", error)
      }
    } finally {
      // Remove key from ongoing tasks
      const index = this.ongoingTasks.indexOf(key)
      if (index >= 0) {
        this.ongoingTasks.splice(index, 1)
      }

      // Start pending tasks
      if (this.ongoingTasks.length < this.parallel) {
        for (const [nextKey, nextTask] of this.pendingTasks) {
          this.pendingTasks.delete(nextKey)
          this.run(nextKey, nextTask)
          if (this.ongoingTasks.length >= this.parallel) {
            break
          }
        }
      }

      this.sendTaskUpdate()
    }
  }

  protected getContext<S extends T>(key: string, handler: TaskHandler<S>): TaskContext<S> {
    const prefix = `[${this.name}] (${key})`
    return {
      handler,
      key,
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
      raiseInDev(message) {
        if (isDev()) {
          throw Error(message)
        } else {
          console.warn(message)
        }
      },
      setProgress: progress => {
        const task = this.tasks.get(key)
        if (task && task.progress !== progress) {
          task.progress = progress
          this.sendTaskUpdate()
        }
      },
      warn(...params) {
        console.warn(prefix, ...params)
      },
    }
  }

  protected sendTaskUpdate(): void {
    if (this.onTaskUpdate) {
      this.onTaskUpdate(
        this.ongoingTasks.map(key => {
          const task = this.tasks.get(key)
          return { key, progress: task?.progress }
        }),
      )
    }
  }
}
