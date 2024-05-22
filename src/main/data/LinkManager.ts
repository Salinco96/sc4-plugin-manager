import fs from "fs/promises"
import path from "path"

export interface LinkManagerOptions {
  pluginsPath: string
}

export class LinkManager {
  public readonly pluginsPath: string

  protected initialized: Promise<void> | boolean = false
  protected links: { [from: string]: string } = {}

  protected currentTask?: Promise<void>
  protected queuedTasks: Array<() => void> = []

  public constructor(options: LinkManagerOptions) {
    this.pluginsPath = options.pluginsPath
  }

  public async initialize(): Promise<void> {
    this.initialized ||= this.doInitialize().catch(error => {
      console.error(`[${this.constructor.name}] Initializing`, error)
    })

    await this.initialized
  }

  public async link(links: { [from: string]: string }): Promise<void> {
    console.debug(`[${this.constructor.name}] Linking...`)

    let nLinks = 0

    await this.initialize()

    for (const from in this.links) {
      if (links[from] !== this.links[from]) {
        await fs.rm(from, { recursive: true })
        if (links[from]) {
          await fs.symlink(from, links[from])
        }
      }
    }

    for (const from in links) {
      if (!this.links[from]) {
        await fs.symlink(from, links[from])
        nLinks++
      }
    }

    this.links = links

    console.debug(`[${this.constructor.name}] Linked ${nLinks} files`)
  }

  public async doInitialize(): Promise<void> {
    console.debug(`[${this.constructor.name}] Initializing...`)

    let nLinks = 0

    const recursive = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name)
        if (entry.isSymbolicLink()) {
          this.links[entryPath] = await fs.readlink(entryPath)
          nLinks++
        } else if (entry.isDirectory()) {
          await recursive(entryPath)
        }
      }
    }

    // Recursively find symlinks
    await recursive(this.pluginsPath)

    console.debug(`[${this.constructor.name}] Initialized - found ${nLinks} links`)
  }
}
