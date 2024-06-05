import { exec as cmd, exec } from "child_process"
import {
  MessageBoxOptions,
  MessageBoxReturnValue,
  Session,
  app,
  dialog,
  ipcMain,
  net,
  protocol,
  session,
} from "electron/main"
import { existsSync, readFileSync, writeFileSync } from "fs"
import fs, { FileHandle } from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"

import log, { LogLevel } from "electron-log"
import escapeHtml from "escape-html"
import { glob } from "glob"

import { CategoryID, formatCategory } from "@common/categories"
import { ProfileExternals, ProfileUpdate, createUniqueProfileId } from "@common/profiles"
import { ApplicationState, ApplicationStatus } from "@common/state"
import {
  AssetInfo,
  ConfigFormat,
  EXTERNAL_PACKAGE_ID,
  PackageCondition,
  PackageConfig,
  PackageInfo,
  PackageStatus,
  ProfileInfo,
  Settings,
  VariantInfo,
  getDefaultVariant,
} from "@common/types"
import { removeElement } from "@common/utils/arrays"
import { assert, pick } from "@common/utils/types"
import {
  SimtropolisSession,
  getSimtropolisSession,
  simtropolisLogin,
  simtropolisLogout,
} from "@utils/sessions/simtropolis"

import {
  calculatePackageCompatibility,
  checkoutPackages,
  isVariantCompatible,
  loadLocalPackages,
  loadRemotePackages,
  mergeLocalPackageInfo,
  writePackageConfig,
} from "./data/packages"
import { MainWindow } from "./MainWindow"
import {
  UpdateDatabaseProcessData,
  UpdateDatabaseProcessResponse,
} from "./processes/updateDatabase/types"
import updateDatabaseProcessPath from "./processes/updateDatabase?modulePath"
import { SplashScreen } from "./SplashScreen"
import { loadConfig, readConfig, writeConfig } from "./utils/configs"
import {
  DIRNAMES,
  DOCEXTENSIONS,
  FILENAMES,
  SC4EXTENSIONS,
  SC4INSTALLPATHS,
} from "./utils/constants"
import { download, extract } from "./utils/download"
import { env, isDev, isURL } from "./utils/env"
import { createIfMissing, exists, removeIfEmpty, removeIfPresent } from "./utils/files"
import { createChildProcess } from "./utils/processes"
import { TaskManager } from "./utils/tasks"

const defaultSettings: Settings = {
  useYaml: true,
}

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

export interface Task<T = void> {
  current?: Promise<T>
  queued?: () => T
}

export class Application {
  public assets?: { [assetId: string]: AssetInfo }
  public packages?: { [packageId: string]: PackageInfo }
  public profiles?: { [profileId: string]: ProfileInfo }
  public sessions: { simtropolis?: SimtropolisSession | null } = {}
  public settings?: Settings
  public status: ApplicationStatus = {
    linker: null,
    loader: null,
    ongoingDownloads: [],
    ongoingExtracts: [],
  }

  public updateFields: (keyof ApplicationState)[] = []

  public mainWindow?: MainWindow
  public splashScreen?: SplashScreen

  public readonly browserSession: Session = session.defaultSession

  public readonly gamePath: string
  public readonly rootPath: string

  public readonly links: { [from: string]: string } = {}

  public readonly tasks: {
    readonly download: TaskManager
    readonly extract: TaskManager
    readonly getAsset: TaskManager
    readonly install: TaskManager
    readonly linker: TaskManager
    readonly loader: TaskManager
    readonly writeProfiles: Task
    readonly writeSettings: Task
  } = {
    download: new TaskManager(6, this.onDownloadTaskUpdate.bind(this)),
    extract: new TaskManager(3, this.onExtractTaskUpdate.bind(this)),
    getAsset: new TaskManager(6),
    install: new TaskManager(6),
    linker: new TaskManager(1, this.onLinkTaskUpdate.bind(this)),
    loader: new TaskManager(1, this.onLinkTaskUpdate.bind(this)),
    writeProfiles: {},
    writeSettings: {},
  }

  protected databaseUpdatePromise?: Promise<boolean>

  public constructor() {
    this.gamePath = this.loadGamePath()
    this.rootPath = path.join(this.gamePath, "Manager")

    this.initialize()

    getSimtropolisSession(this.browserSession).then(session => {
      if (session) {
        console.info("Logged in to Simtropolis")
        this.sessions.simtropolis = session
        this.sendStateUpdates("sessions")
      } else {
        this.sessions.simtropolis = null
      }
    })

    // Custom protocol to load package docs in sandboxed iframe
    protocol.handle("docs", req => {
      const { pathname } = new URL(req.url)
      const fullPath = path.resolve(path.join(this.rootPath, decodeURI(pathname)))
      const relativePath = path.relative(this.rootPath, fullPath)

      // Only allow files under rootPath
      if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
        return new Response("bad", { status: 400 })
      }

      // Only allow specific extensions (html, css, images)
      if (!DOCEXTENSIONS.includes(path.extname(fullPath))) {
        return new Response("bad", { status: 400 })
      }

      return net.fetch(pathToFileURL(fullPath).toString())
    })

    // Register message handlers
    this.handle("check4GBPatch")
    this.handle("createProfile")
    this.handle("editProfile")
    this.handle("getPackageDocsAsHtml")
    this.handle("getState")
    this.handle("installPackages")
    this.handle("openExecutableDirectory")
    this.handle("openInstallationDirectory")
    this.handle("openPackageFileInExplorer")
    this.handle("openProfileConfig")
    this.handle("removePackages")
    this.handle("setPackageVariant")
    this.handle("simtropolisLogin")
    this.handle("simtropolisLogout")
    this.handle("switchProfile")
    this.handle("updatePackages")

    // Create main window
    this.createMainWindow()
  }

  public async openExecutableDirectory(): Promise<void> {
    if (this.settings?.install?.path) {
      this.openInExplorer(path.dirname(path.join(this.settings.install.path, FILENAMES.sc4exe)))
    }
  }

  public async openInstallationDirectory(): Promise<void> {
    if (this.settings?.install?.path) {
      this.openInExplorer(this.settings.install.path)
    }
  }

  public async openProfileConfig(profileId: string): Promise<void> {
    const profileInfo = this.getProfileInfo(profileId)
    if (profileInfo?.format) {
      this.openInExplorer(path.join(this.getProfilesPath(), profileId + profileInfo.format))
    }
  }

  protected async checkGameInstall(): Promise<void> {
    let installPath = this.settings?.install?.path
    let installPathExists = false

    if (installPath) {
      installPathExists = await exists(path.join(installPath, FILENAMES.sc4exe))
    } else {
      for (const suggestedPath of SC4INSTALLPATHS) {
        if (await exists(path.join(suggestedPath, FILENAMES.sc4exe))) {
          console.debug(`Auto-detected installation path ${suggestedPath}`)
          installPath = suggestedPath
          installPathExists = true
          break
        }
      }
    }

    while (!installPathExists) {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        title: "Select your SimCity 4 installation folder (containing SimCity_1.dat)",
        defaultPath: installPath,
        properties: ["openDirectory"],
      })

      if (result.filePaths.length) {
        installPath = result.filePaths[0]
        installPathExists = await exists(path.join(installPath, FILENAMES.sc4exe))
      } else {
        installPath = undefined
        break
      }
    }

    if (this.settings && installPath !== this.settings.install?.path) {
      this.settings.install = { path: installPath }
      this.sendStateUpdates("settings")
      await this.writeSettings()
    }

    if (installPath) {
      await this.check4GBPatch(true)
      await this.checkExeVersion()
    }
  }

  public async checkExeVersion(): Promise<void> {
    if (this.settings?.install?.path) {
      const exePath = path.join(this.settings.install.path, FILENAMES.sc4exe)

      return new Promise((resolve, reject) => {
        exec(
          `wmic datafile where "name='${exePath.replace(/[\\'"]/g, "\\$&")}'" get version`,
          (error, stdout, stderr) => {
            if (error) {
              return reject(error)
            }

            const match = stdout.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/)
            if (!match) {
              return reject(Error(stderr))
            }

            const version = match[0]
            if (this.settings?.install && this.settings.install.version !== version) {
              console.info(`Detected version ${version}`)
              this.settings.install.version = version
              this.sendStateUpdates("settings")
              this.writeSettings()
            }

            return resolve()
          },
        )
      })
    }
  }

  public async check4GBPatch(isStartupCheck?: boolean): Promise<void> {
    let file: FileHandle | undefined

    try {
      console.info("Checking 4GB Patch...")
      if (this.settings?.install?.path) {
        const filePath = path.join(this.settings.install.path, FILENAMES.sc4exe)
        file = await fs.open(filePath, "r+") // read-write mode
        const stat = await file.stat()

        // Read MZ header
        const mzHeader = Buffer.alloc(0x40)
        assert(stat.size >= mzHeader.length, "Invalid file length")
        await file.read(mzHeader, 0x00, mzHeader.length, 0x00)
        assert(mzHeader.readUInt16LE(0x00) === 0x5a4d, "Invalid MZ header signature")
        const peHeaderOffset = mzHeader.readInt32LE(0x3c)

        // Read PE header
        const peHeader = Buffer.alloc(0x18)
        assert(stat.size >= peHeaderOffset + peHeader.length, "Invalid file length")
        await file.read(peHeader, 0x00, peHeader.length, peHeaderOffset)
        assert(peHeader.readUInt32LE(0x00) === 0x00004550, "Invalid PE header signature")
        const flags = peHeader.readUInt16LE(0x16)
        const largeAddressAwareFlag = 0x0020

        const patched = (flags & largeAddressAwareFlag) !== 0
        if (patched) {
          console.info("4GB Patch is already applied")
          if (!this.settings.install.patched) {
            this.settings.install.patched = true
            this.sendStateUpdates("settings")
            await this.writeSettings()
          }
        } else if (isStartupCheck && this.settings.install.patched === false) {
          // Skip startup check if "Do not ask again" was previously checked
        } else {
          delete this.settings.install.patched

          // TODO: Handle main window not present
          const [confirmed, doNotAskAgain] = await this.showConfirmation(
            "4GB Patch",
            "Do you want to apply the 4GB Patch?",
            "The 4GB Patch is a one-time patch that turns on the Large-Address-Aware flag in the 'SimCity 4.exe' executable, increasing its virtual memory (RAM) usage cap from 2GB to 4GB. This allows the game to make better use of modern hardware and is necessary to run resource-intensive mods, such as the Network Addon Mod's improved pathfinding.\n\nA backup will be automatically created next to the original file.\n\nSystem Requirements: 8GB of RAM",
            isStartupCheck,
          )

          if (confirmed) {
            try {
              // Create a backup
              await fs.cp(filePath, filePath.replace(".exe", " (Backup).exe"))

              // Rewrite PE header
              const newFlags = flags | largeAddressAwareFlag
              peHeader.writeUInt16LE(newFlags, 0x16)
              await file.write(peHeader, 0x00, peHeader.length, peHeaderOffset)
              await this.showSuccess("4GB Patch", "The 4GB Patch was applied successfully!")
              this.settings.install.patched = true
            } catch (error) {
              const { message } = error as Error
              console.error("Failed to apply the 4GB Patch", error)
              await this.showError("4GB Patch", "Failed to apply the 4GB Patch.", message)
            }
          } else if (doNotAskAgain) {
            this.settings.install.patched = false
          }

          this.sendStateUpdates("settings")
          await this.writeSettings()
        }
      }
    } catch (error) {
      console.error("Failed to check for 4GB Patch", error)
    } finally {
      await file?.close()
    }
  }

  protected async showConfirmation(
    title: string,
    message: string,
    detail?: string,
    doNotAskAgain?: boolean,
  ): Promise<[confirmed: boolean, doNotAskAgain: boolean]> {
    const options: MessageBoxOptions = {
      buttons: ["Yes", "No"],
      cancelId: 1,
      checkboxChecked: false,
      checkboxLabel: doNotAskAgain ? "Do not ask again" : undefined,
      defaultId: 0,
      detail,
      message,
      title,
      type: "question",
    }

    let result: MessageBoxReturnValue

    if (this.mainWindow) {
      result = await dialog.showMessageBox(this.mainWindow, options)
    } else {
      result = await dialog.showMessageBox(options)
    }

    return [result.response === 0, result.checkboxChecked]
  }

  protected async showError(title: string, message: string, detail?: string): Promise<void> {
    const options: MessageBoxOptions = { detail, message, title, type: "error" }
    if (this.mainWindow) {
      await dialog.showMessageBox(this.mainWindow, options)
    } else {
      await dialog.showMessageBox(options)
    }
  }

  protected async showSuccess(title: string, message: string, detail?: string): Promise<void> {
    const options: MessageBoxOptions = { detail, message, title, type: "info" }
    if (this.mainWindow) {
      await dialog.showMessageBox(this.mainWindow, options)
    } else {
      await dialog.showMessageBox(options)
    }
  }

  protected loadGamePath(): string {
    const configPath = path.join(app.getPath("userData"), "config.json")

    let config: { path?: string } | undefined

    try {
      config = JSON.parse(readFileSync(configPath, "utf8"))
    } catch (error) {
      if (!(error instanceof Error) || !error.message.match(/no such file or directory/i)) {
        console.error("Failed to load config", error)
      }
    }

    let gamePath = env.GAME_DIR || config?.path || path.join(app.getPath("documents"), "SimCity 4")

    while (!existsSync(path.join(gamePath, DIRNAMES.plugins))) {
      const result = dialog.showOpenDialogSync({
        title: "Select your SimCity 4 data folder (containing your Plugins folder)",
        defaultPath: app.getPath("documents"),
        properties: ["openDirectory"],
      })

      if (result?.length === 1) {
        gamePath = result[0]
      } else {
        throw Error("Aborted")
      }
    }

    if (gamePath !== config?.path) {
      writeFileSync(configPath, JSON.stringify({ path: gamePath }, undefined, 2))
    }

    return gamePath
  }

  public async getPackageDocsAsHtml(packageId: string, variantId: string): Promise<string> {
    const packageInfo = this.getPackageInfo(packageId)
    if (!packageInfo) {
      throw Error(`Unknown package '${packageId}'`)
    }

    const variantInfo = packageInfo.variants[variantId]
    if (!packageInfo) {
      throw Error(`Unknown variant '${packageId}#${variantId}'`)
    }

    if (!variantInfo.docs?.path) {
      throw Error(`Package '${packageId}#${variantId}' does not have documentation`)
    }

    const docPath = path.join(this.getPackageDocsPath(packageId), variantInfo.docs.path)
    const docExt = path.extname(docPath)

    switch (docExt) {
      case ".htm":
      case ".html": {
        const src = await fs.realpath(docPath)
        const pathname = path.relative(this.rootPath, src).replaceAll("\\", "/")
        return `<iframe height="100%" width="100%" sandbox="allow-popups" src="docs://sc4-plugin-manager/${pathname}" title="Documentation"></iframe>`
      }

      // TODO: Markdown viewer? It is at least readable enough for now
      case ".md":
      case ".txt": {
        const contents = escapeHtml(await fs.readFile(docPath, "utf8"))
        return `<pre style="height: 100%; margin: 0; overflow: auto; padding: 16px; white-space: pre-wrap">${contents}</pre>`
      }

      // TODO: Support PDF? (Is any package using that?)
      default:
        throw Error(`Unsupported documentation format ${docExt}`)
    }
  }

  public getCurrentProfile(): ProfileInfo | undefined {
    const profileId = this.settings?.currentProfile
    return profileId ? this.profiles?.[profileId] : undefined
  }

  public getDataRepository(): string {
    if (env.DATA_REPOSITORY) {
      if (isURL(env.DATA_REPOSITORY) || path.isAbsolute(env.DATA_REPOSITORY)) {
        return env.DATA_REPOSITORY
      }

      return path.join(__dirname, "..", env.DATA_REPOSITORY)
    }

    if (isDev()) {
      // TODO: return path.join(__dirname, "../sc4-plugin-manager-data")
    }

    return "https://github.com/memo33/sc4pac" // TODO: "https://github.com/Salinco96/sc4-plugin-manager-data.git"
  }

  public getDatabasePath(): string {
    const repository = this.getDataRepository()
    return isURL(repository) ? path.join(this.rootPath, DIRNAMES.database) : repository
  }

  public getDefaultConfigFormat(): ConfigFormat {
    return this.settings?.useYaml === false ? ConfigFormat.JSON : ConfigFormat.YAML
  }

  public getDownloadsPath(): string {
    return path.join(this.rootPath, DIRNAMES.downloads)
  }

  public getDownloadPath(key: string): string {
    return path.join(this.rootPath, DIRNAMES.downloads, key)
  }

  public getLogLevel(): LogLevel {
    if (env.LOG_LEVEL && log.levels.includes(env.LOG_LEVEL)) {
      return env.LOG_LEVEL as LogLevel
    } else {
      return isDev() ? "debug" : "info"
    }
  }

  public getLogsFile(): string {
    return path.join(this.rootPath, DIRNAMES.logs, FILENAMES.logs)
  }

  public getLogsPath(): string {
    return path.join(this.rootPath, DIRNAMES.logs)
  }

  public getPackagesPath(): string {
    return path.join(this.rootPath, DIRNAMES.packages)
  }

  public getPackagePath(packageId: string): string {
    return path.join(this.rootPath, DIRNAMES.packages, packageId)
  }

  public getPackageDocsPath(packageId: string): string {
    return path.join(this.rootPath, DIRNAMES.packages, packageId, DIRNAMES.packageDocs)
  }

  public getPluginsPath(): string {
    return path.join(this.gamePath, DIRNAMES.plugins)
  }

  public getProfilesPath(): string {
    return path.join(this.rootPath, DIRNAMES.profiles)
  }

  public getVariantPath(packageId: string, variantId: string): string {
    return path.join(this.rootPath, DIRNAMES.packages, packageId, variantId)
  }

  public getAssetInfo(assetId: string): AssetInfo | undefined {
    const assetInfo = this.assets?.[assetId]
    if (assetInfo) {
      return assetInfo
    }

    // Parse asset ID in format `source:id[#hash]@version`
    const match = assetId.match(/^([\w-]+):([\w./-]+)(?:#([\w./-]+))?@([\w.-]+)$/)
    if (match) {
      const [, source, id, hash, version] = match

      switch (source) {
        // id = owner/repository
        // version = release version
        // hash = release artifact filename
        case "github":
          return {
            id: `${source}/${id}/${hash}`,
            url: `https://github.com/${id}/releases/download/${version}/${hash}`,
            version,
          }

        // id = download ID
        case "sc4evermore":
          return {
            id: `${source}/${id}`,
            url: `https://www.sc4evermore.com/index.php/downloads?task=download.send&id=${id.replace("-", ":")}`,
            version,
          }

        // id = download ID
        // hash = variant (optional, only for downloads with multiple variants or to target older versions)
        case "simtropolis":
          return {
            id: `${source}/${id}${hash ? `#${hash}` : ""}`,
            url: `https://community.simtropolis.com/files/file/${id}/?do=download${hash ? `&r=${hash}` : ""}`,
            version,
          }
      }
    }
  }

  public getPackageInfo(packageId: string): PackageInfo | undefined {
    return this.packages?.[packageId]
  }

  public getProfileInfo(profileId: string): ProfileInfo | undefined {
    return this.profiles?.[profileId]
  }

  public getState(): ApplicationState {
    return {
      packages: this.packages,
      profiles: this.profiles,
      sessions: {
        simtropolis: {
          userId: this.sessions.simtropolis && this.sessions.simtropolis.userId,
        },
      },
      settings: this.settings,
      status: this.status,
    }
  }

  public async openPackageFileInExplorer(
    packageId: string,
    variantId: string,
    filePath: string,
  ): Promise<void> {
    const fullPath = path.join(this.getVariantPath(packageId, variantId), filePath)
    this.openInExplorer(path.extname(fullPath) ? path.dirname(fullPath) : fullPath)
  }

  protected openInExplorer(fullPath: string): void {
    cmd(`explorer "${fullPath.replaceAll('"', '\\"')}"`)
  }

  protected async initialize(): Promise<void> {
    // Initialize logs
    app.setPath("logs", this.getLogsPath())
    log.transports.console.level = this.getLogLevel()
    log.transports.file.level = this.getLogLevel()
    log.transports.file.resolvePathFn = this.getLogsFile.bind(this)
    Object.assign(console, log.functions)

    // Launch database update in child process
    const databaseUpdatePromise = this.tryUpdateDatabase()

    await fs.mkdir(this.getPackagesPath(), { recursive: true })

    // Load profiles...
    this.status.loader = "Loading profiles..."
    this.sendStateUpdates("status")
    const profiles = await this.loadProfiles()
    this.sendStateUpdates("profiles")

    // Load settings...
    this.status.loader = "Loading settings..."
    this.sendStateUpdates("status")
    const settings = await this.loadSettings()
    this.sendStateUpdates("settings")

    const currentProfile = settings.currentProfile ? profiles[settings.currentProfile] : undefined

    // Config file does not exist, this must be the first time launching the manager
    if (!settings.format) {
      const plugins = await fs.readdir(this.getPluginsPath())

      if (plugins.length) {
        const [doBackup] = await this.showConfirmation(
          "SC4 Plugin Manager",
          "Do you want to back up your Plugins folder?",
          "Your Plugins folder is not currently empty. The current version of the Plugin Manager is experimental and will not be able to detect conflicts with files you have added manually. We therefore recommend backing up your current Plugins folder, using the Plugin Manager on an empty folder, then copying additional plugins back.",
        )

        if (doBackup) {
          try {
            // Rename folder, then recreate new empty one
            await fs.rename(this.getPluginsPath(), this.getPluginsPath() + " (Backup)")
            await fs.mkdir(this.getPluginsPath())
            await this.showSuccess(
              "SC4 Plugin Manager",
              "Your Plugins folder was backed up as Plugins (Backup).",
            )
          } catch (error) {
            console.error("Failed to backup Plugins folder", error)
            const { message } = error as Error
            await this.showSuccess(
              "SC4 Plugin Manager",
              "Failed to backup Plugins folder.",
              message,
            )
          }
        }
      }

      await this.writeSettings()
    }

    // Load local packages...
    const localPackages = await loadLocalPackages(this.getPackagesPath(), (c, t) => {
      if (c % 10 === 0) {
        this.status.loader = `Loading local packages (${Math.floor(100 * (c / t))}%)...`
        this.sendStateUpdates("status")
      }
    })
    this.packages = localPackages
    this.sendStateUpdates("packages")

    // Wait for database update...
    this.status.loader = "Updating database..."
    this.sendStateUpdates("status")
    await databaseUpdatePromise

    // Load remote packages...
    const { assets, packages } = await loadRemotePackages(this.getDatabasePath(), (c, t) => {
      if (c % 10 === 0) {
        this.status.loader = `Loading remote packages (${Math.floor(100 * (c / t))}%)...`
        this.sendStateUpdates("status")
      }
    })
    this.assets = assets
    this.packages = packages

    // Merge local and remote package definitions...
    for (const packageId in localPackages) {
      const localPackageInfo = localPackages[packageId]
      const remotePackageInfo = this.packages?.[packageId]
      if (remotePackageInfo) {
        this.packages[packageId] = mergeLocalPackageInfo(localPackageInfo, remotePackageInfo)
      } else {
        this.packages[packageId] = localPackageInfo
      }
    }

    this.sendStateUpdates("packages")

    if (currentProfile) {
      this.status.loader = "Resolving dependencies..."
      this.sendStateUpdates("status")

      this.checkoutPackages()
      this.sendStateUpdates()
    }

    // Done
    this.status.loader = null
    this.sendStateUpdates("status")

    // Check game installation
    await this.checkGameInstall()

    await this.linkPackages()
  }

  public async createProfile(name: string, templateProfileId?: string): Promise<boolean> {
    if (!this.profiles || !this.settings) {
      return false
    }

    const profile: ProfileInfo = {
      id: createUniqueProfileId(name, Object.keys(this.profiles)),
      name,
      packages: {},
      externals: {},
    }

    const templateProfile = templateProfileId ? this.getProfileInfo(templateProfileId) : undefined
    if (templateProfile) {
      for (const packageId in templateProfile.packages) {
        profile.packages[packageId] = {
          ...templateProfile.packages[packageId],
        }
      }

      profile.externals = {
        ...templateProfile.externals,
      }
    }

    this.profiles[profile.id] = profile
    this.sendStateUpdates("profiles")

    return this.switchProfile(profile.id)
  }

  public async updatePackages(
    packages: { [packageId: string]: string | null },
    externals: Partial<ProfileExternals> = {},
  ): Promise<boolean> {
    this.tasks.linker

    const currentProfile = this.getCurrentProfile()
    if (!this.packages || !currentProfile) {
      return false
    }

    const resultingConfig: { [packageId in string]?: PackageConfig } = {}
    const resultingStatus: { [packageId in string]?: PackageStatus } = {}
    const resultingExternals = { ...currentProfile.externals, ...externals }

    /** Configuration before the update (readonly) */
    const getOldConfig = (packageId: string): Readonly<PackageConfig> => {
      return currentProfile?.packages[packageId] ?? {}
    }

    /** Status before the update (readonly) */
    const getOldStatus = (packageId: string): Readonly<PackageStatus> => {
      return this.packages![packageId].status
    }

    /** Current computed config */
    const getConfig = (packageId: string): PackageConfig => {
      return (resultingConfig[packageId] ??= structuredClone(getOldConfig(packageId)))
    }

    /** Current computed status */
    const getStatus = (packageId: string): PackageStatus => {
      return (resultingStatus[packageId] ??= structuredClone(getOldStatus(packageId)))
    }

    // Compute initial config changes
    for (const packageId in packages) {
      const newVariantId = packages[packageId]
      const newConfig = getConfig(packageId)

      if (newVariantId) {
        newConfig.enabled = true
        newConfig.variant = newVariantId
      } else {
        newConfig.enabled = false
      }
    }

    /** Packages that are being updated (explicitly enabled with their already-enabled variant) */
    const updatingPackageIds = new Set(
      Object.keys(packages).filter(packageId => {
        const oldStatus = getOldStatus(packageId)
        return oldStatus.enabled && oldStatus.variantId === packages[packageId]
      }),
    )

    /** Current computed variant */
    const getVariant = (packageId: string): VariantInfo | null => {
      const status = getStatus(packageId)
      return status.enabled ? this.packages![packageId].variants[status.variantId] : null
    }

    /** Desired variant */
    const getTargetVariant = (packageId: string): VariantInfo | null => {
      const packageInfo = this.packages![packageId]
      const config = getConfig(packageId)
      const status = getStatus(packageId)
      if (config.enabled || status.requiredBy.length) {
        const variant = packageInfo.variants[config.variant ?? status.variantId]
        if (updatingPackageIds.has(packageId) && variant.update) {
          return variant.update
        } else {
          return variant
        }
      } else {
        return null
      }
    }

    const updatePackage = (packageId: string) => {
      const status = getStatus(packageId)
      const oldVariant = getVariant(packageId)
      const newVariant = getTargetVariant(packageId)
      if (oldVariant === newVariant) {
        return
      }

      const oldDependencies = new Set<string>()
      const newDependencies = new Set<string>()

      if (oldVariant && status.enabled) {
        status.enabled = false
        oldVariant.dependencies?.forEach(dependencyId => {
          const dependencyStatus = getStatus(dependencyId)
          removeElement(dependencyStatus.requiredBy, packageId)
          // If dependency is no longer required by anything, mark if for removal
          if (dependencyStatus.requiredBy.length === 0) {
            oldDependencies.add(dependencyId)
          }
        })
      }

      if (newVariant && !status.enabled) {
        status.enabled = true
        status.variantId = newVariant.id
        newVariant.dependencies?.forEach(dependencyId => {
          const dependencyStatus = getStatus(dependencyId)
          dependencyStatus.requiredBy.push(packageId)
          // Mark new dependency OR revert previous mark for removal
          if (dependencyStatus.requiredBy.length === 1) {
            oldDependencies.delete(dependencyId) || newDependencies.add(dependencyId)
          }
        })
      }

      oldDependencies.forEach(updatePackage)
      newDependencies.forEach(updatePackage)
    }

    const tryUpdate = async (): Promise<boolean> => {
      // Recursively compute status changes
      Object.keys(resultingConfig).forEach(updatePackage)

      console.log({ resultingConfig, resultingStatus })

      /** Packages that will be disabled explicitly */
      const disablingPackageIds: string[] = []
      /** Packages that will be disabled implicitly (i.e. obsolete dependencies) */
      const disablingDependencyIds: string[] = []
      /** Packages that will be enabled explicitly */
      const enablingPackageIds: string[] = []
      /** Packages that will be enabled implicitly (i.e. new dependencies) */
      const enablingDependencyIds: string[] = []
      /** Packages that will be installed */
      const installingPackageIds: string[] = []
      /** Packages that will be installed implicitly (i.e. new non-installed dependencies) */
      const installingDependencyIds: string[] = []

      // Compute changelists
      for (const packageId in resultingStatus) {
        const oldStatus = getOldStatus(packageId)
        const newStatus = getStatus(packageId)

        if (newStatus.enabled !== oldStatus.enabled) {
          if (newStatus.enabled) {
            if (packages[packageId]) {
              enablingPackageIds.push(packageId)
            } else {
              enablingDependencyIds.push(packageId)
            }
          } else {
            if (packages[packageId] === null) {
              disablingPackageIds.push(packageId)
            } else {
              disablingDependencyIds.push(packageId)
            }
          }
        }

        const variantInfo = getVariant(packageId)
        if (variantInfo && (!variantInfo.installed || updatingPackageIds.has(packageId))) {
          installingPackageIds.push(packageId)
          if (!packages[packageId]) {
            installingDependencyIds.push(packageId)
          }
        }
      }

      /** Resulting conflict groups */
      const conflictGroups: { [groupId: string]: string[] } = {}

      for (const groupId in resultingExternals) {
        if (resultingExternals[groupId]) {
          conflictGroups[groupId] ??= [EXTERNAL_PACKAGE_ID]
        }
      }

      // Collect conflict groups
      for (const packageId in this.packages) {
        const info = this.packages[packageId]
        const status = resultingStatus[packageId] ?? info.status
        if (status.enabled) {
          info.variants[status.variantId].conflictGroups?.forEach(groupId => {
            conflictGroups[groupId] ??= []
            conflictGroups[groupId].push(packageId)
          })
        }
      }

      /** Incompatible packages with an available compatible variant (not installed) */
      const explicitVariantChanges: { [packageId: string]: string } = {}
      /** Incompatible packages with an available compatible variant (installed) */
      const implicitVariantChanges: { [packageId: string]: string } = {}
      /** Fully-incompatible packages (no compatible variant available) */
      const incompatiblePackageIds: string[] = []
      /** Incompatible externally-installed package groups */
      const incompatibleExternals: string[] = []

      // Check conflicts
      for (const packageId in this.packages) {
        const info = this.packages[packageId]
        const status = resultingStatus[packageId] ?? info.status
        if (status.enabled) {
          const config = getConfig(packageId)

          // Compute compatible variants
          const compatibleVariants = Object.values(info.variants).filter(variant =>
            isVariantCompatible(packageId, variant, conflictGroups),
          )

          // Compute default variant
          const defaultVariant = compatibleVariants[0]

          // If selected variant is the only compatible one, select it implicitly instead
          // if (compatibleVariants.length === 1 && config.variant === compatibleVariants[0].id) {
          //   delete config.variant
          // }

          // If current variable is incompatible, treat as conflict
          if (!packages[packageId]) {
            if (!compatibleVariants.includes(info.variants[status.variantId])) {
              if (!defaultVariant) {
                incompatiblePackageIds.push(packageId)
              } else if (defaultVariant.installed && !config.variant) {
                implicitVariantChanges[packageId] = defaultVariant.id
              } else {
                explicitVariantChanges[packageId] = defaultVariant.id
              }
            }
          }
        }
      }

      for (const groupId in resultingExternals) {
        if (resultingExternals[groupId] && !externals[groupId]) {
          if (conflictGroups[groupId]?.some(packageId => packageId !== EXTERNAL_PACKAGE_ID)) {
            incompatibleExternals.push(groupId)
          }
        }
      }

      let shouldRecalculate = false

      // Apply implicit variant changes automatically
      if (Object.keys(implicitVariantChanges).length) {
        for (const packageId in implicitVariantChanges) {
          getConfig(packageId).variant = implicitVariantChanges[packageId]
          packages[packageId] = implicitVariantChanges[packageId]
        }

        return tryUpdate()
      }

      // Show incompatible externals
      if (incompatibleExternals.length) {
        const groupNames = incompatibleExternals.map(groupId => {
          return `  - ${groupId}`
        })

        // TODO: Use our own modal rather than system one?
        const options: MessageBoxOptions = {
          buttons: ["Replace external packages", "Ignore conflicts", "Cancel"],
          cancelId: 2,
          defaultId: 0,
          detail: `The following external packages are incompatible with this change:
${groupNames.sort().join("\n")}

If you wish to replace them, please remove all corresponding files from your Plugins folder before continuing. Otherwise, you can resolve each conflict manually later.`,
          message: "Replace external packages?",
          noLink: true,
          title: "SC4 Plugin Manager",
          type: "warning",
        }

        let result: MessageBoxReturnValue
        if (this.mainWindow) {
          result = await dialog.showMessageBox(this.mainWindow, options)
        } else {
          result = await dialog.showMessageBox(options)
        }

        // Cancel
        if (result.response === 2) {
          return false
        }

        // Disable conflicted packages
        if (result.response === 0) {
          for (const groupId of incompatibleExternals) {
            resultingExternals[groupId] = false
            externals[groupId] = false
          }

          shouldRecalculate = true
        }
      }

      // Show fully-incompatible packages
      if (incompatiblePackageIds.length) {
        const packageNames = incompatiblePackageIds.map(packageId => {
          const info = this.getPackageInfo(packageId)!
          return `  - ${info.name}`
        })

        // TODO: Use our own modal rather than system one?
        const options: MessageBoxOptions = {
          buttons: ["Disable incompatible packages", "Ignore conflicts", "Cancel"],
          cancelId: 2,
          defaultId: 0,
          detail: `The following enabled packages are incompatible with this change:
${packageNames.sort().join("\n")}

You can either disable all incompatible packages now, or resolve each conflict manually later.`,
          message: "Disable incompatible packages?",
          noLink: true,
          title: "SC4 Plugin Manager",
          type: "warning",
        }

        let result: MessageBoxReturnValue
        if (this.mainWindow) {
          result = await dialog.showMessageBox(this.mainWindow, options)
        } else {
          result = await dialog.showMessageBox(options)
        }

        // Cancel
        if (result.response === 2) {
          return false
        }

        // Disable conflicted packages
        if (result.response === 0) {
          for (const packageId of incompatiblePackageIds) {
            getConfig(packageId).enabled = false
            packages[packageId] = null
          }

          shouldRecalculate = true
        }
      }

      // Show explicit variant changes
      if (Object.keys(explicitVariantChanges).length) {
        const packageNames = Object.entries(explicitVariantChanges).map(
          ([packageId, newVariantId]) => {
            const info = this.getPackageInfo(packageId)!
            const status = getStatus(packageId)
            return `  - ${info.name}: ${info.variants[status.variantId].name} -> ${info.variants[newVariantId].name}`
          },
        )

        // TODO: Use our own modal rather than system one?
        const options: MessageBoxOptions = {
          buttons: ["Install compatible variants", "Ignore conflicts", "Cancel"],
          cancelId: 2,
          defaultId: 0,
          detail: `The following enabled variants are incompatible with this change, but compatible variants can be installed:
${packageNames.sort().join("\n")}

You can either automatically install and switch to compatible variants now, or resolve each conflict manually later.`,
          message: "Install incompatible variants?",
          noLink: true,
          title: "SC4 Plugin Manager",
          type: "warning",
        }

        let result: MessageBoxReturnValue
        if (this.mainWindow) {
          result = await dialog.showMessageBox(this.mainWindow, options)
        } else {
          result = await dialog.showMessageBox(options)
        }

        // Cancel
        if (result.response === 2) {
          return false
        }

        // Switch to compatible variants
        if (result.response === 0) {
          for (const packageId in explicitVariantChanges) {
            getConfig(packageId).variant = explicitVariantChanges[packageId]
            packages[packageId] = explicitVariantChanges[packageId]
          }

          shouldRecalculate = true
        }
      }

      // Recalculate if there were fixable conflicts
      // TODO: Keep track of ignored conflicts (sometimes we may show same popup again)
      if (shouldRecalculate) {
        return tryUpdate()
      }

      // If there are packages to install...
      if (installingPackageIds) {
        /** Assets that will be downloaded */
        const missingAssetIds = new Set<string>()

        // Calculate list of missing assets
        for (const packageId of installingPackageIds) {
          const variantInfo = getVariant(packageId)
          if (variantInfo?.assets) {
            for (const asset of variantInfo.assets) {
              const assetInfo = this.getAssetInfo(asset.id)
              if (assetInfo && !missingAssetIds.has(asset.id)) {
                const key = `${assetInfo.id}@${assetInfo.version}`
                const downloaded = await exists(this.getDownloadPath(key))
                if (!downloaded) {
                  missingAssetIds.add(asset.id)
                }
              }
            }
          }
        }

        // Ask confirmation for dependency installs
        if (installingDependencyIds.length && missingAssetIds.size) {
          const packages = installingDependencyIds.map(packageId => {
            const info = this.getPackageInfo(packageId)!
            return `  - ${info.name}`
          })

          // TODO: Use our own modal rather than system one?
          const [confirmed] = await this.showConfirmation(
            "SC4 Plugin Manager",
            "Install new package?",
            `This action requires the installation of ${installingDependencyIds.length} additional package(s):
${packages.sort().join("\n")}

In total, ${missingAssetIds.size} new asset(s) will be downloaded.`,
          )

          if (!confirmed) {
            return false
          }
        }

        // Install all packages
        await Promise.all(
          installingPackageIds.map(packageId =>
            this.installPackage(packageId, getStatus(packageId).variantId),
          ),
        )
      }

      // Apply package config changes
      for (const packageId in packages) {
        const variantId = packages[packageId]
        let config = currentProfile.packages[packageId]
        if (variantId) {
          config ??= {}
          config.enabled = true
          config.variant = variantId
          currentProfile.packages[packageId] = config
        } else if (config?.variant) {
          delete config.enabled
        } else {
          delete currentProfile.packages[packageId]
        }
      }

      // Apply external config changes
      for (const groupId in externals) {
        if (externals[groupId]) {
          currentProfile.externals[groupId] = true
        } else {
          delete currentProfile.externals[groupId]
        }
      }

      // Recalculate compatibility
      this.checkoutPackages()
      this.markForUpdate("profiles")

      // Unselect default variants
      for (const packageId in currentProfile.packages) {
        const defaultVariantId = this.packages![packageId].status.defaultVariantId
        const config = currentProfile.packages[packageId]
        if (config?.variant && config.variant === defaultVariantId) {
          if (Object.keys(config).length === 1) {
            delete currentProfile.packages[packageId]
          } else {
            delete config.variant
          }
        }
      }

      this.markForUpdate("packages")
      this.sendStateUpdates()

      // Save updated profile config and trigger linking in background
      this.writeProfile(currentProfile)
      this.linkPackages()
      return true
    }

    return tryUpdate()
  }

  public async editProfile(profileId: string, data: ProfileUpdate): Promise<boolean> {
    const profile = this.getProfileInfo(profileId)
    if (!profile) {
      return false
    }

    if (data.name) {
      profile.name = data.name
    }

    if (data.externals) {
      await this.updatePackages({}, data.externals)
    } else {
      this.sendStateUpdates("profiles")
      this.writeProfile(profile)
    }

    return true
  }

  protected async installPackage(packageId: string, variantId: string): Promise<void> {
    const packageInfo = this.getPackageInfo(packageId)
    if (!packageInfo) {
      throw Error(`Unknown package '${packageId}'`)
    }

    const variantInfo = packageInfo.variants[variantId]
    if (!variantInfo) {
      throw Error(`Unknown variant '${packageId}#${variantId}'`)
    }

    try {
      const variantKey = `${packageId}#${variantId}`

      variantInfo.action = "installing"
      this.sendStateUpdates("packages")

      await this.tasks.install.queue(variantKey, async () => {
        const variantPath = this.getVariantPath(packageId, variantId)
        const docsPath = this.getPackageDocsPath(packageId)
        const assets = variantInfo.update?.assets ?? variantInfo.assets ?? []

        const assetInfos = assets.map(asset => {
          const assetInfo = this.getAssetInfo(asset.id)
          if (assetInfo) {
            return assetInfo
          } else {
            throw Error(`Unknown asset '${asset.id}'`)
          }
        })

        // Download and extract all assets
        await Promise.all(assetInfos.map(this.getAsset.bind(this)))

        // Remove any previous installation files
        await removeIfPresent(variantPath)
        await createIfMissing(variantPath)

        try {
          const files: typeof variantInfo.files = []

          for (const asset of assets) {
            const assetInfo = this.getAssetInfo(asset.id)!
            const downloadKey = `${assetInfo.id}@${assetInfo.version}`
            const downloadPath = this.getDownloadPath(downloadKey)

            // Find all included documentation
            const docsPaths = await glob(`*{${DOCEXTENSIONS.join(",")}}`, {
              cwd: downloadPath,
              matchBase: true,
              nodir: true,
            })

            // Create links
            for (const filePath of docsPaths) {
              const fullPath = path.join(downloadPath, filePath)
              const targetPath = path.join(docsPath, filePath)
              await createIfMissing(path.dirname(targetPath))
              await removeIfPresent(targetPath)
              await fs.symlink(fullPath, targetPath)
            }

            const includes: {
              category: CategoryID
              condition?: PackageCondition
              paths: string[]
            }[] = []

            if (asset.include) {
              for (const include of asset.include) {
                const category = include.category ?? variantInfo.category
                const condition = include.condition
                const lastInclude = includes.at(-1)
                // Paths with same category/condition can be resolved together
                if (category === lastInclude?.category && condition === lastInclude.condition) {
                  lastInclude.paths.push(include.path)
                } else {
                  includes.push({ category, condition, paths: [include.path] })
                }
              }
            } else {
              // If no explicit include is given, include everything
              includes.push({ category: variantInfo.category, paths: ["**"] })
            }

            // Find all included files
            const excludes = asset.exclude?.map(file => file.path) ?? []
            for (const { category, condition, paths } of includes) {
              const filePaths = await glob(paths, {
                cwd: downloadPath,
                dot: true,
                ignore: excludes,
                matchBase: true,
                nodir: true,
              })

              // Included paths are excluded from being included again
              excludes?.push(...paths)

              // Create links
              for (const filePath of filePaths) {
                const fullPath = path.join(downloadPath, filePath)
                const ext = path.extname(filePath)
                if (SC4EXTENSIONS.includes(ext)) {
                  const targetPath = path.join(variantPath, filePath)
                  await createIfMissing(path.dirname(targetPath))
                  await fs.symlink(fullPath, targetPath)
                  files.push({
                    path: filePath,
                    condition,
                    category: category !== variantInfo.category ? category : undefined,
                  })
                } else if (!DOCEXTENSIONS.includes(ext)) {
                  console.warn(`File ${fullPath} has unsupported extension ${ext}`)
                }
              }
            }
          }

          const docsPaths = await glob("**/*.{htm,html,md,txt}", {
            cwd: this.getPackageDocsPath(packageId),
            nodir: true,
          })

          if (docsPaths.length) {
            variantInfo.docs = {
              path:
                docsPaths.find(file => path.basename(file).match(/^index\.html?$/i)) ??
                docsPaths.find(file => path.basename(file).match(/readme/i)) ??
                docsPaths[0],
            }
          }

          if (variantInfo.update) {
            Object.assign(variantInfo, variantInfo.update)
            delete variantInfo.update
          }

          variantInfo.files = files
          variantInfo.installed = true

          // Rewrite config
          await this.writePackageConfig(packageInfo)
        } catch (error) {
          delete variantInfo.files
          delete variantInfo.installed
          throw error
        }
      })
    } finally {
      delete variantInfo.action
      this.sendStateUpdates("packages")
    }
  }

  protected async getAsset(assetInfo: AssetInfo): Promise<void> {
    const key = `${assetInfo.id}@${assetInfo.version}`

    return this.tasks.getAsset.queue(key, async () => {
      const downloadPath = this.getDownloadPath(key)

      const downloaded = await exists(downloadPath)
      if (!downloaded) {
        await this.tasks.download.queue(key, () =>
          download(key, assetInfo.url, downloadPath, this.sessions),
        )
      }

      await this.tasks.extract.queue(key, () => extract(downloadPath))
    })
  }

  public async installPackages(packages: { [packageId: string]: string }): Promise<boolean> {
    await Promise.all(
      Object.entries(packages).map(([packageId, variantId]) =>
        this.installPackage(packageId, variantId),
      ),
    )

    return true
  }

  public async removePackages(packageIds: string[]): Promise<boolean> {
    if (!this.assets || !this.packages) {
      return false
    }

    const promises = packageIds.map(async packageId => {
      try {
        const info = this.getPackageInfo(packageId)
        if (!info) {
          return false
        }

        const variantId = info.status.variantId
        const variant = info.variants[variantId]
        if (!variant) {
          return false
        }

        if (!variant.installed) {
          return true
        }

        delete variant.files
        delete variant.installed

        if (variant.local) {
          const defaultVariant = getDefaultVariant(info)
          info.status.variantId = defaultVariant.id
          this.setPackageVariantInConfig(packageId, defaultVariant.id)
          delete info.variants[variantId]
        }

        if (Object.values(info.variants).some(variant => variant?.installed)) {
          await removeIfPresent(this.getVariantPath(packageId, variantId))
          await this.writePackageConfig(info)
        } else {
          await removeIfPresent(this.getPackagePath(packageId))
        }

        const currentProfile = this.getCurrentProfile()
        if (currentProfile) {
          this.calculatePackageCompatibility()
        }

        this.markForUpdate("packages")
        this.sendStateUpdates()
        return true
      } catch (error) {
        console.error(error)
        return false
      }
    })

    const results = await Promise.all(promises)
    return !results.includes(false)
  }

  public async setPackageVariant(packageId: string, variantId: string): Promise<boolean> {
    const currentProfile = this.getCurrentProfile()
    const info = this.getPackageInfo(packageId)
    if (!info) {
      return false
    }

    const variant = info.variants[variantId]
    if (!variant) {
      return false
    }

    if (info.status.enabled) {
      await this.updatePackages({ [packageId]: variantId })
    } else {
      info.status.variantId = variantId

      if (currentProfile) {
        this.setPackageVariantInConfig(packageId, variantId)
        this.calculatePackageCompatibility()
      }

      this.markForUpdate("packages")
      this.sendStateUpdates()
    }

    return true
  }

  public async switchProfile(profileId: string): Promise<boolean> {
    const profile = this.getProfileInfo(profileId)
    if (!this.settings || !this.packages || !profile) {
      return false
    }

    this.settings.currentProfile = profileId
    this.markForUpdate("settings")

    this.checkoutPackages()
    this.sendStateUpdates()

    this.writeSettings()
    this.linkPackages()

    return true
  }

  protected checkoutPackages(): void {
    const profile = this.getCurrentProfile()
    if (this.packages && profile) {
      checkoutPackages(this.packages, profile)
      calculatePackageCompatibility(this.packages, profile)
      this.markForUpdate("packages")
    }
  }

  protected calculatePackageCompatibility(): void {
    const profile = this.getCurrentProfile()
    if (this.packages && profile) {
      calculatePackageCompatibility(this.packages, profile)
      this.markForUpdate("packages")
    }
  }

  public async simtropolisLogin(): Promise<void> {
    const session = await simtropolisLogin(this.browserSession)
    if (session) {
      console.info("Logged in to Simtropolis")
      this.sessions.simtropolis = session
      this.sendStateUpdates("sessions")
    } else {
      this.sessions.simtropolis = null
    }
  }

  public async simtropolisLogout(): Promise<void> {
    await simtropolisLogout(this.browserSession)
    console.info("Logged out from Simtropolis")
    this.sessions.simtropolis = null
    this.sendStateUpdates("sessions")
  }

  protected async linkPackages(): Promise<void> {
    if (!this.packages || !this.assets) {
      return
    }

    const pluginsPath = this.getPluginsPath()

    await this.tasks.linker.queue(
      "init",
      async () => {
        console.debug("Initializing links...")

        const recursive = async (dirname: string) => {
          const entries = await fs.readdir(dirname, { withFileTypes: true })
          for (const entry of entries) {
            const entryPath = path.join(dirname, entry.name)
            if (entry.isDirectory()) {
              await recursive(entryPath)
            } else if (entry.isSymbolicLink()) {
              this.links[entryPath] = await fs.readlink(entryPath)
            }
          }
        }

        await createIfMissing(pluginsPath)
        await recursive(pluginsPath)

        console.debug("Initializing links... ok")
      },
      {
        cache: true,
      },
    )

    if (this.getCurrentProfile()) {
      await this.tasks.linker.queue(
        "link",
        async () => {
          console.debug("Linking packages...")

          await createIfMissing(pluginsPath)

          const oldLinks = new Set(Object.keys(this.links))

          const makeLink = async (from: string, to: string) => {
            await removeIfPresent(to)
            await createIfMissing(path.dirname(to))
            await fs.symlink(from, to)
            this.links[to] = from
          }

          for (const packageId in this.packages) {
            const packageInfo = this.packages[packageId]
            if (packageInfo.status.enabled) {
              const variantId = packageInfo.status.variantId
              const variantInfo = packageInfo.variants[variantId]
              if (variantInfo) {
                const variantPath = this.getVariantPath(packageId, variantId)
                if (variantInfo.files?.length) {
                  for (const file of variantInfo.files) {
                    // TODO: Check file.condition
                    const fullPath = path.join(variantPath, file.path)
                    const categoryPath = formatCategory(file.category ?? variantInfo.category)

                    // DLL files must be in Plugins root
                    const targetPath = file.path.match(/\.(dll|ini)$/i)
                      ? path.join(pluginsPath, path.basename(file.path))
                      : path.join(pluginsPath, categoryPath, packageId, file.path)

                    oldLinks.delete(targetPath)
                    if (this.links[targetPath] !== fullPath) {
                      await makeLink(fullPath, targetPath)
                      console.debug(`Added link: ${targetPath}`)
                    }
                  }
                } else {
                  console.warn(`Package ${packageId} does not have files`)
                }
              }
            }
          }

          for (const linkPath of oldLinks) {
            console.debug(`Removed link: ${linkPath}`)
            await removeIfPresent(linkPath)
            await removeIfEmpty(path.dirname(linkPath))
            delete this.links[linkPath]

            let parentPath = path.dirname(linkPath)
            while (!pluginsPath.startsWith(parentPath) && (await removeIfEmpty(parentPath))) {
              parentPath = path.dirname(parentPath)
            }
          }

          console.debug("Linking packages... ok")
        },
        {
          invalidate: true,
        },
      )
    }
  }

  protected setPackageVariantInConfig(packageId: string, variantId: string): void {
    const profile = this.getCurrentProfile()
    const info = this.getPackageInfo(packageId)
    if (info && profile) {
      const config = profile.packages[packageId]
      const defaultVariant = getDefaultVariant(info)
      if (variantId !== defaultVariant.id) {
        if (config) {
          config.variant = variantId
        } else {
          profile.packages[packageId] = { variant: variantId }
        }
      } else if (config) {
        delete config.variant
        if (Object.keys(config).length === 0) {
          delete profile.packages[packageId]
        }
      }

      this.markForUpdate("profiles")
    }
  }

  protected markForUpdate(field: keyof ApplicationState): void {
    this.updateFields.push(field)
  }

  protected sendStateUpdates(field?: keyof ApplicationState): void {
    const data = pick(this.getState(), field ? [field] : this.updateFields)
    this.mainWindow?.webContents.postMessage("updateState", data)
    this.updateFields = field ? this.updateFields : []
  }

  protected onDownloadTaskUpdate(ongoingDownloads: string[]): void {
    this.status.ongoingDownloads = ongoingDownloads
    this.sendStateUpdates("status")
  }

  protected onExtractTaskUpdate(ongoingExtracts: string[]): void {
    this.status.ongoingExtracts = ongoingExtracts
    this.sendStateUpdates("status")
  }

  protected onLinkTaskUpdate(ongoingTasks: string[]): void {
    if (ongoingTasks[0] === "init") {
      this.status.linker = "Initializing..."
    } else if (ongoingTasks[0] === "link") {
      this.status.linker = "Linking packages..."
    } else {
      this.status.linker = null
    }

    this.sendStateUpdates("status")
  }

  protected async loadProfiles(): Promise<{ [id: string]: ProfileInfo }> {
    console.debug("Loading profiles")

    let nProfiles = 0
    this.profiles = {}

    const profilesPath = this.getProfilesPath()
    await fs.mkdir(profilesPath, { recursive: true })

    const entries = await fs.readdir(profilesPath, { withFileTypes: true })
    for (const entry of entries) {
      const format = path.extname(entry.name) as ConfigFormat
      if (entry.isFile() && Object.values(ConfigFormat).includes(format)) {
        const profileId = path.basename(entry.name, format)
        const profilePath = path.join(profilesPath, entry.name)
        if (this.profiles[profileId]) {
          console.warn(`Duplicate profile configuration '${entry.name}'`)
          continue
        }

        try {
          const profile = await readConfig<ProfileInfo>(profilePath)
          profile.format = format
          profile.id = profileId
          profile.name ??= profileId
          profile.packages ??= {}
          profile.externals ??= {}
          this.profiles[profileId] = profile
          nProfiles++
        } catch (error) {
          console.warn(`Invalid profile configuration '${entry.name}'`, error)
        }
      }
    }

    console.debug(`Loaded ${nProfiles} profiles`)

    this.markForUpdate("profiles")

    return this.profiles
  }

  protected async loadSettings(): Promise<Settings> {
    console.debug("Loading settings...")

    const config = await this.loadConfig<Settings>(this.rootPath, FILENAMES.settings)

    this.settings = {
      format: config?.format,
      ...defaultSettings,
      ...config?.data,
    }

    // Select first profile if currently-selected profile no longer exists
    const profileIds = Object.keys(this.profiles ?? {})
    const currentProfileId = this.settings.currentProfile
    if (!currentProfileId || !profileIds.includes(currentProfileId)) {
      this.settings.currentProfile = profileIds[0]
    }

    this.markForUpdate("settings")

    return this.settings
  }

  protected async writeProfile(profile: ProfileInfo): Promise<void> {
    if (this.tasks.writeProfiles.current) {
      const oldQueue = this.tasks.writeProfiles.queued
      return new Promise<void>(resolve => {
        this.tasks.writeProfiles.queued = resolve
      }).then(oldQueue)
    }

    const { id, format, ...data } = profile

    console.debug(`Saving profile '${id}'...`)

    profile.format = this.getDefaultConfigFormat()
    this.tasks.writeProfiles.current = writeConfig(
      this.getProfilesPath(),
      id,
      data,
      profile.format,
      format,
    ).finally(() => {
      delete this.tasks.writeProfiles.current
      if (this.tasks.writeProfiles.queued) {
        this.writeProfile(profile).then(this.tasks.writeProfiles.queued)
        delete this.tasks.writeProfiles.queued
      }
    })

    this.markForUpdate("profiles")

    return this.tasks.writeSettings.current
  }

  protected async writeSettings(): Promise<void> {
    if (!this.settings) {
      return
    }

    if (this.tasks.writeSettings.current) {
      const oldQueue = this.tasks.writeSettings.queued
      return new Promise<void>(resolve => {
        this.tasks.writeSettings.queued = resolve
      }).then(oldQueue)
    }

    console.debug("Saving settings...")

    const { format, ...data } = this.settings

    this.settings.format = this.getDefaultConfigFormat()
    this.tasks.writeSettings.current = writeConfig(
      this.rootPath,
      FILENAMES.settings,
      data,
      this.settings.format,
      format,
    ).finally(() => {
      delete this.tasks.writeSettings.current
      if (this.tasks.writeSettings.queued) {
        this.writeSettings().then(this.tasks.writeSettings.queued)
        delete this.tasks.writeSettings.queued
      }
    })

    this.markForUpdate("settings")

    return this.tasks.writeSettings.current
  }

  protected async loadConfig<T>(
    basePath: string,
    filename: string,
  ): Promise<{ data: T; format: ConfigFormat } | undefined> {
    return loadConfig(basePath, filename)
  }

  protected async writePackageConfig(packageInfo: PackageInfo): Promise<void> {
    await writePackageConfig(
      this.getPackagePath(packageInfo.id),
      packageInfo,
      this.getDefaultConfigFormat(),
    )

    this.markForUpdate("packages")
  }

  protected createMainWindow(): MainWindow {
    if (!this.mainWindow) {
      // Show splash screen only in production build
      if (import.meta.env.PROD) {
        this.splashScreen = new SplashScreen()
        this.splashScreen.on("close", () => {
          this.splashScreen = undefined
        })
      }

      this.mainWindow = new MainWindow()
      this.mainWindow.on("close", () => {
        this.mainWindow = undefined
      })

      this.mainWindow.on("show", () => {
        this.splashScreen?.close()
      })
    }

    return this.mainWindow
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected handle<Event extends keyof this & string, Args extends any[]>(
    this: { [key in Event]: (...args: Args) => unknown },
    event: Event,
  ): void {
    ipcMain.handle(event, (_, ...args: Args) => this[event](...args))
  }

  protected async tryUpdateDatabase(force?: boolean): Promise<boolean> {
    if (!this.databaseUpdatePromise || force) {
      const repository = this.getDataRepository()
      if (!isURL(repository)) {
        return true
      }

      this.databaseUpdatePromise = new Promise(resolve => {
        const branch = env.DATA_BRANCH || "main"
        console.info(`Updating database from ${repository}/${branch}...`)
        createChildProcess<UpdateDatabaseProcessData, {}, UpdateDatabaseProcessResponse>(
          updateDatabaseProcessPath,
          {
            cwd: this.getDatabasePath(),
            data: {
              branch,
              origin: repository,
            },
            onClose() {
              console.warn("Failed updating database:", "closed")
              resolve(false)
            },
            onMessage({ success, error }) {
              if (success) {
                console.info("Updated database")
                resolve(true)
              } else {
                console.warn("Failed updating database:", error)
                resolve(false)
              }
            },
          },
        )
      })
    }

    return this.databaseUpdatePromise
  }
}
