import type { TaskInfo } from "@common/state"
import { type TaskContext, createContext } from "@node/tasks"

export interface Task<T> {
  pool: string
  progress?: number
  promise: Promise<T>
  reject: (error: Error) => void
  resolve: (result: T) => void
}

export interface TaskOptions<T> {
  cache?: boolean
  handler: TaskHandler<T>
  invalidate?: boolean
  onStatusUpdate?: (info: TaskInfo | null) => void
  pool: string
}

export interface TaskManagerOptions {
  pools?: { [pool in string]?: number }
}

export type TaskHandler<T = void> = (context: TaskContext) => Promise<T>

export interface TaskData<T> extends TaskContext, Readonly<TaskOptions<T>> {}

export class TaskManager {
  public readonly cache: Map<string, unknown> = new Map()
  public readonly onTaskUpdate?: (ongoingTasks: TaskInfo[]) => void
  public readonly ongoingTasks: string[] = []
  public readonly pools: { [pool in string]?: number }
  public readonly pendingTasks: Map<string, TaskData<unknown>> = new Map()
  public readonly tasks: Map<string, Task<unknown>> = new Map()

  public constructor(options: TaskManagerOptions = {}) {
    this.pools = options.pools ?? {}
  }

  public getPoolConcurrency(pool: string): number {
    return this.ongoingTasks.filter(key => this.tasks.get(key)?.pool === pool).length
  }

  public getPoolMaxConcurrency(pool: string): number {
    return this.pools[pool] ?? 1
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

  public isPoolAvailable(pool: string): boolean {
    return this.getPoolConcurrency(pool) < this.getPoolMaxConcurrency(pool)
  }

  public invalidateCache(key?: string) {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  public async queue<T = void>(key: string, options: TaskOptions<T>): Promise<T> {
    const existingTask = this.tasks.get(key) as Task<T> | undefined
    const pool = options.pool ?? "main"

    if (options.invalidate) {
      this.cache.delete(key)
    }

    if (existingTask) {
      // Invalidate already-running/scheduled task by scheduling a new one
      if (options.invalidate) {
        const context = this.getContext(key, options)
        this.pendingTasks.set(key, context as TaskData<unknown>)
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
      const context = this.getContext(key, options)
      if (this.isPoolAvailable(pool)) {
        this.run(key, context)
      } else {
        this.pendingTasks.set(key, context as TaskData<unknown>)
      }
    })

    task.promise = promise
    this.tasks.set(key, task as Task<unknown>)

    // Set cache on task success
    if (options.cache) {
      promise.then(result => this.cache.set(key, result))
    }

    // Clean up task once done
    promise.finally(() => this.tasks.delete(key))

    return promise
  }

  protected async run<T>(key: string, context: TaskData<T>): Promise<void> {
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
      if (context.step) {
        context.onStatusUpdate?.(null)
      }

      // Remove key from ongoing tasks
      const index = this.ongoingTasks.indexOf(key)
      if (index >= 0) {
        this.ongoingTasks.splice(index, 1)
      }

      // Start pending tasks
      if (this.isPoolAvailable(context.pool)) {
        for (const [nextKey, nextTask] of this.pendingTasks) {
          if (nextTask.pool === context.pool) {
            this.pendingTasks.delete(nextKey)
            this.run(nextKey, nextTask)
            break
          }
        }
      }
    }
  }

  protected getContext<T>(key: string, options: TaskOptions<T>): TaskData<T> {
    return {
      ...options,
      ...createContext(key, options.onStatusUpdate),
    }
  }
}
