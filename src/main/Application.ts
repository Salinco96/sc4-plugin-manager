import { app, ipcMain } from "electron/main"
import fs from "fs/promises"
import path from "path"

import { ApplicationState, initialState } from "@common/state"
import { AssetInfo, CollectionInfo, PackageInfo, ProfileInfo, Settings } from "@common/types"

import childProcessPath from "./child?modulePath"
import { loadCollections } from "./data/collections"
import { DownloadManager } from "./data/DownloadManager"
import { loadLocalPackages, loadRemotePackages } from "./data/packages"
import { loadProfiles, writeProfile } from "./data/profiles"
import { loadSettings, writeSettings } from "./data/settings"
import { MainWindow } from "./MainWindow"
import { createChildProcess } from "./process"
import {
  getCollectionsPath,
  getDownloadsPath,
  getPackagesPath,
  getProfilesPath,
} from "./utils/paths"

export class Application {
  public downloadManager: DownloadManager
  public state: ApplicationState = initialState

  protected collections?: Promise<CollectionInfo[]>

  protected profiles?: Promise<{
    [id: string]: ProfileInfo
  }>

  protected localPackages?: Promise<{
    [id: string]: PackageInfo
  }>

  protected remotePackages?: Promise<{
    assets: { [id: string]: AssetInfo }
    packages: { [id: string]: PackageInfo }
  }>

  protected settings?: Promise<Settings>

  protected databaseUpdatePromise?: Promise<boolean>

  public mainWindow?: MainWindow

  public constructor() {
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

  protected onReady(): void {
    this.initialize().then(() => this.preload())

    this.handle("getCollections")
    this.handle("getProfiles")
    this.handle("getLocalPackages")
    this.handle("getRemotePackages")
    this.handle("getSettings")
    this.handle("installFiles")
    this.handle("writeProfile")
    this.handle("writeSettings")

    this.createMainWindow()

    app.on("activate", () => this.createMainWindow())
  }

  protected async initialize(): Promise<void> {
    await fs.mkdir(getCollectionsPath(), { recursive: true })
    await fs.mkdir(getDownloadsPath(), { recursive: true })
    await fs.mkdir(getPackagesPath(), { recursive: true })
    await fs.mkdir(getProfilesPath(), { recursive: true })
    await this.downloadManager.initialize()
  }

  protected async tryUpdateDatabase(force?: boolean): Promise<boolean> {
    if (!this.databaseUpdatePromise || force) {
      this.databaseUpdatePromise = new Promise(resolve => {
        console.log("Updating database...")
        createChildProcess<unknown, { success?: boolean; error?: Error }>(childProcessPath, {
          onClose() {
            console.log("Failed updating database:", "closed")
            resolve(false)
          },
          onMessage({ success, error }) {
            if (success) {
              console.log("Updated database")
              resolve(true)
            } else {
              console.log("Failed updating database:", error)
              resolve(false)
            }
          },
        })
      })
    }

    return this.databaseUpdatePromise
  }

  public async getCollections(): Promise<CollectionInfo[]> {
    this.collections ||= loadCollections()
    return this.collections
  }

  public async getProfiles(): Promise<{ [id: string]: ProfileInfo }> {
    this.profiles ||= loadProfiles()
    return this.profiles
  }

  public async getLocalPackages(): Promise<{
    [id: string]: PackageInfo
  }> {
    this.localPackages ||= loadLocalPackages()
    return this.localPackages
  }

  public async getRemotePackages(): Promise<{
    assets: { [id: string]: AssetInfo }
    packages: { [id: string]: PackageInfo }
  }> {
    await this.tryUpdateDatabase()
    this.remotePackages ||= loadRemotePackages()
    return this.remotePackages
  }

  public async getSettings(): Promise<Settings> {
    this.settings ||= loadSettings()
    return this.settings.then(settings => {
      console.log(settings)
      return settings
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
    console.log("Saving profile...")
    await writeProfile(profile)
  }

  public async writeSettings(settings: Settings): Promise<void> {
    console.log("Saving settings...")
    await writeSettings(settings)
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
    console.log("updateState", update)
    Object.assign(this.state, update)
    this.mainWindow?.webContents.postMessage("updateState", update)
  }

  protected async preload(): Promise<void> {
    await Promise.all([
      this.getCollections(),
      this.getProfiles(),
      this.getLocalPackages(),
      this.getRemotePackages(),
      this.getSettings(),
    ])
  }
}
