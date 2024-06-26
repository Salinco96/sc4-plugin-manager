import {
  Menu,
  MessageBoxOptions,
  MessageBoxReturnValue,
  Session,
  app,
  dialog,
  ipcMain,
  net,
  session,
} from "electron/main"
import { existsSync, readFileSync, writeFileSync } from "fs"
import fs, { FileHandle } from "fs/promises"
import path from "path"

import log, { LogLevel } from "electron-log"
import escapeHtml from "escape-html"
import { glob } from "glob"

import { getCategoryPath } from "@common/categories"
import { i18n, i18nConfig } from "@common/i18n"
import { ProfileUpdate, createUniqueProfileId } from "@common/profiles"
import { ApplicationState, ApplicationStatus, TaskInfo } from "@common/state"
import {
  AssetInfo,
  ConfigFormat,
  PackageCondition,
  PackageConfig,
  PackageFile,
  PackageInfo,
  ProfileData,
  ProfileInfo,
  Settings,
  ToolInfo,
  getDefaultVariant,
} from "@common/types"
import { assert } from "@common/utils/types"
import { loadConfig, readConfig, writeConfig } from "@node/configs"
import { download } from "@node/download"
import { extractRecursively } from "@node/extract"
import { get } from "@node/fetch"
import {
  createIfMissing,
  exists,
  getExtension,
  isURL,
  moveTo,
  readFile,
  removeIfEmptyRecursive,
  removeIfPresent,
  toPosix,
} from "@node/files"
import { cmd } from "@node/processes"

import { getAssetKey } from "./data/assets"
import {
  loadLocalPackages,
  loadRemotePackages,
  mergeLocalPackageInfo,
  writePackageConfig,
} from "./data/packages"
import { getConflictGroups, resolvePackageUpdates, resolvePackages } from "./data/packages/resolve"
import { compactProfileConfig, fromProfileData, toProfileData } from "./data/profiles/configs"
import { MainWindow } from "./MainWindow"
import {
  UpdateDatabaseProcessData,
  UpdateDatabaseProcessResponse,
} from "./processes/updateDatabase/types"
import updateDatabaseProcessPath from "./processes/updateDatabase?modulePath"
import { SplashScreen } from "./SplashScreen"
import {
  CLEANITOLEXTENSIONS,
  DIRNAMES,
  DOCEXTENSIONS,
  FILENAMES,
  SC4EXTENSIONS,
  SC4INSTALLPATHS,
} from "./utils/constants"
import { env, isDev } from "./utils/env"
import { createChildProcess } from "./utils/processes"
import { handleDocsProtocol } from "./utils/protocols"
import {
  SIMTROPOLIS_ORIGIN,
  SimtropolisSession,
  getSimtropolisSession,
  getSimtropolisSessionCookies,
  simtropolisLogin,
  simtropolisLogout,
} from "./utils/sessions/simtropolis"
import { TaskContext, TaskManager } from "./utils/tasks"
import { TOOLS } from "./utils/tools"

const defaultSettings: Settings = {
  useYaml: true,
}

export class Application {
  public assets: { [assetId: string]: AssetInfo | undefined } = {}
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

  public links: { [from: string]: string } = {}
  public externalFiles = new Set<string>()

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
      parallel: 6,
    }),
    getAsset: new TaskManager("AssetManager", {
      parallel: 30,
    }),
    install: new TaskManager("PackageInstaller", {
      parallel: 30,
    }),
    linker: new TaskManager("PackageLinker", {
      onTaskUpdate: this.onLinkTaskUpdate.bind(this),
    }),
    writer: new TaskManager("ConfigWriter"),
  }

  protected databaseUpdatePromise?: Promise<boolean>

  public constructor() {
    // Initialize paths
    this.gamePath = this.loadGamePath()
    this.rootPath = path.join(this.gamePath, DIRNAMES.root)

    // Initialize logs
    app.setPath("logs", this.getLogsPath())
    log.transports.console.level = this.getLogLevel()
    log.transports.file.level = this.getLogLevel()
    log.transports.file.resolvePathFn = this.getLogsFile.bind(this)
    Object.assign(console, log.functions)

    // Initialize translations
    i18n.init(i18nConfig)

    // Initialize custom protocols
    handleDocsProtocol(this.rootPath, DOCEXTENSIONS)

    // Register message handlers
    this.handle("check4GBPatch")
    this.handle("cleanVariant")
    this.handle("createProfile")
    this.handle("getPackageDocsAsHtml")
    this.handle("getState")
    this.handle("installPackages")
    this.handle("openExecutableDirectory")
    this.handle("openInstallationDirectory")
    this.handle("openPackageConfig")
    this.handle("openPackageFile")
    this.handle("openProfileConfig")
    this.handle("openVariantRepository")
    this.handle("openVariantURL")
    this.handle("removePackages")
    this.handle("simtropolisLogin")
    this.handle("simtropolisLogout")
    this.handle("switchProfile")
    this.handle("updateProfile")

    this.setApplicationMenu()
    this.initialize()
  }

  protected async backUpFile(context: TaskContext, fullPath: string): Promise<void> {
    const pluginsPath = this.getPluginsPath()
    const pluginsBackupPath = path.join(path.dirname(pluginsPath), DIRNAMES.pluginsBackup)
    const relativePath = path.relative(pluginsPath, fullPath)
    context.debug(`Backing up ${relativePath}...`)
    const targetPath = path.join(pluginsBackupPath, relativePath)
    await moveTo(fullPath, targetPath)
    this.externalFiles.delete(fullPath)
    await removeIfEmptyRecursive(path.dirname(fullPath), pluginsPath)
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

  public async checkExeVersion(): Promise<void> {
    if (this.settings?.install?.path) {
      const exePath = path.join(this.settings.install.path, FILENAMES.sc4exe)

      const stdout = await cmd(
        `wmic datafile where "name='${exePath.replace(/[\\'"]/g, "\\$&")}'" get version`,
      )

      const match = stdout.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/)
      if (!match) {
        throw Error("Failed to detect executable version")
      }

      const version = match[0]
      if (this.settings?.install && this.settings.install.version !== version) {
        console.info(`Detected version ${version}`)
        this.settings.install.version = version
        this.sendSettings()
        this.writeSettings()
      }
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

  public async cleanAll(): Promise<void> {
    await this.tasks.linker.queue("clean:all", async context => {
      const currentProfile = this.getCurrentProfile()

      if (this.packages && currentProfile) {
        let nPackages = 0
        const nTotalPackages = Object.keys(this.packages).length
        const increment = Math.floor(nTotalPackages / 100)
        for (const packageId in this.packages) {
          const packageStatus = this.packages[packageId].status[currentProfile.id]
          if (packageStatus?.enabled) {
            await this.doCleanVariant(context, packageId, packageStatus.variantId)
          }

          if (nPackages++ % increment === 0) {
            context.setProgress(100 * (nPackages / nTotalPackages))
          }
        }
      }
    })
  }

  public async cleanVariant(packageId: string, variantId: string): Promise<void> {
    await this.tasks.linker.queue(`clean:${packageId}#${variantId}`, async context => {
      await this.doCleanVariant(context, packageId, variantId)
    })
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

  protected createMainWindow(): MainWindow {
    if (!this.mainWindow) {
      if (!isDev()) {
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

  protected async doCleanVariant(
    context: TaskContext,
    packageId: string,
    variantId: string,
  ): Promise<void> {
    const packageInfo = this.getPackageInfo(packageId)
    const variantInfo = packageInfo?.variants[variantId]
    if (packageInfo && variantInfo) {
      // context.debug(`Cleaning for package ${packageId}#${variantId}...`)

      const pluginsPath = this.getPluginsPath()
      const conflictingFiles = new Set<string>()

      const filenames = new Set(variantInfo.files?.map(file => path.basename(file.path)))

      if (variantInfo.cleanitol) {
        const cleanitolFiles = await glob("*.txt", {
          cwd: path.join(this.getVariantPath(packageId, variantId), variantInfo.cleanitol),
          dot: true,
          matchBase: true,
          nodir: true,
          withFileTypes: true,
        })

        for (const cleanitolFile of cleanitolFiles) {
          // context.debug(`Using cleanitol file ${cleanitolFile.relative()}`)
          const contents = await readFile(cleanitolFile.fullpath())
          for (const line of contents.split("\n")) {
            const filename = line.split(";", 2)[0].trim()

            if (filename) {
              filenames.add(filename)
            }
          }
        }
      }

      for (const filename of filenames) {
        for (const externalFile of this.externalFiles) {
          if (path.basename(externalFile) === filename) {
            conflictingFiles.add(externalFile)
          }
        }
      }

      if (conflictingFiles.size === 0) {
        // context.debug("Done (no conflicts)")
        return
      }

      const [confirmed] = await this.showConfirmation(
        packageInfo.name,
        "Remove conflicting files?",
        `The following external files are conflicting with this plugin:
${Array.from(conflictingFiles)
  .map(file => ` - ${path.relative(pluginsPath, file)}`)
  .sort()
  .join("\n")}

Do you want to remove these files? Backeups will be created in ${DIRNAMES.pluginsBackup}.`,
      )

      if (confirmed) {
        for (const conflictingFile of conflictingFiles) {
          await this.backUpFile(context, conflictingFile)
        }

        // context.debug(`Done (backed up ${conflictingFiles.size} files)`)
      }
    }
  }

  protected async downloadAsset(assetInfo: AssetInfo): Promise<void> {
    const key = this.getDownloadKey(assetInfo)
    const downloadPath = this.getDownloadPath(key)
    const downloadTempPath = this.getTempDownloadPath(key)
    const downloaded = await exists(downloadPath)
    if (!downloaded) {
      await this.tasks.download.queue(key, async context => {
        const response = await get(assetInfo.url, {
          cookies: origin => {
            // Pass Simtropolis credentials as cookie at that origin
            if (origin === SIMTROPOLIS_ORIGIN && this.sessions.simtropolis) {
              return getSimtropolisSessionCookies(this.sessions.simtropolis)
            }
          },
          fetch: net.fetch,
          logger: context,
        })

        await download(response, {
          downloadPath,
          downloadTempPath,
          exePath: exe => this.getToolExePath(exe),
          expectedHash: assetInfo.sha256,
          expectedSize: assetInfo.size,
          logger: context,
          onProgress: (current, total) => {
            const progress = Math.floor(100 * (current / total))
            context.setProgress(progress)
          },
        })
      })
    }
  }

  protected async extractFiles(assetInfo: AssetInfo): Promise<void> {
    const key = this.getDownloadKey(assetInfo)
    const downloadPath = this.getDownloadPath(key)
    await this.tasks.extract.queue(key, async context => {
      await extractRecursively(downloadPath, {
        exePath: exe => this.getToolExePath(exe),
        logger: context,
        onProgress: (current, total) => {
          const progress = Math.floor(100 * (current / total))
          context.setProgress(progress)
        },
      })
    })
  }

  protected async getAsset(assetInfo: AssetInfo): Promise<void> {
    return this.tasks.getAsset.queue(this.getDownloadKey(assetInfo), async () => {
      await this.downloadAsset(assetInfo)
      await this.extractFiles(assetInfo)
    })
  }

  public getAssetInfo(assetId: string): AssetInfo | undefined {
    return this.assets[assetId]
  }

  public getCurrentProfile(): ProfileInfo | undefined {
    const profileId = this.settings?.currentProfile
    return profileId ? this.profiles?.[profileId] : undefined
  }

  public getDatabasePath(): string {
    const repository = this.getDataRepository()
    return isURL(repository) ? path.join(this.rootPath, DIRNAMES.db) : repository
  }

  public getDataRepository(): string {
    if (env.DATA_REPOSITORY) {
      if (isURL(env.DATA_REPOSITORY) || path.isAbsolute(env.DATA_REPOSITORY)) {
        return env.DATA_REPOSITORY
      }

      return path.join(__dirname, "..", env.DATA_REPOSITORY)
    }

    if (isDev()) {
      return path.join(__dirname, "../../sc4-plugin-manager-data")
    }

    return "https://github.com/Salinco96/sc4-plugin-manager-data.git"
  }

  public getDefaultConfigFormat(): ConfigFormat {
    return this.settings?.useYaml === false ? ConfigFormat.JSON : ConfigFormat.YAML
  }

  protected getDownloadKey(assetInfo: AssetInfo): string {
    return getAssetKey(assetInfo.id, assetInfo.version)
  }

  public getDownloadPath(key: string): string {
    return path.join(this.getDownloadsPath(), key)
  }

  public getDownloadsPath(): string {
    return path.join(this.rootPath, DIRNAMES.downloads)
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

  public async getPackageDocsAsHtml(packageId: string, variantId: string): Promise<string> {
    const packageInfo = this.getPackageInfo(packageId)
    if (!packageInfo) {
      throw Error(`Unknown package '${packageId}'`)
    }

    const variantInfo = packageInfo.variants[variantId]
    if (!packageInfo) {
      throw Error(`Unknown variant '${packageId}#${variantId}'`)
    }

    if (!variantInfo.readme) {
      throw Error(`Package '${packageId}#${variantId}' does not have documentation`)
    }

    const docPath = path.join(this.getVariantPath(packageId, variantId), variantInfo.readme)
    const docExt = path.extname(docPath)

    switch (docExt) {
      case ".htm":
      case ".html": {
        const src = await fs.realpath(docPath)
        const pathname = toPosix(path.relative(this.rootPath, src))
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

  public getPackageInfo(packageId: string): PackageInfo | undefined {
    return this.packages?.[packageId]
  }

  public getPackagePath(packageId: string): string {
    return path.join(this.rootPath, DIRNAMES.packages, packageId)
  }

  public getPackagesPath(): string {
    return path.join(this.rootPath, DIRNAMES.packages)
  }

  public getPluginsPath(): string {
    return path.join(this.gamePath, DIRNAMES.plugins)
  }

  public getProfileInfo(profileId: string): ProfileInfo | undefined {
    return this.profiles?.[profileId]
  }

  public getProfilesPath(): string {
    return path.join(this.rootPath, DIRNAMES.profiles)
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

  public getTempDownloadPath(key: string): string {
    return path.join(this.getTempPath(), DIRNAMES.downloads, key)
  }

  public getTempPath(): string {
    return path.join(this.rootPath, DIRNAMES.temp)
  }

  public async getToolExePath(tool: string): Promise<string> {
    const toolInfo = this.getToolInfo(tool)
    if (!toolInfo) {
      throw Error(`Unknown tool '${tool}'`)
    }

    if (toolInfo.assetId) {
      const assetInfo = this.getAssetInfo(toolInfo.assetId)
      if (!assetInfo) {
        throw Error(`Unknown asset '${toolInfo.assetId}'`)
      }

      await this.downloadAsset(assetInfo)

      const downloadKey = this.getDownloadKey(assetInfo)
      const downloadPath = this.getDownloadPath(downloadKey)
      return path.join(downloadPath, toolInfo.exe)
    }

    return toolInfo.exe
  }

  public getToolInfo(tool: string): ToolInfo | undefined {
    return TOOLS[tool as keyof typeof TOOLS]
  }

  public getVariantPath(packageId: string, variantId: string): string {
    return path.join(this.rootPath, DIRNAMES.packages, packageId, variantId)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected handle<Event extends keyof this & string, Args extends any[]>(
    this: { [key in Event]: (...args: Args) => unknown },
    event: Event,
  ): void {
    ipcMain.handle(event, (_, ...args: Args) => this[event](...args))
  }

  protected async initialize(): Promise<void> {
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
    this.sendProfiles()

    // Load settings...
    this.status.loader = "Loading settings..."
    this.sendStatus()
    const settings = await this.loadSettings()

    // TODO: Move to function
    // Config file does not exist, this must be the first time launching the manager
    if (settings.format) {
      this.sendSettings()
    } else {
      const pluginsPath = this.getPluginsPath()
      const pluginsBackupPath = path.join(path.dirname(pluginsPath), DIRNAMES.pluginsBackup)
      const plugins = await fs.readdir(pluginsPath)

      if (plugins.length) {
        const [doBackup] = await this.showConfirmation(
          "SC4 Plugin Manager",
          `Do you want to back up your ${DIRNAMES.plugins} folder?`,
          `Your ${DIRNAMES.plugins} folder is not currently empty. The current version of the Plugin Manager is experimental and will not be able to detect conflicts with files you have added manually. We therefore recommend backing up your current ${DIRNAMES.plugins} folder, using the Plugin Manager on an empty folder, then copying additional plugins back.`,
        )

        if (doBackup) {
          try {
            // Rename folder, then recreate new empty one
            await moveTo(pluginsPath, pluginsBackupPath)
            await createIfMissing(pluginsPath)
            await this.showSuccess(
              "SC4 Plugin Manager",
              `Your ${DIRNAMES.plugins} folder was backed up as ${DIRNAMES.pluginsBackup}.`,
            )
          } catch (error) {
            console.error(`Failed to backup ${DIRNAMES.plugins} folder`, error)
            const { message } = error as Error
            await this.showSuccess(
              "SC4 Plugin Manager",
              `Failed to backup ${DIRNAMES.plugins} folder.`,
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

    // Done
    this.status.loader = null
    this.sendStatus()

    // Resolving packages if profile exists
    const currentProfile = this.getCurrentProfile()
    if (currentProfile) {
      // Resolve package status and dependencies (will also trigger linking)
      await this.recalculatePackages(currentProfile.id)
      // Run cleaner for all enabled packages
      await this.cleanAll()
    }
  }

  public async installPackages(packages: { [packageId: string]: string }): Promise<boolean> {
    const updatingPackages: { [packageId: string]: PackageConfig } = {}

    // Check if we are updating already-enabled variants - in that case we need to recalculate
    const currentProfile = this.getCurrentProfile()
    if (currentProfile) {
      for (const packageId in packages) {
        const variantId = packages[packageId]
        const packageInfo = this.getPackageInfo(packageId)
        const packageStatus = packageInfo?.status[currentProfile.id]

        if (packageStatus?.enabled && packageStatus?.variantId === variantId) {
          const variantInfo = packageInfo?.variants[variantId]
          if (variantInfo?.update) {
            updatingPackages[packageId] = {
              variant: packages[packageId],
              version: variantInfo.update.version,
            }
          }
        }
      }

      if (Object.keys(updatingPackages).length) {
        const result = await this.updateProfile(currentProfile.id, { packages: updatingPackages })

        if (!result) {
          return false
        }
      }
    }

    await Promise.all(
      Object.entries(packages)
        .filter(([packageId]) => !updatingPackages[packageId])
        .map(([packageId, variantId]) => this.installVariant(packageId, variantId)),
    )

    return true
  }

  protected async installVariant(packageId: string, variantId: string): Promise<void> {
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

        const assets = variantInfo.update?.assets ?? variantInfo.assets ?? []

        const assetInfos = assets.map(asset => {
          const assetInfo = this.getAssetInfo(asset.id)
          if (!assetInfo) {
            throw Error(`Unknown asset '${asset.id}'`)
          }

          return assetInfo
        })

        // Download and extract all assets
        await Promise.all(assetInfos.map(this.getAsset.bind(this)))

        // Remove any previous installation files
        await removeIfPresent(variantPath)
        await createIfMissing(variantPath)

        try {
          const cleanitol = new Set<string>()
          const docs = new Set<string>()
          const files = new Map<string, PackageFile>()

          for (const asset of assets) {
            const assetInfo = this.getAssetInfo(asset.id)
            if (!assetInfo) {
              throw Error(`Unknown asset '${asset.id}'`)
            }

            const downloadKey = this.getDownloadKey(assetInfo)
            const downloadPath = this.getDownloadPath(downloadKey)

            // Blacklist desktop.ini
            const excludes = ["desktop.ini"]

            const getChildrenPattern = (pattern: string) => {
              return pattern.includes("/") ? `${pattern}/**` : `**/${pattern}/**`
            }

            const excludePath = async (pattern: string) => {
              excludes.push(pattern, getChildrenPattern(pattern))
            }

            const includeFile = async (
              oldPath: string,
              newPath: string,
              type: "cleanitol" | "docs" | "files",
              category?: number,
              condition?: PackageCondition,
            ) => {
              const extension = getExtension(oldPath)

              if (!DOCEXTENSIONS.includes(extension) && !SC4EXTENSIONS.includes(extension)) {
                console.warn(`Ignoring file ${oldPath} with unsupported extension ${extension}`)
              }

              switch (type) {
                case "cleanitol": {
                  if (CLEANITOLEXTENSIONS.includes(extension)) {
                    if (!cleanitol.has(oldPath)) {
                      const targetPath = path.join(variantPath, DIRNAMES.cleanitol, newPath)
                      await createIfMissing(path.dirname(targetPath))
                      await fs.symlink(path.join(downloadPath, oldPath), targetPath)
                      cleanitol.add(oldPath)
                    }
                  }

                  break
                }

                case "docs": {
                  if (DOCEXTENSIONS.includes(extension)) {
                    if (!cleanitol.has(oldPath) && !docs.has(oldPath)) {
                      const targetPath = path.join(variantPath, DIRNAMES.docs, newPath)
                      await createIfMissing(path.dirname(targetPath))
                      await fs.symlink(path.join(downloadPath, oldPath), targetPath)
                      docs.add(oldPath)
                    }
                  }

                  break
                }

                case "files": {
                  if (SC4EXTENSIONS.includes(extension)) {
                    if (files.has(newPath)) {
                      context.raiseInDev(`Ignoring file ${oldPath} trying to unpack at ${newPath}`)
                    } else {
                      const targetPath = path.join(variantPath, newPath)
                      await createIfMissing(path.dirname(targetPath))
                      await fs.symlink(path.join(downloadPath, oldPath), targetPath)
                      files.set(newPath, {
                        path: newPath,
                        condition,
                        category: category !== variantInfo.category ? category : undefined,
                      })
                    }
                  }
                }
              }
            }

            const includeDirectory = async (
              oldPath: string,
              newPath: string,
              type: "cleanitol" | "docs" | "files",
              category?: number,
              condition?: PackageCondition,
            ) => {
              const filePaths = await glob(getChildrenPattern(toPosix(oldPath)), {
                cwd: downloadPath,
                dot: true,
                ignore: excludes,
                matchBase: true,
                nodir: true,
              })

              for (const filePath of filePaths) {
                await includeFile(
                  filePath,
                  type === "cleanitol"
                    ? path.basename(filePath)
                    : path.join(newPath, path.relative(oldPath, filePath)),
                  type,
                  category,
                  condition,
                )
              }
            }

            const includePath = async (
              pattern: string,
              type: "cleanitol" | "docs" | "files",
              include?: PackageFile,
            ) => {
              const entries = await glob(pattern, {
                cwd: downloadPath,
                dot: true,
                ignore: excludes,
                includeChildMatches: false,
                matchBase: true,
                withFileTypes: true,
              })

              if (entries.length === 0 && pattern !== "*cleanitol*.txt") {
                context.raiseInDev(`Pattern ${pattern} did not match any file`)
              }

              for (const entry of entries) {
                const oldPath = entry.relative()

                if (entry.isDirectory()) {
                  await includeDirectory(
                    oldPath,
                    include?.as ?? "",
                    type,
                    include?.category,
                    include?.condition,
                  )
                } else {
                  const filename = path.basename(entry.name)
                  await includeFile(
                    oldPath,
                    include?.as?.replace("*", filename) ?? filename,
                    type,
                    include?.category,
                    include?.condition,
                  )
                }
              }
            }

            // Include cleanitol (everything if not specified)
            if (asset.cleanitol) {
              for (const include of asset.cleanitol) {
                await includePath(include, "cleanitol")
              }
            } else {
              await includePath("*cleanitol*.txt", "cleanitol")
            }

            // Include docs (everything if not specified)
            if (asset.docs) {
              for (const include of asset.docs) {
                if (typeof include === "string") {
                  const [path, as] = include.split(":", 2)
                  await includePath(path, "docs", { as, path })
                } else {
                  await includePath(include.path, "docs", include)
                }
              }
            } else {
              await includeDirectory("", "", "docs")
            }

            // Exclude files
            if (asset.exclude) {
              for (const exclude of asset.exclude) {
                if (typeof exclude === "string") {
                  excludePath(exclude)
                } else {
                  excludePath(exclude.path)
                }
              }
            }

            // Include files (everything if not specified)
            if (asset.include) {
              for (const include of asset.include) {
                if (typeof include === "string") {
                  const [path, as] = include.split(":", 2)
                  await includePath(path, "files", { as, path })
                  excludePath(path)
                } else {
                  await includePath(include.path, "files", include)
                  excludePath(include.path)
                }
              }
            } else {
              await includeDirectory("", "", "files")
            }
          }

          // Automatically detect README if not specified
          if (!variantInfo.readme) {
            const readmePaths = await glob(`${DIRNAMES.docs}/**/*.{htm,html,md,txt}`, {
              cwd: variantPath,
              ignore: ["*cleanitol*", "*license*"],
              nodir: true,
            })

            variantInfo.readme =
              readmePaths.find(file => path.basename(file).match(/read.?me/i)) ?? readmePaths[0]
          }

          if (variantInfo.update) {
            Object.assign(variantInfo, variantInfo.update)
            delete variantInfo.update
          }

          variantInfo.files = Array.from(files.values())
          variantInfo.installed = true

          if (cleanitol.size) {
            variantInfo.cleanitol = DIRNAMES.cleanitol
          }

          if (docs.size) {
            variantInfo.docs = DIRNAMES.docs
          }

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

  protected async linkPackages(): Promise<void> {
    const pluginsPath = this.getPluginsPath()

    await this.tasks.linker.queue(
      "init",
      async context => {
        context.debug("Initializing links...")

        let nLinks = 0

        await createIfMissing(pluginsPath)

        const files = await glob("**", {
          cwd: pluginsPath,
          dot: true,
          nodir: true,
          withFileTypes: true,
        })

        let nFiles = 0
        const increment = Math.floor(files.length / 100)
        for (const file of files) {
          const fullPath = file.fullpath()

          if (file.isSymbolicLink()) {
            this.links[fullPath] = await fs.readlink(fullPath)
            nLinks++
          } else {
            this.externalFiles.add(fullPath)
          }

          if (nFiles++ % increment === 0) {
            context.setProgress(100 * (nFiles / files.length))
          }
        }

        context.debug(`Done (found ${nLinks} links and ${nFiles - nLinks} external files)`)
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

          let nCreated = 0
          let nRemoved = 0
          let nUpdated = 0

          const makeLink = async (from: string, to: string) => {
            await removeIfPresent(to)
            await createIfMissing(path.dirname(to))
            await fs.symlink(from, to)
            this.links[to] = from
          }

          const conflictGroups = getConflictGroups(
            this.packages!,
            Object.fromEntries(
              Object.entries(this.packages!).map(([id, info]) => [
                id,
                info.status[currentProfile.id]!,
              ]),
            ),
            currentProfile.externals,
          )

          const checkCondition = (condition?: PackageCondition) => {
            if (!condition) {
              return true
            }

            for (const requirement in condition) {
              const requiredValue = condition[requirement]
              const value = !!conflictGroups[requirement]?.length
              if (requiredValue !== undefined && requiredValue !== value) {
                return false
              }
            }

            return true
          }

          let nPackages = 0
          const nTotalPackages = Object.keys(this.packages!).length
          const increment = Math.floor(nTotalPackages / 100)

          for (const packageId in this.packages) {
            const packageInfo = this.packages[packageId]
            const status = packageInfo.status[currentProfile.id]
            if (status?.enabled) {
              const variantId = status.variantId
              const variantInfo = packageInfo.variants[variantId]
              if (variantInfo) {
                const variantPath = this.getVariantPath(packageId, variantId)
                if (variantInfo.files?.length) {
                  for (const file of variantInfo.files) {
                    if (checkCondition(file.condition)) {
                      const fullPath = path.join(variantPath, file.path)
                      const categoryPath = getCategoryPath(file.category ?? variantInfo.category)

                      // DLL files must be in Plugins root
                      const targetPath = file.path.match(/\.(dll|ini)$/i)
                        ? path.join(pluginsPath, path.basename(file.path))
                        : path.join(pluginsPath, categoryPath, packageId, file.path)

                      oldLinks.delete(targetPath)

                      if (this.externalFiles.has(targetPath)) {
                        await this.backUpFile(context, targetPath)
                        this.externalFiles.delete(targetPath)
                      }

                      if (this.links[targetPath] !== fullPath) {
                        const isNew = !this.links[targetPath]
                        await makeLink(fullPath, targetPath)
                        if (isNew) {
                          nCreated++
                        } else {
                          nUpdated++
                        }
                      }
                    }
                  }
                } else {
                  context.warn(`Package ${packageId} does not have files`)
                }
              }
            }

            if (nPackages++ % increment === 0) {
              context.setProgress(100 * (nPackages / nTotalPackages))
            }
          }

          for (const linkPath of oldLinks) {
            nRemoved++
            await removeIfPresent(linkPath)
            await removeIfEmptyRecursive(path.dirname(linkPath), pluginsPath)
            delete this.links[linkPath]
          }

          context.debug(`Done (added ${nCreated}, removed ${nRemoved}, updated ${nUpdated})`)
        },
        { invalidate: true },
      )
    }
  }

  protected async loadConfig<T>(
    basePath: string,
    filename: string,
  ): Promise<{ data: T; format: ConfigFormat } | undefined> {
    return loadConfig(basePath, filename)
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

  protected onDownloadTaskUpdate(ongoingDownloads: TaskInfo[]): void {
    this.status.ongoingDownloads = ongoingDownloads
    this.sendStatus()
  }

  protected onExtractTaskUpdate(ongoingExtracts: TaskInfo[]): void {
    this.status.ongoingExtracts = ongoingExtracts
    this.sendStatus()
  }

  protected onLinkTaskUpdate(ongoingTasks: TaskInfo[]): void {
    const task = ongoingTasks[0]
    if (task?.key === "init") {
      this.status.linker = `Initializing...${task.progress ? ` (${task.progress.toFixed(0)}%)` : ""}`
    } else if (task?.key === "link") {
      this.status.linker = `Linking packages...${task.progress ? ` (${task.progress.toFixed(0)}%)` : ""}`
    } else if (task?.key === "clean:all") {
      this.status.linker = `Checking for conflicts...${task.progress ? ` (${task.progress.toFixed(0)}%)` : ""}`
    } else {
      this.status.linker = null
    }

    this.sendStatus()
  }

  public async openExecutableDirectory(): Promise<boolean> {
    if (this.settings?.install?.path) {
      this.openInExplorer(path.dirname(path.join(this.settings.install.path, FILENAMES.sc4exe)))
      return true
    }

    return false
  }

  protected async openInExplorer(fullPath: string): Promise<void> {
    await cmd(`explorer "${fullPath}"`)
  }

  public async openInstallationDirectory(): Promise<boolean> {
    if (this.settings?.install?.path) {
      this.openInExplorer(this.settings.install.path)
      return true
    }

    return false
  }

  public async openPackageConfig(packageId: string): Promise<boolean> {
    const packageInfo = this.getPackageInfo(packageId)
    const packagePath = this.getPackagePath(packageId)
    if (packageInfo?.format) {
      this.openInExplorer(path.join(packagePath, FILENAMES.packageConfig + packageInfo.format))
      return true
    }

    return false
  }

  public async openPackageFile(
    packageId: string,
    variantId: string,
    filePath: string,
  ): Promise<boolean> {
    this.openInExplorer(path.join(this.getVariantPath(packageId, variantId), filePath))
    return true
  }

  public async openProfileConfig(profileId: string): Promise<boolean> {
    const profileInfo = this.getProfileInfo(profileId)
    if (profileInfo?.format) {
      this.openInExplorer(path.join(this.getProfilesPath(), profileId + profileInfo.format))
      return true
    }

    return false
  }

  public async openVariantRepository(packageId: string, variantId: string): Promise<boolean> {
    const variantInfo = this.getPackageInfo(packageId)?.variants[variantId]
    if (variantInfo?.repository) {
      await this.openInExplorer(variantInfo.repository)
      return true
    }

    return false
  }

  public async openVariantURL(packageId: string, variantId: string): Promise<boolean> {
    const variantInfo = this.getPackageInfo(packageId)?.variants[variantId]
    if (variantInfo?.url) {
      await this.openInExplorer(variantInfo.url)
      return true
    }

    return false
  }

  public async quit(): Promise<void> {
    await removeIfPresent(this.getTempPath())
  }

  protected async recalculatePackages(profileId: string): Promise<void> {
    const profile = this.getProfileInfo(profileId)
    if (!this.packages || !profile) {
      return
    }

    const { resultingStatus } = resolvePackages(this.packages, profile.packages, profile.externals)
    for (const packageId in resultingStatus) {
      this.packages[packageId].status[profileId] = resultingStatus[packageId]
    }

    this.sendPackages()
    await this.linkPackages()
  }

  public async reload(): Promise<void> {
    this.assets = {}
    this.externalFiles = new Set()
    this.links = {}
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

    this.sendStateReset()

    await this.initialize()
  }

  public async removePackages(packages: { [packageId: string]: string }): Promise<boolean> {
    // TODO: ATM we only check the current profile - removing package may break other profiles
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

      if (enabledPackageIds.length) {
        const result = await this.updateProfile(currentProfile.id, {
          packages: Object.fromEntries(
            enabledPackageIds.map(packageId => [packageId, { enabled: false }]),
          ),
        })

        if (!result) {
          return false
        }
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

          // TODO: This assumes that package is disabled in other profiles
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

  protected setPackageVariantInConfig(
    profileId: string,
    packageId: string,
    variantId: string,
  ): void {
    const profileInfo = this.getProfileInfo(profileId)
    const packageInfo = this.getPackageInfo(packageId)
    if (packageInfo && profileInfo) {
      const packageConfig = profileInfo.packages[packageId]
      const defaultVariant = getDefaultVariant(packageInfo, profileInfo)
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
    this.sendStateUpdate({ packages: { [packageId]: this.getPackageInfo(packageId) ?? null } })
  }

  protected sendPackages(): void {
    this.sendStateUpdate({ packages: this.packages })
  }

  protected sendProfile(profileId: string): void {
    this.sendStateUpdate({ profiles: { [profileId]: this.getProfileInfo(profileId) ?? null } })
  }

  protected sendProfiles(): void {
    this.sendStateUpdate({ profiles: this.profiles })
  }

  protected sendSessions(): void {
    const simtropolisUserId = this.sessions.simtropolis && this.sessions.simtropolis.userId
    this.sendStateUpdate({ sessions: { simtropolis: { userId: simtropolisUserId } } })
  }

  protected sendSettings(): void {
    this.sendStateUpdate({ settings: this.settings })
  }

  protected sendStateReset(): void {
    this.mainWindow?.webContents.postMessage("resetState", this.getState())
  }

  protected sendStateUpdate(data: Partial<ApplicationState>): void {
    this.mainWindow?.webContents.postMessage("updateState", data)
  }

  protected sendStatus(): void {
    this.sendStateUpdate({ status: this.status })
  }

  protected setApplicationMenu(): void {
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
  }

  protected async showConfirmation(
    title: string,
    message: string,
    detail?: string,
    doNotAskAgain: boolean = false,
    type: "question" | "warning" = "question",
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
      type,
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

  public async updateProfile(profileId: string, update: ProfileUpdate): Promise<boolean> {
    const profile = this.getProfileInfo(profileId)
    if (!this.packages || !profile) {
      return false
    }

    // Changes to packages/externals require conflict computation and potential side-effects / confirmation
    if (update.packages || update.externals) {
      update.packages ??= {}
      update.externals ??= {}

      const {
        disablingPackages,
        enablingPackages,
        explicitVariantChanges,
        implicitVariantChanges,
        incompatibleExternals,
        incompatiblePackages,
        installingVariants,
        resultingConfigs,
        resultingExternals,
        resultingStatus,
        shouldRecalculate,
      } = resolvePackageUpdates(this.packages, profile, update.packages, update.externals)

      try {
        if (shouldRecalculate) {
          for (const packageId of disablingPackages) {
            const packageStatus = this.packages[packageId].status[profileId]
            if (packageStatus) {
              packageStatus.action = "disabling"
            }
          }

          for (const packageId of enablingPackages) {
            const packageStatus = this.packages[packageId].status[profileId]
            if (packageStatus) {
              packageStatus.action = "enabling"
            }
          }

          // Apply implicit variant changes automatically
          if (Object.keys(implicitVariantChanges).length) {
            for (const packageId in implicitVariantChanges) {
              update.packages[packageId] = { variant: implicitVariantChanges[packageId][1] }
            }

            // Recalculate
            return this.updateProfile(profileId, update)
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
                update.externals[groupId] = true
              }
            }

            // Disable conflicted externals
            if (result.response === 0) {
              for (const groupId of incompatibleExternals) {
                update.externals[groupId] = false
              }

              // Recalculate
              return this.updateProfile(profileId, update)
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
                update.packages[packageId] = { enabled: true }
              }
            }

            // Disable conflicted packages
            if (result.response === 0) {
              for (const packageId of incompatiblePackages) {
                update.packages[packageId] = { enabled: false }
              }

              // Recalculate
              return this.updateProfile(profileId, update)
            }
          }

          // Confirm explicit variant changes
          if (Object.keys(explicitVariantChanges).length) {
            const packageNames = Object.entries(explicitVariantChanges).map(
              ([packageId, [oldVariantId, newVariantId]]) => {
                const packageInfo = this.getPackageInfo(packageId)
                const oldVariant = packageInfo?.variants[oldVariantId]
                const newVariant = packageInfo?.variants[newVariantId]
                if (oldVariant) {
                  return `  - ${packageInfo?.name}: ${oldVariant.name} -> ${newVariant?.name}`
                } else {
                  return `  - ${packageInfo?.name}`
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
                update.packages[packageId] = { variant: explicitVariantChanges[packageId][0] }
              }
            }

            // Switch to compatible variants
            if (result.response === 0) {
              for (const packageId in explicitVariantChanges) {
                update.packages[packageId] = { variant: explicitVariantChanges[packageId][1] }
              }

              // Recalculate
              return this.updateProfile(profileId, update)
            }
          }

          // Confirm optional dependencies
          const optionalDependencies: { [dependencyId: string]: boolean } = {}
          for (const packageId of enablingPackages) {
            const packageInfo = this.getPackageInfo(packageId)
            const variantInfo = packageInfo?.variants[resultingStatus[packageId].variantId]
            const dependencyIds = variantInfo?.optional?.filter(
              dependencyId =>
                this.getPackageInfo(dependencyId) &&
                !resultingStatus[dependencyId]?.enabled &&
                !resultingStatus[dependencyId]?.issues?.length &&
                optionalDependencies[dependencyId] === undefined,
            )

            if (packageInfo && dependencyIds?.length) {
              const packages = dependencyIds.map(packageId => {
                const info = this.getPackageInfo(packageId)!
                return `  - ${info.name}`
              })

              // TODO: Use our own modal rather than system one?
              const [confirmed] = await this.showConfirmation(
                packageInfo.name,
                "Enable optional dependencies?",
                `This package mentions the following optional dependencies:
${packages.sort().join("\n")}

Do you want to enable them?`,
              )

              for (const dependencyId of dependencyIds) {
                optionalDependencies[dependencyId] = confirmed
              }
            }
          }

          if (Object.values(optionalDependencies).some(Boolean)) {
            for (const packageId in optionalDependencies) {
              if (optionalDependencies[packageId]) {
                update.packages[packageId] = { enabled: true }
              }
            }

            // Recalculate
            return this.updateProfile(profileId, update)
          }

          // Confirm on-enable warnings
          for (const packageId of enablingPackages) {
            const packageInfo = this.getPackageInfo(packageId)
            const variantInfo = packageInfo?.variants[resultingStatus[packageId].variantId]
            if (packageInfo && variantInfo?.warnings) {
              for (const warning of variantInfo.warnings) {
                if (!warning.on || warning.on === "enable") {
                  // TODO: Use our own modal rather than system one?
                  const [confirmed] = await this.showConfirmation(
                    packageInfo.name,
                    "Enable package?",
                    warning.message,
                    undefined,
                    "warning",
                  )

                  if (!confirmed) {
                    return false
                  }
                }
              }
            }
          }

          // Confirm on-disable warnings
          for (const packageId of disablingPackages) {
            const packageInfo = this.getPackageInfo(packageId)
            const variantInfo = packageInfo?.variants[resultingStatus[packageId].variantId]
            if (packageInfo && variantInfo?.warnings) {
              for (const warning of variantInfo.warnings) {
                if (warning.on === "disable") {
                  // TODO: Use our own modal rather than system one?
                  const [confirmed] = await this.showConfirmation(
                    packageInfo.name,
                    "Disable package?",
                    warning.message ??
                      (warning.id
                        ? {
                            bulldoze: `Before disabling ${packageInfo.name}, you must bulldoze all corresponding lots from all relevant regions.`,
                          }[warning.id]
                        : undefined),
                    undefined,
                    "warning",
                  )

                  if (!confirmed) {
                    return false
                  }
                }
              }
            }
          }

          if (Object.values(optionalDependencies).some(Boolean)) {
            for (const packageId in optionalDependencies) {
              if (optionalDependencies[packageId]) {
                update.packages[packageId] = { enabled: true }
              }
            }

            // Recalculate
            return this.updateProfile(profileId, update)
          }

          // If there are packages to install...
          if (Object.keys(installingVariants).length) {
            /** Assets that will be downloaded */
            const missingAssets = new Map<string, AssetInfo>()

            // Calculate list of missing assets
            for (const packageId in installingVariants) {
              const variantId = installingVariants[packageId]
              const variantInfo = this.getPackageInfo(packageId)?.variants[variantId]
              if (variantInfo?.assets) {
                for (const asset of variantInfo.assets) {
                  const assetInfo = this.getAssetInfo(asset.id)
                  if (assetInfo && !missingAssets.has(asset.id)) {
                    const key = this.getDownloadKey(assetInfo)
                    const downloaded = await exists(this.getDownloadPath(key))
                    if (!downloaded) {
                      missingAssets.set(asset.id, assetInfo)
                    }
                  }
                }
              }
            }

            const installingDependencyIds = Object.keys(installingVariants).filter(
              packageId => !resultingConfigs[packageId]?.enabled,
            )

            // Confirm installation of dependencies
            if (missingAssets.size) {
              const packages = installingDependencyIds.map(packageId => {
                const info = this.getPackageInfo(packageId)!
                return `  - ${info.name}`
              })

              const totalSize = Array.from(missingAssets.values()).reduce(
                (total, asset) => (asset.size ? total + asset.size : NaN),
                0,
              )

              // TODO: Use our own modal rather than system one?
              const [confirmed] = await this.showConfirmation(
                "SC4 Plugin Manager",
                "Install new package?",
                `${
                  installingDependencyIds.length
                    ? `This action requires the installation of ${installingDependencyIds.length} additional package(s):
${packages.sort().join("\n")}

In total, `
                    : ""
                }${missingAssets.size} asset(s)${totalSize ? ` (${(totalSize / 1e6).toFixed(2)} Mo)` : ""} will be downloaded.`,
              )

              if (!confirmed) {
                return false
              }
            }

            // Install all packages
            await Promise.all(
              Object.entries(installingVariants).map(([packageId, variantId]) =>
                this.installVariant(packageId, variantId),
              ),
            )

            // Recalculate (conflicts may have changed during install)
            return this.updateProfile(profileId, update)
          }
        }

        // Apply config changes
        profile.externals = resultingExternals
        profile.packages = resultingConfigs

        // Apply status changes
        for (const packageId in resultingStatus) {
          this.packages[packageId].status[profileId] = resultingStatus[packageId]
        }

        this.sendPackages()

        // Run cleaner and linker
        if (shouldRecalculate) {
          for (const packageId of enablingPackages) {
            const { variantId } = resultingStatus[packageId]
            await this.cleanVariant(packageId, variantId)
          }

          this.linkPackages()
        }
      } finally {
        if (this.packages && shouldRecalculate) {
          for (const packageId of disablingPackages) {
            const packageStatus = this.packages[packageId].status[profileId]
            if (packageStatus?.action === "disabling") {
              delete packageStatus.action
            }
          }

          for (const packageId of enablingPackages) {
            const packageStatus = this.packages[packageId].status[profileId]
            if (packageStatus?.action === "enabling") {
              delete packageStatus.action
            }
          }
        }
      }
    }

    // Other changes can be applied directly
    profile.name = update.name || profile.name

    this.writeProfile(profileId)
    return true
  }

  protected async writePackageConfig(packageInfo: PackageInfo): Promise<void> {
    await writePackageConfig(
      this.getPackagePath(packageInfo.id),
      packageInfo,
      this.getDefaultConfigFormat(),
    )

    this.sendPackage(packageInfo.id)
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
}
