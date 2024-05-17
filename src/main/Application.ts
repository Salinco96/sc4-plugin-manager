import { app, ipcMain } from "electron/main"
import fs from "fs/promises"
import path from "path"

import { ApplicationData, ApplicationState, initialState } from "@common/state"
import { ProfileInfo, Settings } from "@common/types"

import { DataManager } from "./data/DataManager"
import { DownloadManager } from "./data/DownloadManager"
import { MainWindow } from "./MainWindow"
import { getDownloadsPath, getPackagesPath } from "./utils/paths"

export class Application {
  public dataManager: DataManager
  public downloadManager: DownloadManager
  public mainWindow?: MainWindow
  public state: ApplicationState = initialState

  public constructor() {
    this.dataManager = new DataManager()

    this.downloadManager = new DownloadManager({
      downloadsPath: getDownloadsPath(),
      maxParallelDownloads: 6,
      onProgressUpdate: () => {
        this.updateState({
          ongoingDownloads: this.downloadManager.ongoingDownloads.map(download => download.key),
        })
      },
    })

    app.whenReady().then(() => this.onReady())

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit()
      }
    })
  }

  public async getState(): Promise<ApplicationState> {
    return this.state
  }

  protected onReady(): void {
    this.dataManager.load(this.onLoadProgress.bind(this))
    this.downloadManager.initialize()

    this.handle("getState")
    this.handle("installFiles")
    this.handle("writeProfile")
    this.handle("writeSettings")

    this.createMainWindow()

    app.on("activate", () => this.createMainWindow())
  }

  protected onLoadProgress(newData: Partial<ApplicationData>, status: string | null): void {
    this.updateState({
      data: Object.assign(this.state.data, newData),
      loadStatus: status,
    })
  }

  public async installFiles(
    assets: {
      id: string
      packages: {
        packageId: string
        variantId: string
      }[]
      url: string
      version: string
    }[],
  ): Promise<void> {
    for (const asset of assets) {
      const key = `${asset.id}@${asset.version}`
      const result = await this.downloadManager.download(key, asset.url)

      if (result.success) {
        for (const link of asset.packages) {
          console.debug(`Linking ${link.packageId}#${link.variantId}`)
          const linkPath = path.join(getPackagesPath(), link.packageId, link.variantId)
          await fs.mkdir(path.dirname(linkPath), { recursive: true })
          try {
            await fs.rm(linkPath, { recursive: true })
          } catch (error) {
            if (!(error as Error).message.match(/no such file/i)) {
              throw error
            }
          }
          await fs.symlink(result.path, linkPath, "dir")
          await fs.writeFile(
            path.join(getPackagesPath(), link.packageId, "package.json"),
            JSON.stringify(
              {
                version: asset.version,
              },
              undefined,
              2,
            ),
          )
        }
      }
    }
  }

  public async writeProfile(profile: ProfileInfo): Promise<void> {
    await this.dataManager.writeProfile(profile)
  }

  public async writeSettings(settings: Settings): Promise<void> {
    await this.dataManager.writeSettings(settings)
  }

  protected createMainWindow(): MainWindow {
    if (!this.mainWindow) {
      this.mainWindow = new MainWindow()
      this.mainWindow.on("close", () => {
        this.mainWindow = undefined
      })
    }

    return this.mainWindow
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected handle<Event extends keyof this & string, Args extends any[]>(
    this: { [key in Event]: (...args: Args) => Promise<unknown> },
    event: Event,
  ): void {
    ipcMain.handle(event, (_, ...args: Args) => this[event](...args))
  }

  protected updateState(update: Partial<ApplicationState>): void {
    Object.assign(this.state, update)
    this.mainWindow?.webContents.postMessage("updateState", update)
  }
}
