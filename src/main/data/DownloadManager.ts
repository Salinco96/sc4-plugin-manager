import { createWriteStream } from "fs"
import fs from "fs/promises"
import path from "path"
import { Readable } from "stream"
import { finished } from "stream/promises"
import { ReadableStream } from "stream/web"

import { Extract as zipExtract } from "unzipper"

export interface OngoingDownload {
  key: string
  promise: Promise<void>
  url: string
}

export interface PendingDownload {
  key: string
  resolve(result: DownloadResult): void
  url: string
}

export interface DownloadResult {
  error?: Error
  path: string
  success: boolean
}

export interface DownloadManagerOptions {
  downloadsPath: string
  maxParallelDownloads: number
  onProgressUpdate: () => void
}

export class DownloadManager {
  public readonly downloads: { [key: string]: Promise<DownloadResult> | true } = {}
  public readonly downloadsPath: string
  public readonly maxParallelDownloads: number
  public readonly onProgressUpdate: () => void
  public readonly ongoingDownloads: OngoingDownload[] = []
  public readonly pendingDownloads: PendingDownload[] = []

  protected initialized: Promise<void> | boolean = false

  public constructor(options: DownloadManagerOptions) {
    this.downloadsPath = options.downloadsPath
    this.maxParallelDownloads = options.maxParallelDownloads
    this.onProgressUpdate = options.onProgressUpdate
  }

  public async initialize(): Promise<void> {
    this.initialized ||= this.doInitialize().catch(error => {
      console.error(`[DownloadManager] Initializing`, error)
    })

    await this.initialized
  }

  public async download(key: string, url: string, ignoreQueue?: boolean): Promise<DownloadResult> {
    await this.initialize()

    const status = this.downloads[key]

    if (status === true) {
      return {
        path: this.getDownloadPath(key),
        success: true,
      }
    }

    if (status) {
      return status
    }

    let promise: Promise<DownloadResult>

    if (ignoreQueue || this.ongoingDownloads.length < this.maxParallelDownloads) {
      // Start immediately
      promise = this.startDownload(key, url)
    } else {
      // Push to end of queue
      promise = new Promise(resolve => this.pendingDownloads.push({ key, resolve, url }))
    }

    this.downloads[key] = promise
    this.onProgressUpdate()
    return promise
  }

  public getDownloadPath(key: string): string {
    return path.join(this.downloadsPath, key)
  }

  public hasOngoingDownloads(): boolean {
    return this.ongoingDownloads.length !== 0
  }

  public hasPendingDownloads(): boolean {
    return this.pendingDownloads.length !== 0
  }

  public isDownloaded(key: string): boolean {
    return this.downloads[key] === true
  }

  public isDownloading(key: string): boolean {
    return this.downloads[key] instanceof Promise
  }

  protected checkQueue(): void {
    if (this.ongoingDownloads.length < this.maxParallelDownloads) {
      const pending = this.pendingDownloads.shift()
      if (pending) {
        this.startDownload(pending.key, pending.url).then(pending.resolve)
      }
    }
  }

  protected async startDownload(key: string, url: string): Promise<DownloadResult> {
    const promise = this.doDownload(key, url)
    const download = { key, promise, url }

    this.ongoingDownloads.push(download)

    try {
      await promise
      this.downloads[key] = true
      return {
        path: this.getDownloadPath(key),
        success: true,
      }
    } catch (error) {
      console.error(`[DownloadManager] Downloading ${key}`, error)
      delete this.downloads[key]
      return {
        error: error instanceof Error ? error : Error(),
        path: this.getDownloadPath(key),
        success: false,
      }
    } finally {
      // No longer downloading
      const index = this.ongoingDownloads.indexOf(download)
      if (index >= 0) {
        this.ongoingDownloads.splice(index, 1)
      }

      // Start next queued download
      this.checkQueue()
      this.onProgressUpdate()
    }
  }

  protected async doDownload(key: string, url: string): Promise<void> {
    console.debug(`[DownloadManager] Downloading ${key} from ${url}`)

    const response = await fetch(url)

    if (response.status !== 200) {
      throw Error(`Unexpected response code: ${response.status}`)
    }

    if (!response.body) {
      throw Error("Failed to fetch")
    }

    const downloadPath = this.getDownloadPath(key)

    const disposition = response.headers.get("Content-Disposition")
    let filename = disposition?.match(/filename="(.+)"/)?.[1]
    if (!filename) {
      const contentType = response.headers.get("Content-Type")
      if (contentType?.match(/^application\/(x-)?zip$/)) {
        filename = downloadPath + ".zip"
      } else {
        throw Error(`Unexpected response format: ${disposition}`)
      }
    }

    const stream = Readable.fromWeb(response.body as ReadableStream)

    if (filename.endsWith(".zip")) {
      try {
        await finished(stream.pipe(zipExtract({ path: downloadPath })))
      } catch (error) {
        if (!(error as Error).message.match(/premature close/i)) {
          throw error
        }
      }
    } else {
      await fs.mkdir(downloadPath, { recursive: true })
      await finished(stream.pipe(createWriteStream(path.join(downloadPath, filename))))
    }

    console.debug(`[DownloadManager] Downloaded ${key}`)
  }

  public async doInitialize(): Promise<void> {
    console.debug(`[DownloadManager] Initializing...`)

    let nDownloads = 0
    // Read downloaded assets
    const entries = await fs.readdir(this.downloadsPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        this.downloads[entry.name] = true
        nDownloads++
      }
    }

    console.debug(`[DownloadManager] Initialized - found ${nDownloads} assets`)
  }
}
