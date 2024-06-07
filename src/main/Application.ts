import { exec as cmd, exec } from "child_process"
import {
  Menu,
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
import { ProfileUpdate, createUniqueProfileId } from "@common/profiles"
import { ApplicationState, ApplicationStatus } from "@common/state"
import {
  AssetInfo,
  ConfigFormat,
  PackageCondition,
  PackageConfig,
  PackageInfo,
  ProfileData,
  ProfileInfo,
  Settings,
  getDefaultVariant,
  getDefaultVariantStrict,
} from "@common/types"
import { assert } from "@common/utils/types"
import {
  SimtropolisSession,
  getSimtropolisSession,
  simtropolisLogin,
  simtropolisLogout,
} from "@utils/sessions/simtropolis"

import {
  loadLocalPackages,
  loadRemotePackages,
  mergeLocalPackageInfo,
  writePackageConfig,
} from "./data/packages"
import { resolvePackageUpdates, resolvePackages } from "./data/packages/resolve"
import { compactProfileConfig, fromProfileData, toProfileData } from "./data/profiles/configs"
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

  public dirty: {
    packages?: { [packageId: string]: boolean } | boolean
    profiles?: { [profileId: string]: boolean } | boolean
    settings?: boolean
  } = {}

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
    readonly writer: TaskManager
  } = {
    download: new TaskManager("AssetFetcher", {
      onTaskUpdate: this.onDownloadTaskUpdate.bind(this),
      parallel: 6,
    }),
    extract: new TaskManager("AssetExtractor", {
      onTaskUpdate: this.onExtractTaskUpdate.bind(this),
      parallel: 3,
    }),
    getAsset: new TaskManager("AssetManager", { parallel: 6 }),
    install: new TaskManager("PackageInstaller", { parallel: 6 }),
    linker: new TaskManager("PackageLinker", {
      onTaskUpdate: this.onLinkTaskUpdate.bind(this),
    }),
    writer: new TaskManager("ConfigWriter"),
  }

  protected databaseUpdatePromise?: Promise<boolean>

  public constructor() {
    this.gamePath = this.loadGamePath()
    this.rootPath = path.join(this.gamePath, DIRNAMES.root)

    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          role: "fileMenu",
          submenu: [
            {
              accelerator: "CmdOrCtrl+R",
              click: () => this.reload(),
              label: "Reload",
            },
            {
              accelerator: "CmdOrCtrl+Q",
              role: "quit",
            },
          ],
        },
        {
          role: "editMenu",
        },
      ]),
    )

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
    this.handle("simtropolisLogin")
    this.handle("simtropolisLogout")
    this.handle("switchProfile")
    this.handle("updatePackages")

    this.initialize()
  }

  public async reload(): Promise<void> {
    this.assets = undefined
    this.packages = undefined
    this.profiles = undefined
    this.sessions = {}
    this.settings = undefined
    this.status = {
      linker: null,
      loader: null,
      ongoingDownloads: [],
      ongoingExtracts: [],
    }

    this.tasks.linker.invalidateCache("init")

    await this.initialize()
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
      this.sendSettings()
      this.writeSettings()
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
              this.sendSettings()
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
            this.sendSettings()
            this.writeSettings()
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

          this.sendSettings()
          this.writeSettings()
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
    cmd(`explorer "${fullPath}"`)
  }

  protected async initialize(): Promise<void> {
    // Initialize logs
    app.setPath("logs", this.getLogsPath())
    log.transports.console.level = this.getLogLevel()
    log.transports.file.level = this.getLogLevel()
    log.transports.file.resolvePathFn = this.getLogsFile.bind(this)
    Object.assign(console, log.functions)

    // Initialize session
    getSimtropolisSession(this.browserSession).then(session => {
      if (session) {
        console.info("Logged in to Simtropolis")
        this.sessions.simtropolis = session
        this.sendSessions()
      } else {
        this.sessions.simtropolis = null
      }
    })

    // Launch database update in child process
    const databaseUpdatePromise = this.tryUpdateDatabase()

    // Load profiles...
    this.status.loader = "Loading profiles..."
    this.sendStatus()
    await this.loadProfiles()

    // Load settings...
    this.status.loader = "Loading settings..."
    this.sendStatus()
    const settings = await this.loadSettings()

    // TODO: Move to function
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

      this.writeSettings()
    }

    this.createMainWindow()

    // Check game installation
    const checkGameInstallPromise = this.checkGameInstall()

    // Load local packages...
    await createIfMissing(this.getPackagesPath())
    this.packages = await loadLocalPackages(this.getPackagesPath(), (c, t) => {
      if (c % 10 === 0) {
        this.status.loader = `Loading local packages (${Math.floor(100 * (c / t))}%)...`
        this.sendStatus()
      }
    })

    this.sendPackages()

    // Wait for database update...
    this.status.loader = "Updating database..."
    this.sendStatus()
    await databaseUpdatePromise

    // Load remote packages...
    const remote = await loadRemotePackages(this.getDatabasePath(), (c, t) => {
      if (c % 10 === 0) {
        this.status.loader = `Loading remote packages (${Math.floor(100 * (c / t))}%)...`
        this.sendStatus()
      }
    })

    this.assets = remote.assets

    // Merge local and remote package definitions...
    for (const packageId in remote.packages) {
      const remotePackageInfo = remote.packages[packageId]
      const localPackageInfo = this.packages[packageId]
      if (localPackageInfo) {
        this.packages[packageId] = mergeLocalPackageInfo(localPackageInfo, remotePackageInfo)
      } else {
        this.packages[packageId] = remotePackageInfo
      }
    }

    this.sendPackages()

    // Wait for installation check...
    this.status.loader = "Checking installation..."
    this.sendStatus()
    await checkGameInstallPromise

    // Resolving packages if profile exists
    const currentProfile = this.getCurrentProfile()
    if (currentProfile) {
      this.status.loader = "Resolving dependencies..."
      this.sendStatus()
      this.recalculatePackages(currentProfile.id)
    }

    // Done
    this.status.loader = null
    this.sendStatus()
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
    this.writeProfile(profile.id)

    return this.switchProfile(profile.id)
  }

  public async updatePackages(
    profileId: string,
    configUpdates: Partial<Record<string, PackageConfig>>,
    externalUpdates: Partial<Record<string, boolean>>,
  ): Promise<boolean> {
    const packages = this.packages
    const profile = this.getProfileInfo(profileId)
    if (!packages || !profile) {
      return false
    }

    const {
      explicitVariantChanges,
      implicitVariantChanges,
      incompatibleExternals,
      incompatiblePackages,
      installingVariants,
      resultingConfigs,
      resultingExternals,
      resultingStatus,
    } = resolvePackageUpdates(packages, profile, configUpdates, externalUpdates)

    // Apply implicit variant changes automatically
    if (Object.keys(implicitVariantChanges).length) {
      for (const packageId in implicitVariantChanges) {
        configUpdates[packageId] = { variant: implicitVariantChanges[packageId][1] }
      }

      // Recalculate
      return this.updatePackages(profileId, configUpdates, externalUpdates)
    }

    // Confirm incompatible externals
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

      // Ignore conflicted externals
      if (result.response === 1) {
        for (const groupId of incompatibleExternals) {
          externalUpdates[groupId] = true
        }
      }

      // Disable conflicted externals
      if (result.response === 0) {
        for (const groupId of incompatibleExternals) {
          externalUpdates[groupId] = false
        }

        // Recalculate
        return this.updatePackages(profileId, configUpdates, externalUpdates)
      }
    }

    // Confirm fully-incompatible packages
    if (incompatiblePackages.length) {
      const packageNames = incompatiblePackages.map(packageId => {
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

      // Ignore conflicted packages
      if (result.response === 1) {
        for (const packageId of incompatiblePackages) {
          configUpdates[packageId] = { enabled: true }
        }
      }

      // Disable conflicted packages
      if (result.response === 0) {
        for (const packageId of incompatiblePackages) {
          configUpdates[packageId] = { enabled: false }
        }

        // Recalculate
        return this.updatePackages(profileId, configUpdates, externalUpdates)
      }
    }

    // Confirm explicit variant changes
    if (Object.keys(explicitVariantChanges).length) {
      const packageNames = Object.entries(explicitVariantChanges).map(
        ([packageId, [oldVariantId, newVariantId]]) => {
          const packageInfo = packages[packageId]
          const oldVariant = packageInfo.variants[oldVariantId]
          const newVariant = packageInfo.variants[newVariantId]
          if (oldVariant) {
            return `  - ${packageInfo.name}: ${oldVariant.name} -> ${newVariant.name}`
          } else {
            return `  - ${packageInfo.name}`
          }
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

      // Ignore conflicted variants
      if (result.response === 1) {
        for (const packageId in explicitVariantChanges) {
          configUpdates[packageId] = { variant: explicitVariantChanges[packageId][0] }
        }
      }

      // Switch to compatible variants
      if (result.response === 0) {
        for (const packageId in explicitVariantChanges) {
          configUpdates[packageId] = { variant: explicitVariantChanges[packageId][1] }
        }

        // Recalculate
        return this.updatePackages(profileId, configUpdates, externalUpdates)
      }
    }

    // If there are packages to install...
    if (Object.keys(installingVariants).length) {
      /** Assets that will be downloaded */
      const missingAssetIds = new Set<string>()

      // Calculate list of missing assets
      for (const packageId in installingVariants) {
        const variantId = installingVariants[packageId]
        const variantInfo = packages[packageId].variants[variantId]
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

      const installingDependencyIds = Object.keys(installingVariants).filter(
        packageId => !resultingConfigs[packageId]?.enabled,
      )

      // Confirm installation of dependencies
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
        Object.entries(installingVariants).map(([packageId, variantId]) =>
          this.installPackage(packageId, variantId),
        ),
      )

      // Recalculate (conflicts may have changed during install)
      return this.updatePackages(profileId, configUpdates, externalUpdates)
    }

    // Apply config changes
    profile.externals = resultingExternals
    profile.packages = resultingConfigs

    // Apply status changes
    for (const packageId in resultingStatus) {
      packages[packageId].status[profileId] = resultingStatus[packageId]
    }

    this.writeProfile(profileId)
    this.sendPackages()
    this.linkPackages()
    return true
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
      await this.updatePackages(profileId, {}, data.externals)
    } else {
      this.writeProfile(profileId)
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

      variantInfo.action = variantInfo.installed ? "updating" : "installing"
      this.sendPackage(packageId)

      await this.tasks.install.queue(variantKey, async context => {
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

            const excludes = asset.exclude?.map(file => file.path) ?? []

            // Blasklist file
            excludes.push("desktop.ini")

            // Find all included files
            for (const { category, condition, paths } of includes) {
              const filePaths = await glob(paths, {
                cwd: downloadPath,
                dot: true,
                ignore: excludes,
                matchBase: true,
                nodir: true,
              })

              // Included paths are excluded from being included again
              excludes.push(...paths)

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
                  context.warn(`File ${fullPath} has unsupported extension ${ext}`)
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
      this.sendPackage(packageId)
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

  public async removePackages(packages: { [packageId: string]: string }): Promise<boolean> {
    const currentProfile = this.getCurrentProfile()
    if (currentProfile) {
      const enabledPackageIds: string[] = []
      for (const packageId in packages) {
        if (currentProfile.packages[packageId]?.enabled) {
          const packageInfo = this.getPackageInfo(packageId)
          const packageStatus = packageInfo?.status[currentProfile.id]
          if (packageStatus?.variantId === packages[packageId]) {
            enabledPackageIds.push(packageId)
          }
        }
      }

      // TODO: Do not show popup in other packages
      if (enabledPackageIds.length) {
        await this.updatePackages(
          currentProfile.id,
          Object.fromEntries(enabledPackageIds.map(packageId => [packageId, { enabled: false }])),
          {},
        )
      }
    }

    const promises = Object.entries(packages).map(async ([packageId, variantId]) => {
      if (!this.assets || !this.packages || !this.profiles) {
        return false
      }

      const packageInfo = this.packages[packageId]
      if (!packageInfo) {
        return false
      }

      const variantInfo = packageInfo.variants[variantId]
      if (!variantInfo) {
        return false
      }

      if (!variantInfo.installed) {
        return true
      }

      try {
        const allVariants = Object.values(packageInfo.variants)
        const installedVariants = allVariants.filter(variant => variant?.installed)
        const isOnlyInstalledVariant = installedVariants.length === 1

        if (variantInfo.local) {
          const [confirmed] = await this.showConfirmation(
            isOnlyInstalledVariant ? "Remove local package" : "Remove local variant",
            isOnlyInstalledVariant ? "Remove local package?" : "Remove local variant?",
            isOnlyInstalledVariant
              ? `By removing package ${packageInfo.name}, all local files will be lost forever.`
              : `By removing variant ${packageInfo.name}#${variantInfo.name}, all local files will be lost forever.`,
          )

          if (!confirmed) {
            return false
          }
        }

        variantInfo.action = "removing"
        this.sendPackage(packageId)

        try {
          delete variantInfo.files
          delete variantInfo.installed

          if (isOnlyInstalledVariant) {
            await removeIfPresent(this.getPackagePath(packageId))
          } else {
            await removeIfPresent(this.getVariantPath(packageId, variantId))
            await this.writePackageConfig(packageInfo)
          }

          // TODO: This assumes that package is disabled in all profiles
          if (variantInfo.local) {
            if (isOnlyInstalledVariant) {
              delete this.packages[packageId]
            } else {
              delete packageInfo.variants[variantId]
              for (const profileId in packageInfo.status) {
                const packageStatus = packageInfo.status[profileId]
                if (packageStatus?.variantId === variantId) {
                  const defaultVariant = getDefaultVariant(packageInfo, this.profiles[profileId])
                  packageStatus.variantId = defaultVariant.id
                }
              }
            }
          }
        } finally {
          delete variantInfo.action
          this.sendPackage(packageId)
        }

        return true
      } catch (error) {
        console.error(error)
        return false
      }
    })

    const results = await Promise.all(promises)
    return !results.includes(false)
  }

  public async switchProfile(profileId: string): Promise<boolean> {
    const profile = this.getProfileInfo(profileId)
    if (!this.settings || !this.packages || !profile) {
      return false
    }

    this.settings.currentProfile = profileId

    this.writeSettings()
    this.recalculatePackages(profileId)

    return true
  }

  protected recalculatePackages(profileId: string): void {
    const packages = this.packages
    const profile = this.getProfileInfo(profileId)
    if (!packages || !profile) {
      return
    }

    const { resultingStatus } = resolvePackages(packages, profile.packages, profile.externals)
    for (const packageId in resultingStatus) {
      packages[packageId].status[profileId] = resultingStatus[packageId]
    }

    this.sendPackages()
    this.linkPackages()
  }

  public async simtropolisLogin(): Promise<void> {
    const session = await simtropolisLogin(this.browserSession)
    if (session) {
      console.info("Logged in to Simtropolis")
      this.sessions.simtropolis = session
      this.sendSessions()
    } else {
      this.sessions.simtropolis = null
    }
  }

  public async simtropolisLogout(): Promise<void> {
    await simtropolisLogout(this.browserSession)
    console.info("Logged out from Simtropolis")
    this.sessions.simtropolis = null
    this.sendSessions()
  }

  protected async linkPackages(): Promise<void> {
    if (!this.packages || !this.assets) {
      return
    }

    const pluginsPath = this.getPluginsPath()

    await this.tasks.linker.queue(
      "init",
      async context => {
        context.debug("Initializing links...")

        let nLinks = 0

        const recursive = async (dirname: string) => {
          const entries = await fs.readdir(dirname, { withFileTypes: true })
          for (const entry of entries) {
            const entryPath = path.join(dirname, entry.name)
            if (entry.isDirectory()) {
              await recursive(entryPath)
            } else if (entry.isSymbolicLink()) {
              this.links[entryPath] = await fs.readlink(entryPath)
              nLinks++
            }
          }
        }

        await createIfMissing(pluginsPath)
        await recursive(pluginsPath)

        context.debug(`Done (found ${nLinks})`)
      },
      { cache: true },
    )

    const currentProfile = this.getCurrentProfile()
    if (currentProfile) {
      await this.tasks.linker.queue(
        "link",
        async context => {
          context.debug("Linking packages...")

          await createIfMissing(pluginsPath)

          const oldLinks = new Set(Object.keys(this.links))

          let nCreatedLinks = 0
          let nRemovedLinks = 0

          const makeLink = async (from: string, to: string) => {
            await removeIfPresent(to)
            await createIfMissing(path.dirname(to))
            await fs.symlink(from, to)
            this.links[to] = from
          }

          for (const packageId in this.packages) {
            const packageInfo = this.packages[packageId]
            const status = packageInfo.status[currentProfile.id]!
            if (status.enabled) {
              const variantId = status.variantId
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
                      nCreatedLinks++
                    }
                  }
                } else {
                  context.warn(`Package ${packageId} does not have files`)
                }
              }
            }
          }

          for (const linkPath of oldLinks) {
            nRemovedLinks++
            await removeIfPresent(linkPath)
            await removeIfEmpty(path.dirname(linkPath))
            delete this.links[linkPath]

            let parentPath = path.dirname(linkPath)
            while (!pluginsPath.startsWith(parentPath) && (await removeIfEmpty(parentPath))) {
              parentPath = path.dirname(parentPath)
            }
          }

          context.debug(`Done (added ${nCreatedLinks}, removed ${nRemovedLinks})`)
        },
        { invalidate: true },
      )
    }
  }

  protected setPackageVariantInConfig(
    profileId: string,
    packageId: string,
    variantId: string,
  ): void {
    const profileInfo = this.getProfileInfo(profileId)
    const packageInfo = this.getPackageInfo(packageId)
    if (packageInfo && profileInfo) {
      const packageConfig = profileInfo.packages[packageId]
      const defaultVariant = getDefaultVariantStrict(packageInfo, profileInfo)
      if (variantId !== defaultVariant?.id) {
        if (packageConfig) {
          packageConfig.variant = variantId
        } else {
          profileInfo.packages[packageId] = { variant: variantId }
        }
      } else if (packageConfig) {
        delete packageConfig.variant
        if (Object.keys(packageConfig).length === 0) {
          delete profileInfo.packages[packageId]
        }
      }
    }
  }

  protected sendPackage(packageId: string): void {
    this.sendState({ packages: { [packageId]: this.getPackageInfo(packageId) ?? null } })
  }

  protected sendPackages(): void {
    this.sendState({ packages: this.packages })
  }

  protected sendProfile(profileId: string): void {
    this.sendState({ profiles: { [profileId]: this.getProfileInfo(profileId) ?? null } })
  }

  protected sendProfiles(): void {
    this.sendState({ profiles: this.profiles })
  }

  protected sendState(data: Partial<ApplicationState>): void {
    this.mainWindow?.webContents.postMessage("updateState", data)
  }

  protected sendSessions(): void {
    const simtropolisUserId = this.sessions.simtropolis && this.sessions.simtropolis.userId
    this.sendState({ sessions: { simtropolis: { userId: simtropolisUserId } } })
  }

  protected sendSettings(): void {
    this.sendState({ settings: this.settings })
  }

  protected sendStatus(): void {
    this.sendState({ status: this.status })
  }

  protected onDownloadTaskUpdate(ongoingDownloads: string[]): void {
    this.status.ongoingDownloads = ongoingDownloads
    this.sendStatus()
  }

  protected onExtractTaskUpdate(ongoingExtracts: string[]): void {
    this.status.ongoingExtracts = ongoingExtracts
    this.sendStatus()
  }

  protected onLinkTaskUpdate(ongoingTasks: string[]): void {
    if (ongoingTasks[0] === "init") {
      this.status.linker = "Initializing..."
    } else if (ongoingTasks[0] === "link") {
      this.status.linker = "Linking packages..."
    } else {
      this.status.linker = null
    }

    this.sendStatus()
  }

  protected async loadProfiles(): Promise<{ [id: string]: ProfileInfo }> {
    console.debug("Loading profiles")

    let nProfiles = 0
    this.profiles = {}

    const profilesPath = this.getProfilesPath()
    await createIfMissing(profilesPath)

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
          const data = await readConfig<ProfileData>(profilePath)
          const profile = fromProfileData(profileId, data)
          profile.format = format
          this.profiles[profileId] = profile
          nProfiles++
        } catch (error) {
          console.warn(`Invalid profile configuration '${entry.name}'`, error)
        }
      }
    }

    console.debug(`Loaded ${nProfiles} profiles`)

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

    return this.settings
  }

  protected async writeProfile(profileId: string): Promise<void> {
    return this.tasks.writer.queue(
      `profile:${profileId}`,
      async context => {
        const profile = this.getProfileInfo(profileId)
        if (!profile) {
          return
        }

        compactProfileConfig(profile)

        context.debug(`Saving profile '${profileId}'...`)

        const oldFormat = profile.format
        const newFormat = this.getDefaultConfigFormat()

        await writeConfig<ProfileData>(
          this.getProfilesPath(),
          profileId,
          toProfileData(profile),
          newFormat,
          oldFormat,
        )

        profile.format = newFormat
        this.sendProfile(profileId)

        context.debug("Done")
      },
      { invalidate: true },
    )
  }

  protected async writeSettings(): Promise<void> {
    return this.tasks.writer.queue(
      "settings",
      async context => {
        const settings = this.settings
        if (!settings) {
          return
        }

        context.debug("Saving settings...")

        const { format: oldFormat, ...data } = settings
        const newFormat = this.getDefaultConfigFormat()

        await writeConfig<Settings>(this.rootPath, FILENAMES.settings, data, newFormat, oldFormat)

        settings.format = newFormat
        this.sendSettings()

        context.debug("Done")
      },
      { invalidate: true },
    )
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

    this.sendPackage(packageInfo.id)
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

      const databasePath = this.getDatabasePath()
      await createIfMissing(databasePath)
      this.databaseUpdatePromise = new Promise(resolve => {
        const branch = env.DATA_BRANCH || "main"
        console.info(`Updating database from ${repository}/${branch}...`)
        createChildProcess<UpdateDatabaseProcessData, {}, UpdateDatabaseProcessResponse>(
          updateDatabaseProcessPath,
          {
            cwd: databasePath,
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
