import { type AnyRecord, keys, mapValues, toArray } from "@salinco/nice-utils"

import type { Logger } from "@common/logs"
import type { TaskInfo } from "@common/state"
import { type TaskContext, createContext } from "@node/tasks"

type Loaders<$Data extends AnyRecord, $Pool extends string, $Lock extends string> = {
  [K in keyof $Data & string]: (runner: TaskRunner<$Data, $Pool, $Lock>) => Promise<$Data[K]>
}

export type TaskOptions<
  $Data extends AnyRecord,
  $Pool extends string,
  $Lock extends string,
  $Reads extends Dependencies<$Data, $Lock> = Dependencies<$Data, $Lock>,
  $Writes extends Dependencies<$Data, $Lock> = Dependencies<$Data, $Lock>,
  $Result = unknown,
> = {
  pools?: $Pool[]
  handler: (context: TaskContext, data: Pick<$Data, keyof $Reads & string>) => Promise<$Result>
  invalidate?: boolean
  label?: string
  onProgress?: (context: TaskContext) => void
  reads?: $Reads
  writes?: $Writes
}

type Dependencies<$Data extends AnyRecord, $Lock extends string> = {
  [K in keyof $Data & string]?: $Data[K] extends { [I in infer J extends string]?: object }
    ? true | J[]
    : true
} & {
  [K in $Lock]?: true | string[]
}

type Lock<$Data extends AnyRecord, $Lock extends string> =
  | (keyof $Data & string)
  | {
      [K in keyof $Data & string]: $Data[K] extends { [I in infer J extends string]?: object }
        ? `${K}/${J}`
        : never
    }[keyof $Data & string]
  | $Lock
  | `${$Lock}/${string}`

export type Task<$Data extends AnyRecord, $Pool extends string, $Lock extends string, $Result> = {
  controller?: AbortController
  context?: TaskContext
  handler: (context: TaskContext, data: $Data) => Promise<$Result>
  invalidated: boolean
  key: string
  label?: string
  onError: (error: Error) => void
  onProgress?: (context: TaskContext) => void
  onSuccess: (result: $Result) => void
  pools: $Pool[]
  promise: Promise<$Result>
  reads: Dependencies<$Data, $Lock>
  running: boolean
  writes: Dependencies<$Data, $Lock>
}

export class TaskRunner<$State extends AnyRecord, $Pool extends string, $Lock extends string> {
  protected readonly callback?: (tasks: TaskInfo[]) => void
  protected readonly loaders: Loaders<$State, $Pool, $Lock>
  protected logger?: Logger
  protected readonly pools: { [P in $Pool]: { max: number; tasks: Set<string> } }
  protected readonly reads: { [L in Lock<$State, $Lock>]?: Set<string> }
  protected state: Partial<$State>
  protected readonly tasks: Map<string, Task<$State, $Pool, $Lock, unknown>>
  protected timeout?: NodeJS.Timeout
  protected verbose: boolean
  protected readonly writes: { [L in Lock<$State, $Lock>]?: string }

  public constructor(options: {
    loaders: Loaders<$State, $Pool, $Lock>
    logger?: Logger
    onUpdate?: (tasks: TaskInfo[]) => void
    pools: { [P in $Pool]: number }
    verbose?: boolean
  }) {
    this.callback = options.onUpdate
    this.loaders = options.loaders
    this.logger = options.logger
    this.pools = mapValues(options.pools, max => ({ max, tasks: new Set() })) as typeof this.pools
    this.reads = {}
    this.state = {}
    this.tasks = new Map()
    this.verbose = options.verbose ?? false
    this.writes = {}
  }

  public cancelTask(key: string): void {
    this.logger?.debug(`Cancelling task '${key}`)
    const task = this.tasks.get(key)
    if (task && !task.running) {
      this.tasks.delete(key)
      const error = Error("Cancelled")
      task.onError(error)
    }
  }

  public cancelPendingTasks(): void {
    this.logger?.debug("Cancelling pending tasks")
    for (const task of this.tasks.values()) {
      if (!task.running) {
        this.tasks.delete(task.key)
        const error = Error("Cancelled")
        task.onError(error)
      }
    }
  }

  public getPoolConcurrency(pool: $Pool): number {
    return this.pools[pool]?.tasks.size ?? 0
  }

  public getPoolMaxConcurrency(pool: $Pool): number {
    return this.pools[pool]?.max ?? 0
  }

  public getState(): Partial<$State> {
    return this.state
  }

  public isFull(pool: $Pool): boolean {
    return this.getPoolConcurrency(pool) >= this.getPoolMaxConcurrency(pool)
  }

  public isLoaded(resource: keyof $State & string): boolean {
    return resource in this.state
  }

  public isLocked(lock: Lock<$State, $Lock>, forWriting: boolean): boolean {
    return !!this.writes[lock] || (forWriting && !!this.reads[lock]?.size)
  }

  public async load<$Resource extends keyof $State & string>(
    resource: $Resource,
  ): Promise<$State[$Resource]> {
    if (!this.state[resource]) {
      this.state[resource] = await this.loaders[resource](this)
      this.tryRunTasks()
    }

    return this.state[resource] as $State[$Resource]
  }

  public async loadAll(): Promise<$State> {
    await Promise.all(keys(this.loaders).map(resource => this.load(resource)))
    return this.state as $State
  }

  public async queue<
    $Result,
    $Reads extends Dependencies<$State, $Lock>,
    $Writes extends Dependencies<$State, $Lock>,
  >(
    key: string,
    options: TaskOptions<$State, $Pool, $Lock, $Reads, $Writes, $Result>,
  ): Promise<$Result> {
    let task = this.tasks.get(key) as Task<$State, $Pool, $Lock, $Result> | undefined

    // If the invalidated task is already running, we will let it finish but discard the result and run again immediately
    if (task && options.invalidate) {
      task.handler = options.handler
      task.label = options.label
      task.onProgress = options.onProgress
      task.pools = options.pools ?? []
      task.reads = options.reads ?? {}
      task.writes = options.writes ?? {}

      if (task.running) {
        task.invalidated = true
        task.controller?.abort()
      }
    }

    // Create the task
    if (!task) {
      let onError!: (error: Error) => void
      let onSuccess!: (value: $Result) => void

      const promise = new Promise<$Result>((resolve, reject) => {
        onError = reject
        onSuccess = resolve
      })

      task = {
        handler: options.handler,
        invalidated: false,
        key,
        label: options.label,
        onError,
        onProgress: options.onProgress,
        onSuccess,
        pools: options.pools ?? [],
        promise,
        reads: options.reads ?? {},
        running: false,
        writes: options.writes ?? {},
      }

      // Start loading dependencies
      for (const key in task.reads) {
        if (task.reads[key] && this.loaders[key]) {
          this.load(key)
        }
      }

      this.tasks.set(key, task as Task<$State, $Pool, $Lock, unknown>)
    }

    // Run the task immediately if it is runnable
    this.tryRun(task)

    return task.promise
  }

  public reload(resources: Array<keyof $State & string>): void {
    for (const resource of resources) {
      this.logger?.debug(`Reloading ${resource}...`)
      delete this.state[resource]
    }
  }

  public reloadAll(): void {
    this.logger?.debug("Reloading...")
    this.state = {}
  }

  protected logDependencyNotLoaded(key: string, resource: string): void {
    if (this.verbose) {
      this.logger?.debug(`Deferring task '${key}' because dependency '${resource}' is not loaded`, {
        resources: mapValues(this.state, value => typeof value),
      })
    }
  }

  protected logPoolFull(key: string, pool: $Pool): void {
    if (this.verbose) {
      this.logger?.debug(`Deferring task '${key}' because pool '${pool}' is full`, {
        ...this.pools[pool],
        tasks: toArray(this.pools[pool].tasks),
      })
    }
  }

  protected logResourceLocked(key: string, resource: string, forWriting: boolean): void {
    if (this.verbose) {
      this.logger?.debug(
        `Deferring task '${key}' because resource '${resource}' is locked for ${forWriting ? "writing" : "reading"}`,
        { reads: mapValues(this.reads, toArray), writes: this.writes },
      )
    }
  }

  protected onUpdate(): void {
    this.callback?.(
      toArray(this.tasks.values())
        .map(task => task.context)
        .filter(context => !!context)
        .map(context => ({ key: context.key, label: context.label, progress: context.progress })),
    )
  }

  protected async tryRun<$Result>(task: Task<$State, $Pool, $Lock, $Result>): Promise<void> {
    // 1. Check if task is runnable
    if (task.running) {
      return
    }

    // Grab references - these must stay stable if task is invalidated
    const { key, onProgress, pools, reads, writes } = task

    // Cannot run if any pool is full
    for (const pool of pools) {
      if (this.isFull(pool)) {
        this.logPoolFull(key, pool)
        return
      }
    }

    // Cannot run if any resource is locked for writing
    for (const resource in writes) {
      if (this.isLocked(resource, true)) {
        this.logResourceLocked(key, resource, true)
        return
      }

      if (Array.isArray(writes[resource])) {
        for (const id of writes[resource]) {
          if (this.isLocked(`${resource}/${id}`, true)) {
            this.logResourceLocked(key, `${resource}/${id}`, true)
            return
          }
        }
      }
    }

    // Cannot run if any resource is locked for reading or is not yet loaded
    for (const resource in reads) {
      if (this.loaders[resource]) {
        if (!this.isLoaded(resource)) {
          this.logDependencyNotLoaded(key, resource)
          return
        }
      }

      if (this.isLocked(resource, false)) {
        this.logResourceLocked(key, resource, false)
        return
      }

      if (Array.isArray(reads[resource])) {
        for (const id of reads[resource]) {
          if (this.isLocked(`${resource}/${id}`, false)) {
            this.logResourceLocked(key, `${resource}/${id}`, false)
            return
          }
        }
      }
    }

    // 2. From this point, task is guaranteed to run - gather dependencies and lock resources
    // Lock pools
    for (const pool of pools) {
      this.pools[pool].tasks.add(key)
    }

    // Lock resources for writing
    for (const resource in writes) {
      if (Array.isArray(writes[resource])) {
        for (const id of writes[resource]) {
          const lock = `${resource}/${id}` as Lock<$State, $Lock>
          this.writes[lock] = key
        }
      } else {
        const lock = resource as Lock<$State, $Lock>
        this.writes[lock] = key
      }
    }

    // Lock resources for reading
    for (const resource in reads) {
      if (Array.isArray(reads[resource])) {
        for (const id of reads[resource]) {
          const lock = `${resource}/${id}` as Lock<$State, $Lock>
          this.reads[lock] ??= new Set()
          this.reads[lock].add(key)
        }
      } else {
        const lock = resource as Lock<$State, $Lock>
        this.reads[lock] ??= new Set()
        this.reads[lock].add(key)
      }
    }

    // 3. Run task
    const controller = new AbortController()
    const context = createContext(key, {
      label: task.label,
      logger: this.logger,
      onProgress: context => {
        onProgress?.(context)
        this.onUpdate()
      },
      signal: controller.signal,
    })

    const startTimeMs = Date.now()
    task.context = context
    task.controller = controller
    task.running = true
    this.onUpdate()

    if (task.label) {
      context.info(task.label)
    } else if (this.verbose) {
      context.debug("Running...")
    }

    if (this.verbose) {
      this.logger?.debug(
        `Concurrency ${toArray(this.tasks.values())
          .filter(task => task.running)
          .map(task => `[${task.key}]`)
          .join(" ")}`,
      )
    }

    const result = await secure(task.handler(context, this.state as $State))

    const endTimeMs = Date.now()
    task.context = undefined
    task.controller = undefined
    task.running = false
    this.onUpdate()

    if (task.invalidated) {
      if (result.error) {
        context.warn("Failed (invalidated)", result.error)
      }
    } else if (result.error) {
      context.error("Failed", result.error)

      // Call error callbacks
      task.onError(result.error)
    } else {
      if (this.verbose) {
        context.debug(`Done in ${endTimeMs - startTimeMs}ms`)
      }

      // Call success callbacks
      task.onSuccess(result.data)
    }

    // 4. Cleanup task and unlock resources
    // Unlock pools
    for (const pool of pools) {
      this.pools[pool].tasks.delete(key)
    }

    // Unlock resources for writing
    for (const resource in writes) {
      if (Array.isArray(writes[resource])) {
        for (const id of writes[resource]) {
          const lock = `${resource}/${id}` as Lock<$State, $Lock>
          delete this.writes[lock]
        }
      } else {
        const lock = resource as Lock<$State, $Lock>
        delete this.writes[lock]
      }
    }

    // Unlock resources for reading
    for (const resource in reads) {
      if (Array.isArray(reads[resource])) {
        for (const id of reads[resource]) {
          const lock = `${resource}/${id}` as Lock<$State, $Lock>
          this.reads[lock]?.delete(key)
          if (this.reads[lock]?.size === 0) {
            delete this.reads[lock]
          }
        }
      } else {
        const lock = resource as Lock<$State, $Lock>
        this.reads[lock]?.delete(key)
        if (this.reads[lock]?.size === 0) {
          delete this.reads[lock]
        }
      }
    }

    // Remove task
    if (task.invalidated) {
      task.invalidated = false
    } else {
      this.tasks.delete(key)
    }

    // 5. Find more tasks to run
    this.tryRunTasks()
  }

  protected tryRunTasks(): void {
    this.timeout ??= setTimeout(() => {
      this.timeout = undefined
      for (const task of this.tasks.values()) {
        this.tryRun(task)
      }
    })
  }
}

function secure<T, E = Error>(
  promise: Promise<T>,
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: E }> {
  return promise.then(
    data => ({ data }),
    error => ({ error }),
  )
}
