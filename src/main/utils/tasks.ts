interface Task<T> {
  promise: Promise<T>
  reject: (error: Error) => void
  resolve: (result: T) => void
}

export class TaskManager<T = unknown> {
  public maxParallel: number
  public onTaskUpdate?: (ongoingTasks: string[]) => void

  public readonly cache: Map<string, T> = new Map()
  public readonly ongoingTasks: string[] = []
  public readonly pendingTasks: Map<string, () => Promise<T>> = new Map()
  public readonly tasks: Map<string, Task<T>> = new Map()

  public constructor(maxParallel: number, onTaskUpdate?: (ongoingTasks: string[]) => void) {
    this.maxParallel = maxParallel
    this.onTaskUpdate = onTaskUpdate
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

  public async queue<S extends T>(
    key: string,
    handler: () => Promise<S>,
    options: { cache?: boolean; invalidate?: boolean } = {},
  ): Promise<S> {
    const existingTask = this.tasks.get(key)

    if (options.invalidate) {
      this.cache.delete(key)
    }

    if (existingTask) {
      // Invalidate already-running/scheduled task by scheduling a new one
      if (options.invalidate) {
        this.pendingTasks.set(key, handler)
      }

      // Return existing task
      return existingTask.promise as Promise<S>
    }

    // Cached result of previous run
    if (options.cache && this.cache.has(key)) {
      return this.cache.get(key) as S
    }

    // Create new task
    const task = {} as Task<T>
    const promise = new Promise<T>((resolve, reject) => {
      task.reject = reject
      task.resolve = resolve
      if (this.ongoingTasks.length < this.maxParallel) {
        this.run(key, handler)
        this.sendTaskUpdate()
      } else {
        this.pendingTasks.set(key, handler)
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

    return promise as Promise<S>
  }

  protected async run(key: string, handler: () => Promise<T>): Promise<void> {
    try {
      this.ongoingTasks.push(key)
      const result = await handler()
      const task = this.tasks.get(key)
      // If task with same key is already pending, it means that current task was invalidated
      if (task && !this.pendingTasks.has(key)) {
        task.resolve(result)
      } else {
        console.debug(`Task ${key} finished but was invalidated:`, result)
      }
    } catch (error) {
      const task = this.tasks.get(key)
      // If task with same key is already pending, it means that current task was invalidated
      if (task && !this.pendingTasks.has(key)) {
        task.reject(error as Error)
      } else {
        console.warn(`Error raised during task ${key} but task was invalidated:`, error)
      }
    } finally {
      // Remove key from ongoing tasks
      const index = this.ongoingTasks.indexOf(key)
      if (index >= 0) {
        this.ongoingTasks.splice(index, 1)
      }

      // Start pending tasks
      if (this.ongoingTasks.length < this.maxParallel) {
        for (const [nextKey, nextTask] of this.pendingTasks) {
          this.pendingTasks.delete(nextKey)
          this.run(nextKey, nextTask)
          if (this.ongoingTasks.length >= this.maxParallel) {
            break
          }
        }
      }

      this.sendTaskUpdate()
    }
  }

  protected sendTaskUpdate(): void {
    this.onTaskUpdate?.(this.ongoingTasks)
  }
}
