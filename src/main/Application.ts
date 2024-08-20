import {
  Menu,
  MessageBoxOptions,
  MessageBoxReturnValue,
  OpenDialogOptions,
  Session,
  app,
  dialog,
  ipcMain,
  net,
  session,
} from "electron/main"
import fs, { FileHandle, writeFile } from "fs/promises"
import path from "path"

import log, { LogLevel } from "electron-log"
import escapeHtml from "escape-html"
import { glob } from "glob"

import { getPriorityLabel } from "@common/categories"
import { getFeatureLabel, i18n, initI18n, t } from "@common/i18n"
import { checkCondition, getOptionValue } from "@common/packages"
import { ProfileUpdate, createUniqueProfileId } from "@common/profiles"
import { ApplicationState, ApplicationStatus } from "@common/state"
import {
  AssetInfo,
  CategoryInfo,
  ConfigFormat,
  Feature,
  OptionInfo,
  PackageConfig,
  PackageFile,
  PackageInfo,
  ProfileData,
  ProfileInfo,
  Settings,
  ToolInfo,
  getDefaultVariant,
} from "@common/types"
import { mapDefined } from "@common/utils/arrays"
import { loadConfig, readConfig, writeConfig } from "@node/configs"
import { download } from "@node/download"
import { extractRecursively } from "@node/extract"
import { get } from "@node/fetch"
import {
  copyTo,
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
import { PEFlag, getPEFlag, getPEHeader, setPEFlag, setPEHeader } from "@node/pe"
import { cmd } from "@node/processes"

import { getAssetKey } from "./data/assets"
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
import {
  CLEANITOL_EXTENSIONS,
  DIRNAMES,
  DOC_EXTENSIONS,
  FILENAMES,
  SC4_EXTENSIONS,
  SC4_INSTALL_PATHS,
  TEMPLATE_PREFIX,
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

export interface AppConfig {
  path?: string
}

export class Application {
  public assets: { [assetId: string]: AssetInfo | undefined } = {}
  public categories: { [categoryId: string]: CategoryInfo | undefined } = {}
  public features?: Partial<Record<Feature, string[]>>
  public ignoredWarnings = new Set<string>()
  public options?: OptionInfo[]
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
  public templates?: { [profileId: string]: ProfileInfo }

  public dirty: {
    packages?: { [packageId: string]: boolean } | boolean
    profiles?: { [profileId: string]: boolean } | boolean
    settings?: boolean
  } = {}

  public mainWindow?: MainWindow
  public splashScreen?: SplashScreen

  public readonly browserSession: Session = session.defaultSession

  public gamePath!: string
  // public rootPath!: string

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
      onTaskUpdate: tasks => {
        this.status.ongoingDownloads = tasks
        this.sendStatus()
      },
      parallel: 6,
    }),
    extract: new TaskManager("AssetExtractor", {
      onTaskUpdate: tasks => {
        this.status.ongoingExtracts = tasks
        this.sendStatus()
      },
      parallel: 6,
    }),
    getAsset: new TaskManager("AssetManager", {
      parallel: 30,
    }),
    install: new TaskManager("PackageInstaller", {
      parallel: 30,
    }),
    linker: new TaskManager("PackageLinker", {
      onTaskUpdate: tasks => {
        const task = tasks[0]
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
      },
    }),
    writer: new TaskManager("ConfigWriter"),
  }

  protected databaseUpdatePromise?: Promise<boolean>

  public constructor() {
    // Initialize translations
    initI18n(i18n)

    // Register message handlers
    this.handle("check4GBPatch")
    this.handle("cleanVariant")
    this.handle("createProfile")
    this.handle("getPackageReadme")
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
  }

  /**
   * Back up an external file from Plugins folder to Plugins (Backup)
   * @param context Task context
   * @param fullPath Absolute path to the file to back up
   */
  protected async backUpFile(context: TaskContext, fullPath: string): Promise<void> {
    const pluginsPath = this.getPluginsPath()
    const pluginsBackupPath = path.join(path.dirname(pluginsPath), DIRNAMES.pluginsBackup)
    const relativePath = path.relative(pluginsPath, fullPath)
    context.debug(`Backing up ${relativePath}...`)
    const targetPath = path.join(pluginsBackupPath, relativePath)
    await moveTo(fullPath, targetPath)
    this.externalFiles.delete(fullPath)
    // Clean up empty folders
    await removeIfEmptyRecursive(path.dirname(fullPath), pluginsPath)
  }

  /**
   * Back up an external file from Plugins folder to Plugins (Backup)
   * @param context Task context
   * @param fullPath Absolute path to the file to back up
   */
  public async check4GBPatch(isStartupCheck?: boolean): Promise<void> {
    let file: FileHandle | undefined

    try {
      console.info("Checking 4GB Patch...")
      if (this.settings?.install?.path) {
        const filePath = path.join(this.settings.install.path, FILENAMES.sc4exe)
        file = await fs.open(filePath, "r+") // read-write mode

        try {
          const header = await getPEHeader(file)
          const patched = getPEFlag(header, PEFlag.LARGE_ADDRESS_AWARE)
          if (patched) {
            console.info("4GB Patch is already applied")
            if (!this.settings.install.patched) {
              this.settings.install.patched = true
              this.writeSettings()
            }
          } else if (isStartupCheck && this.settings.install.patched === false) {
            // Skip startup check if "Do not ask again" was previously checked
          } else {
            delete this.settings.install.patched

            const [confirmed, doNotAskAgain] = await this.showConfirmation(
              t("Check4GBPatchModal:title"),
              t("Check4GBPatchModal:confirmation"),
              t("Check4GBPatchModal:description"),
              isStartupCheck,
            )

            if (confirmed) {
              try {
                // Create a backup
                await copyTo(filePath, filePath.replace(".exe", " (Backup).exe"))

                // Rewrite PE header
                setPEFlag(header, PEFlag.LARGE_ADDRESS_AWARE, true)
                await setPEHeader(file, header)
                await this.showSuccess(
                  t("Check4GBPatchModal:title"),
                  t("Check4GBPatchModal:success"),
                )
                this.settings.install.patched = true
              } catch (error) {
                console.error("Failed to apply the 4GB Patch", error)
                await this.showError(
                  t("Check4GBPatchModal:title"),
                  t("Check4GBPatchModal:failure"),
                  (error as Error).message,
                )
              }
            } else if (doNotAskAgain) {
              this.settings.install.patched = false
            }

            this.writeSettings()
          }
        } finally {
          await file.close()
        }
      }
    } catch (error) {
      console.error("Failed to check for 4GB Patch", error)
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
      if (this.settings.install.version !== version) {
        console.info(`Detected version ${version}`)
        this.settings.install.version = version
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
      for (const suggestedPath of SC4_INSTALL_PATHS) {
        if (await exists(path.join(suggestedPath, FILENAMES.sc4exe))) {
          console.info(`Detected installation path ${suggestedPath}`)
          installPath = suggestedPath
          installPathExists = true
          break
        }
      }
    }

    while (!installPathExists) {
      installPath = await this.showFolderSelector(
        t("SelectGameInstallFolderModal:title"),
        installPath,
      )

      if (installPath) {
        installPathExists = await exists(path.join(installPath, FILENAMES.sc4exe))
      } else {
        break
      }
    }

    if (this.settings && installPath !== this.settings.install?.path) {
      this.settings.install = { path: installPath }
      this.writeSettings()
    }

    if (installPath) {
      await this.check4GBPatch(true)
      await this.checkExeVersion()
    }
  }

  /**
   * Runs Cleanitol for all enabled packages.
   */
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

  /**
   * Runs Cleanitol for a single variant.
   */
  public async cleanVariant(packageId: string, variantId: string): Promise<void> {
    await this.tasks.linker.queue(`clean:${packageId}#${variantId}`, async context => {
      await this.doCleanVariant(context, packageId, variantId)
    })
  }

  /**
   * Creates and checks out a new profile.
   * @param name Profile name
   * @param fromProfileId ID of the profile to copy (create an empty profile otherwise)
   */
  public async createProfile(name: string, fromProfileId?: string): Promise<boolean> {
    if (!this.profiles || !this.settings) {
      return false
    }

    const profileId = createUniqueProfileId(name, Object.keys(this.profiles))

    const templateProfile = fromProfileId
      ? fromProfileId.startsWith(TEMPLATE_PREFIX)
        ? this.getProfileTemplate(fromProfileId)
        : this.getProfileInfo(fromProfileId)
      : undefined

    const profile: ProfileInfo = {
      features: {},
      options: {},
      packages: {},
      ...structuredClone(templateProfile),
      format: undefined,
      id: profileId,
      name,
    }

    this.profiles[profileId] = profile
    this.writeProfile(profileId)

    return this.switchProfile(profileId)
  }

  /**
   * Creates and returns the main window, if it does not already exist.
   */
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

  /**
   * Runs Cleanitol for a single variant (internal).
   */
  protected async doCleanVariant(
    context: TaskContext,
    packageId: string,
    variantId: string,
  ): Promise<void> {
    const packageInfo = this.getPackageInfo(packageId)
    const variantInfo = packageInfo?.variants[variantId]
    if (packageInfo && variantInfo) {
      context.debug(`Cleaning for package ${packageId}#${variantId}...`)

      const pluginsPath = this.getPluginsPath()
      const conflictingFiles = new Set<string>()

      const filenames = new Set(variantInfo.files?.map(file => path.basename(file.path)))

      if (variantInfo.cleanitol) {
        const variantPath = this.getVariantPath(packageId, variantId)
        const cleanitolPath = path.join(variantPath, variantInfo.cleanitol)

        const cleanitolFiles = await glob("*.txt", {
          cwd: cleanitolPath,
          dot: true,
          matchBase: true,
          nodir: true,
        })

        for (const cleanitolFile of cleanitolFiles) {
          const contents = await readFile(path.join(cleanitolPath, cleanitolFile))
          for (const line of contents.split("\n")) {
            const filename = line.split(";")[0].trim()

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

      if (conflictingFiles.size) {
        const fileNames = mapDefined(Array.from(conflictingFiles), file =>
          path.relative(pluginsPath, file),
        )

        const [confirmed] = await this.showConfirmation(
          packageInfo.name,
          t("RemoveConflictingFilesModal:confirmation"),
          t("RemoveConflictingFilesModal:description", {
            files: fileNames.sort(),
            pluginsBackup: DIRNAMES.pluginsBackup,
          }),
        )

        if (confirmed) {
          for (const conflictingFile of conflictingFiles) {
            await this.backUpFile(context, conflictingFile)
          }

          context.debug(`Resolved ${conflictingFiles.size} conflicts`)
        } else {
          context.debug(`Ignored ${conflictingFiles.size} conflicts`)
        }
      }
    }
  }

  /**
   * Downloads an asset.
   */
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
          expectedSha256: assetInfo.sha256,
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

  /**
   * Ensures an asset is downloaded/extracted, or download/extract it as needed.
   */
  protected async ensureAsset(assetInfo: AssetInfo): Promise<void> {
    return this.tasks.getAsset.queue(this.getDownloadKey(assetInfo), async () => {
      await this.downloadAsset(assetInfo)
      await this.extractFiles(assetInfo)
    })
  }

  /**
   * Recursively extracts archives inside a downloaded asset.
   */
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

  /**
   * Returns an asset's data by ID, if it exists.
   */
  public getAssetInfo(assetId: string): AssetInfo | undefined {
    return this.assets[assetId]
  }

  /**
   * Returns the current profile's data, if any.
   */
  public getCurrentProfile(): ProfileInfo | undefined {
    const profileId = this.settings?.currentProfile
    return profileId ? this.profiles?.[profileId] : undefined
  }

  /**
   * Returns the absolute path to the local database files:
   * - When using a Git repository, returns the path to the local clone.
   * - When using a local repository, returns the path to the repository itself.
   */
  public getDatabasePath(): string {
    const repository = this.getDataRepository()
    return isURL(repository) ? path.join(this.getRootPath(), DIRNAMES.db) : repository
  }

  /**
   * Returns the absolute path or Git URL to the current data repository.
   */
  public getDataRepository(): string {
    // TODO: Make this overridable through Settings
    const repository = env.DATA_REPOSITORY
    return isURL(repository) ? repository : path.resolve(__dirname, "../..", env.DATA_REPOSITORY)
  }

  /**
   * Returns the default config format.
   */
  public getDefaultConfigFormat(): ConfigFormat {
    return this.settings?.useYaml === false ? ConfigFormat.JSON : ConfigFormat.YAML
  }

  /**
   * Returns the download cache key for an asset.
   */
  protected getDownloadKey(assetInfo: AssetInfo): string {
    return getAssetKey(assetInfo.id, assetInfo.version)
  }

  /**
   * Returns the download cache absolute path for a given key.
   */
  public getDownloadPath(key: string): string {
    return path.join(this.getDownloadsPath(), key)
  }

  /**
   * Returns the absolute path to the download cache directory.
   */
  public getDownloadsPath(): string {
    return path.join(this.getRootPath(), DIRNAMES.downloads)
  }

  /**
   * Returns the current log level.
   */
  public getLogLevel(): LogLevel {
    if (env.LOG_LEVEL && log.levels.includes(env.LOG_LEVEL)) {
      return env.LOG_LEVEL as LogLevel
    } else {
      return isDev() ? "debug" : "info"
    }
  }

  /**
   * Returns the absolute path to the main log file.
   */
  public getLogsFile(): string {
    return path.join(this.getRootPath(), DIRNAMES.logs, FILENAMES.logs)
  }

  /**
   * Returns the absolute path to the log directory.
   */
  public getLogsPath(): string {
    return path.join(this.getRootPath(), DIRNAMES.logs)
  }

  /**
   * Returns the main README file for a given variant, as an HTML string.
   */
  public async getPackageReadme(
    packageId: string,
    variantId: string,
  ): Promise<{ html?: string; md?: string }> {
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
        const pathname = toPosix(path.relative(this.getRootPath(), src))
        return {
          html: `<iframe height="100%" width="100%" sandbox="allow-popups" src="docs://sc4-plugin-manager/${pathname}" title="Documentation"></iframe>`,
        }
      }

      case ".md": {
        const contents = await fs.readFile(docPath, "utf8")
        return {
          md: contents,
        }
      }

      case ".txt": {
        const contents = escapeHtml(await fs.readFile(docPath, "utf8"))
        return {
          html: `<pre style="height: 100%; margin: 0; overflow: auto; padding: 16px; white-space: pre-wrap">${contents}</pre>`,
        }
      }

      // TODO: Support PDF? (Is any package using that?)
      default:
        throw Error(`Unsupported documentation format ${docExt}`)
    }
  }

  /**
   * Returns a package's data by ID, if it exists.
   */
  public getPackageInfo(packageId: string): PackageInfo | undefined {
    return this.packages?.[packageId]
  }

  /**
   * Returns the absolute package to an installed package, by ID.
   */
  public getPackagePath(packageId: string): string {
    return path.join(this.getRootPath(), DIRNAMES.packages, packageId)
  }

  /**
   * Returns the absolute package to the Packages directory.
   */
  public getPackagesPath(): string {
    return path.join(this.getRootPath(), DIRNAMES.packages)
  }

  /**
   * Returns the absolute package to the Plugins directory.
   */
  public getPluginsPath(): string {
    return path.join(this.gamePath, DIRNAMES.plugins)
  }

  /**
   * Returns a profile's data by ID, if it exists.
   */
  public getProfileInfo(profileId: string): ProfileInfo | undefined {
    return this.profiles?.[profileId]
  }

  /**
   * Returns the absolute package to the Profiles directory.
   */
  public getProfilesPath(): string {
    return path.join(this.getRootPath(), DIRNAMES.profiles)
  }

  /**
   * Returns a profile template by ID, if it exists.
   */
  public getProfileTemplate(profileId: string): ProfileInfo | undefined {
    return this.templates?.[profileId]
  }

  /**
   * Returns the absolute package to the Manager directory.
   */
  public getRootPath(): string {
    return path.join(this.gamePath, DIRNAMES.root)
  }

  /**
   * Returns the current state to synchronize with renderer.
   */
  public getState(): ApplicationState {
    return {
      categories: this.categories,
      features: this.features,
      options: this.options,
      packages: this.packages,
      profiles: this.profiles,
      sessions: {
        simtropolis: {
          userId: this.sessions.simtropolis && this.sessions.simtropolis.userId,
        },
      },
      settings: this.settings,
      status: this.status,
      templates: this.templates,
    }
  }

  /**
   * Returns the temporary download path for a given key.
   */
  public getTempDownloadPath(key: string): string {
    return path.join(this.getTempPath(), DIRNAMES.downloads, key)
  }

  /**
   * Returns the absolute package to the temporary download directory.
   */
  public getTempPath(): string {
    return path.join(this.getRootPath(), DIRNAMES.temp)
  }

  /**
   * Returns the absolute package to the Templates data directory.
   */
  public getTemplatesPath(): string {
    return path.join(this.getDatabasePath(), DIRNAMES.templates)
  }

  /**
   * Returns the path to the given tool's executable, downloading the tool as needed.
   */
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

  /**
   * Returns a tool's data, if it exists.
   */
  public getToolInfo(tool: string): ToolInfo | undefined {
    return TOOLS[tool as keyof typeof TOOLS]
  }

  /**
   * Returns the absolute path to a variant's files.
   */
  public getVariantPath(packageId: string, variantId: string): string {
    return path.join(this.getPackagePath(packageId), variantId)
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

    // Load categories...
    this.status.loader = "Loading categories..."
    this.sendStatus()
    await this.loadCategories()
    this.sendCategories()

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
          t("BackupPluginsModal:title"),
          t("BackupPluginsModal:confirmation", {
            plugins: DIRNAMES.plugins,
          }),
          t("BackupPluginsModal:description", {
            plugins: DIRNAMES.plugins,
          }),
        )

        if (doBackup) {
          try {
            // Rename folder, then recreate new empty one
            await moveTo(pluginsPath, pluginsBackupPath)
            await createIfMissing(pluginsPath)
            await this.showSuccess(
              t("BackupPluginsModal:title"),
              t("BackupPluginsModal:success", {
                plugins: DIRNAMES.plugins,
                pluginsBackup: DIRNAMES.pluginsBackup,
              }),
            )
          } catch (error) {
            console.error(`Failed to backup ${DIRNAMES.plugins} folder`, error)

            await this.showSuccess(
              t("BackupPluginsModal:title"),
              t("BackupPluginsModal:failure", {
                plugins: DIRNAMES.plugins,
              }),
              (error as Error).message,
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
    this.packages = await loadLocalPackages(this.getPackagesPath(), this.categories, (c, t) => {
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

    // Load profile options...
    await this.loadOptions()
    this.sendOptions()

    // Load remote packages...
    const remote = await loadRemotePackages(this.getDatabasePath(), this.categories, (c, t) => {
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

    // Templates are loaded in the background
    const loadTemplatesPromise = this.loadTemplates()

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
      // await this.cleanAll()
    }

    await loadTemplatesPromise
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
        await Promise.all(assetInfos.map(this.ensureAsset.bind(this)))

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

            const conditionRegex = /{{([^}]+)}}/g

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
              priority?: number,
              condition?: { [feature in Feature]?: boolean },
            ) => {
              const extension = getExtension(oldPath)

              if (!DOC_EXTENSIONS.includes(extension) && !SC4_EXTENSIONS.includes(extension)) {
                console.warn(`Ignoring file ${oldPath} with unsupported extension ${extension}`)
              }

              switch (type) {
                case "cleanitol": {
                  if (CLEANITOL_EXTENSIONS.includes(extension)) {
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
                  if (DOC_EXTENSIONS.includes(extension)) {
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
                  if (SC4_EXTENSIONS.includes(extension)) {
                    if (files.has(newPath)) {
                      context.raiseInDev(`Ignoring file ${oldPath} trying to unpack at ${newPath}`)
                    } else {
                      const targetPath = path.join(variantPath, newPath)
                      await createIfMissing(path.dirname(targetPath))
                      await fs.symlink(path.join(downloadPath, oldPath), targetPath)
                      files.set(newPath, {
                        condition,
                        path: newPath,
                        priority: priority !== variantInfo.priority ? priority : undefined,
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
              priority?: number,
              condition?: { [feature in Feature]?: boolean },
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
                  priority,
                  condition,
                )
              }
            }

            const includePath = async (
              pattern: string,
              type: "cleanitol" | "docs" | "files",
              include?: PackageFile,
            ) => {
              const entries = await glob(pattern.replace(conditionRegex, "*"), {
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

                let condition = include?.condition

                if (pattern.match(conditionRegex)) {
                  const regex = new RegExp(
                    "^" +
                      (pattern.includes("/") ? "" : "(?:.*[\\\\/])?") +
                      pattern
                        .replace(/[$()+.[\]^|]/g, "\\$&")
                        .replaceAll("/", "[\\\\/]")
                        .replaceAll("**", ".*")
                        .replaceAll("*", "[^\\\\/]*")
                        .replaceAll("?", "[^\\\\/]?")
                        .replace(conditionRegex, "(?<$1>[^\\\\/]*)") +
                      "$",
                  )

                  condition = {
                    ...condition,
                    ...regex.exec(oldPath)?.groups,
                  }
                }

                if (entry.isDirectory()) {
                  await includeDirectory(
                    oldPath,
                    include?.as ?? "",
                    type,
                    include?.priority,
                    condition,
                  )
                } else {
                  const filename = path.basename(entry.name)
                  await includeFile(
                    oldPath,
                    include?.as?.replace("*", filename) ?? filename,
                    type,
                    include?.priority,
                    condition,
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
                  excludePath(path.replace(conditionRegex, "*"))
                } else {
                  await includePath(include.path, "files", include)
                  excludePath(include.path.replace(conditionRegex, "*"))
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

  /**
   * Launches the application.
   */
  public async launch(): Promise<void> {
    // Initialize app config
    await this.loadAppConfig()

    // Initialize logs
    app.setPath("logs", this.getLogsPath())
    log.transports.console.level = this.getLogLevel()
    log.transports.file.level = this.getLogLevel()
    log.transports.file.resolvePathFn = this.getLogsFile.bind(this)
    Object.assign(console, log.functions)

    // Initialize custom protocols
    handleDocsProtocol(this.getRootPath(), DOC_EXTENSIONS)

    this.setApplicationMenu()
    await this.initialize()
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

    const profileInfo = this.getCurrentProfile()
    if (profileInfo) {
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

          let nPackages = 0
          const nTotalPackages = Object.keys(this.packages!).length
          const increment = Math.floor(nTotalPackages / 100)

          for (const packageId in this.packages) {
            const packageInfo = this.packages[packageId]
            const status = packageInfo.status[profileInfo.id]
            if (status?.enabled) {
              const variantId = status.variantId
              const variantInfo = packageInfo.variants[variantId]
              if (variantInfo) {
                const variantPath = this.getVariantPath(packageId, variantId)
                if (variantInfo.files?.length) {
                  for (const file of variantInfo.files) {
                    if (
                      checkCondition(
                        file.condition,
                        packageId,
                        variantInfo,
                        profileInfo,
                        this.options,
                        this.features,
                      )
                    ) {
                      const fullPath = path.join(variantPath, file.path)
                      const priority = file.priority ?? variantInfo.priority

                      // DLL files must be in Plugins root
                      const targetPath = file.path.match(/\.(dll|ini)$/i)
                        ? path.join(pluginsPath, path.basename(file.path))
                        : path.join(pluginsPath, getPriorityLabel(priority), packageId, file.path)

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

                  if (variantInfo.options) {
                    const configFiles: { [filename: string]: OptionInfo[] } = {}
                    for (const option of variantInfo.options) {
                      if (option.filename) {
                        configFiles[option.filename] ??= []
                        configFiles[option.filename].push(option)
                      }
                    }

                    for (const filename in configFiles) {
                      let ini = ""
                      let lastSection = ""
                      for (const option of configFiles[filename]) {
                        const [section, field] = option.id.split(".", 2)
                        if (section !== lastSection) {
                          ini += `[${section}]\n`
                          lastSection = section
                        }

                        const value = getOptionValue(option, {
                          ...profileInfo.options,
                          ...profileInfo.packages[packageId]?.options,
                        })

                        ini += `${field}=${value}\n`
                      }

                      if (ini) {
                        const targetPath = path.join(pluginsPath, filename)
                        await writeFile(targetPath, ini, "utf8")
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

  protected async loadAppConfig(): Promise<void> {
    const configPath = app.getPath("userData")
    const config = await loadConfig<AppConfig>(configPath, FILENAMES.appConfig)
    const data = config?.data ?? {}

    // Auto-detect game data path
    const defaultGamePath = path.join(app.getPath("documents"), "SimCity 4")
    this.gamePath = env.GAME_DIR || data.path || defaultGamePath

    // Fix invalid game data path
    while (!(await exists(this.getPluginsPath()))) {
      const result = await this.showFolderSelector(
        t("SelectGameDataFolderModal:title", { plugins: DIRNAMES.plugins }),
        app.getPath("documents"),
      )

      if (result) {
        this.gamePath = result
      } else {
        throw Error("Aborted")
      }
    }

    if (this.gamePath !== data.path) {
      data.path = this.gamePath
      await writeConfig(configPath, FILENAMES.appConfig, data, ConfigFormat.JSON, config?.format)
    }
  }

  protected async loadCategories(): Promise<{ [categoryId: string]: CategoryInfo | undefined }> {
    console.debug("Loading categories...")

    const config = await loadConfig<{ [categoryId: string]: CategoryInfo | undefined }>(
      this.getDatabasePath(),
      FILENAMES.dbCategories,
    )

    this.categories = config?.data ?? {}

    console.info(`Loaded ${Object.keys(this.categories).length} categories`)

    return this.categories
  }

  protected async loadOptions(): Promise<OptionInfo[]> {
    console.debug("Loading options...")

    const config = await loadConfig<{ options: OptionInfo[] }>(
      this.getDatabasePath(),
      FILENAMES.dbOptions,
    )

    this.options = config?.data.options ?? []

    console.info(`Loaded ${this.options.length} options`)

    return this.options
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

    const config = await loadConfig<Settings>(this.getRootPath(), FILENAMES.settings)

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

  protected async loadTemplates(): Promise<{ [id: string]: ProfileInfo }> {
    console.debug("Loading profile templates")

    let nTemplates = 0
    this.templates = {}

    const templatesPath = this.getTemplatesPath()
    await createIfMissing(templatesPath)

    const entries = await fs.readdir(templatesPath, { withFileTypes: true })
    for (const entry of entries) {
      const format = path.extname(entry.name) as ConfigFormat
      if (entry.isFile() && Object.values(ConfigFormat).includes(format)) {
        const profileId = TEMPLATE_PREFIX + path.basename(entry.name, format)
        const profilePath = path.join(templatesPath, entry.name)
        if (this.templates[profileId]) {
          console.warn(`Duplicate profile template '${entry.name}'`)
          continue
        }

        try {
          const data = await readConfig<ProfileData>(profilePath)
          const profile = fromProfileData(profileId, data)
          profile.format = format
          this.templates[profileId] = profile
          nTemplates++
        } catch (error) {
          console.warn(`Invalid profile template '${entry.name}'`, error)
        }
      }
    }

    console.debug(`Loaded ${nTemplates} profile templates`)
    this.sendTemplates()

    return this.templates
  }

  /**
   * Opens the game's executable directory in Explorer.
   */
  public async openExecutableDirectory(): Promise<boolean> {
    if (this.settings?.install?.path) {
      this.openInExplorer(path.dirname(path.join(this.settings.install.path, FILENAMES.sc4exe)))
      return true
    }

    return false
  }

  /**
   * Opens a file in the default editor or a directory in Explorer.
   */
  protected async openInExplorer(fullPath: string): Promise<void> {
    await cmd(`explorer "${fullPath}"`)
  }

  /**
   * Opens the game's installation directory in Explorer.
   */
  public async openInstallationDirectory(): Promise<boolean> {
    if (this.settings?.install?.path) {
      this.openInExplorer(this.settings.install.path)
      return true
    }

    return false
  }

  /**
   * Opens a package's config file in the default text editor.
   */
  public async openPackageConfig(packageId: string): Promise<boolean> {
    const packageInfo = this.getPackageInfo(packageId)
    const packagePath = this.getPackagePath(packageId)
    if (packageInfo?.format) {
      this.openInExplorer(path.join(packagePath, FILENAMES.packageConfig + packageInfo.format))
      return true
    }

    return false
  }

  /**
   * Opens a variant's file in the default text editor.
   */
  public async openPackageFile(
    packageId: string,
    variantId: string,
    filePath: string,
  ): Promise<boolean> {
    this.openInExplorer(path.join(this.getVariantPath(packageId, variantId), filePath))
    return true
  }

  /**
   * Opens a profile's config file in the default text editor.
   */
  public async openProfileConfig(profileId: string): Promise<boolean> {
    const profileInfo = this.getProfileInfo(profileId)
    if (profileInfo?.format) {
      this.openInExplorer(path.join(this.getProfilesPath(), profileId + profileInfo.format))
      return true
    }

    return false
  }

  /**
   * Opens a variant's repository in browser, if present.
   */
  public async openVariantRepository(packageId: string, variantId: string): Promise<boolean> {
    const variantInfo = this.getPackageInfo(packageId)?.variants[variantId]
    if (variantInfo?.repository) {
      await this.openInExplorer(variantInfo.repository)
      return true
    }

    return false
  }

  /**
   * Opens a variant's homepage in browser, if present.
   */
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

  /**
   * Recalculates package status/compatibility for the given profile.
   */
  protected async recalculatePackages(profileId: string): Promise<void> {
    const profile = this.getProfileInfo(profileId)
    if (!this.packages || !profile) {
      return
    }

    const { resultingFeatures, resultingStatus } = resolvePackages(
      this.packages,
      profile.packages,
      profile.options,
      profile.features,
    )

    this.features = resultingFeatures
    for (const packageId in resultingStatus) {
      this.packages[packageId].status[profileId] = resultingStatus[packageId]
    }

    this.sendPackages()

    // Trigger linking
    await this.linkPackages()
  }

  /**
   * Resets and reloads data from files.
   */
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

  /**
   * Remove installed variants. If any variant is enabled in the current profile, it will be disabled first.
   * @param packages map of package ID to variant ID
   * @returns whether action was successful (i.e. not cancelled by user)
   */
  public async removePackages(packages: { [packageId: string]: string }): Promise<boolean> {
    // TODO: ATM this does not clean obsolete files from Downloads sub-folder!

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
        const namespace = isOnlyInstalledVariant ? "RemovePackageModal" : "RemoveVariantModal"

        if (variantInfo.local) {
          const [confirmed] = await this.showConfirmation(
            packageInfo.name,
            t(`${namespace}:confirmation`),
            t(`${namespace}:description`, {
              packageName: packageInfo.name,
              variantName: variantInfo.name,
            }),
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

  protected sendCategories(): void {
    this.sendStateUpdate({ categories: this.categories })
  }

  protected sendOptions(): void {
    this.sendStateUpdate({ options: this.options })
  }

  protected sendPackage(packageId: string): void {
    this.sendStateUpdate({ packages: { [packageId]: this.getPackageInfo(packageId) ?? null } })
  }

  protected sendPackages(): void {
    this.sendStateUpdate({ features: this.features, packages: this.packages })
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

  protected sendTemplates(): void {
    this.sendStateUpdate({ templates: this.templates })
  }

  protected setApplicationMenu(): void {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          role: "fileMenu",
          submenu: [
            {
              // Register Ctrl+R as Reload command
              accelerator: "CmdOrCtrl+R",
              click: () => this.reload(),
              label: t("reload"),
            },
            {
              // Register Ctrl+Q as Quit command
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

  /**
   * Shows a system confirmation dialog.
   * @param doNotAskAgain whether to show a "Do not ask again" checkbox
   * @returns whether the action was confirmed, and whether "Do not ask again" was checked
   */
  protected async showConfirmation(
    title: string,
    message: string,
    detail?: string,
    doNotAskAgain?: boolean,
    type: "question" | "warning" = "question",
  ): Promise<[confirmed: boolean, doNotAskAgain: boolean]> {
    const options: MessageBoxOptions = {
      buttons: [t("yes"), t("no")],
      cancelId: 1,
      checkboxChecked: false,
      checkboxLabel: doNotAskAgain ? t("doNotAskAgain") : undefined,
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

  /**
   * Shows a system error dialog.
   */
  protected async showError(title: string, message: string, detail?: string): Promise<void> {
    const options: MessageBoxOptions = { detail, message, title, type: "error" }
    if (this.mainWindow) {
      await dialog.showMessageBox(this.mainWindow, options)
    } else {
      await dialog.showMessageBox(options)
    }
  }

  /**
   * Shows a system folder selector.
   * @returns the absolute path to the selected folder, or undefined if the dialog was closed without selection.
   */
  protected async showFolderSelector(
    title: string,
    defaultPath?: string,
  ): Promise<string | undefined> {
    const options: OpenDialogOptions = { title, defaultPath, properties: ["openDirectory"] }
    if (this.mainWindow) {
      const result = await dialog.showOpenDialog(this.mainWindow, options)
      return result.filePaths[0]
    } else {
      const result = await dialog.showOpenDialog(options)
      return result.filePaths[0]
    }
  }

  /**
   * Shows a system success dialog.
   */
  protected async showSuccess(title: string, message: string, detail?: string): Promise<void> {
    const options: MessageBoxOptions = { detail, message, title, type: "info" }
    if (this.mainWindow) {
      await dialog.showMessageBox(this.mainWindow, options)
    } else {
      await dialog.showMessageBox(options)
    }
  }

  /**
   * Initiates a login to Simtropolis.
   */
  public async simtropolisLogin(): Promise<void> {
    const session = await simtropolisLogin(this.browserSession)
    if (session) {
      console.info("Logged in to Simtropolis")
      this.sessions.simtropolis = session
      this.sendSessions()
    }
  }

  /**
   * Logs out of Simtropolis.
   */
  public async simtropolisLogout(): Promise<void> {
    await simtropolisLogout(this.browserSession)
    console.info("Logged out from Simtropolis")
    this.sessions.simtropolis = null
    this.sendSessions()
  }

  /**
   * Checks out a profile by ID.
   */
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

  /**
   * Attempts to pull latest data from the remote Git repository.
   */
  protected async tryUpdateDatabase(): Promise<boolean> {
    if (!this.databaseUpdatePromise) {
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
    if (!this.options || !this.packages || !profile) {
      return false
    }

    // Changes to packages/externals require conflict computation and potential side-effects / confirmation
    if (update.features || update.options || update.packages) {
      update.features ??= {}
      update.options ??= {}
      update.packages ??= {}

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
        resultingFeatures,
        resultingOptions,
        resultingStatus,
        shouldRecalculate,
      } = resolvePackageUpdates(
        this.packages,
        profile,
        this.options,
        update.packages,
        update.options,
        update.features,
      )

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
            // TODO: Use our own modal rather than system one?
            const options: MessageBoxOptions = {
              buttons: [
                t("ReplaceExternalPackagesModal:confirm"),
                t("ReplaceExternalPackagesModal:ignore"),
                t("ReplaceExternalPackagesModal:cancel"),
              ],
              cancelId: 2,
              defaultId: 0,
              detail: t("ReplaceExternalPackagesModal:description", {
                features: incompatibleExternals
                  .map(feature => getFeatureLabel(t, feature, "long"))
                  .sort(),
              }),
              message: t("ReplaceExternalPackagesModal:confirmation"),
              noLink: true,
              title: t("ReplaceExternalPackagesModal:title"),
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
              for (const feature of incompatibleExternals) {
                update.features[feature] = true
              }
            }

            // Disable conflicted externals
            if (result.response === 0) {
              for (const feature of incompatibleExternals) {
                update.features[feature] = false
              }

              // Recalculate
              return this.updateProfile(profileId, update)
            }
          }

          // Confirm fully-incompatible packages
          if (incompatiblePackages.length) {
            const packageNames = mapDefined(
              incompatiblePackages,
              id => this.getPackageInfo(id)?.name,
            )

            // TODO: Use our own modal rather than system one?
            const options: MessageBoxOptions = {
              buttons: [
                t("DisableIncompatiblePackagesModal:confirm"),
                t("DisableIncompatiblePackagesModal:ignore"),
                t("DisableIncompatiblePackagesModal:cancel"),
              ],
              cancelId: 2,
              defaultId: 0,
              detail: t("DisableIncompatiblePackagesModal:description", {
                packages: packageNames.sort(),
              }),
              message: t("DisableIncompatiblePackagesModal:confirmation"),
              noLink: true,
              title: t("DisableIncompatiblePackagesModal:title"),
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
            const variants = Object.entries(explicitVariantChanges).map(
              ([packageId, [oldVariantId, newVariantId]]) => {
                const packageInfo = this.getPackageInfo(packageId)!
                const oldVariant = packageInfo.variants[oldVariantId]
                const newVariant = packageInfo.variants[newVariantId]
                return t("InstallCompatibleVariantsModal:variant", {
                  newVariantName: newVariant.name,
                  oldVariantName: oldVariant.name,
                  packageName: packageInfo.name,
                })
              },
            )

            // TODO: Use our own modal rather than system one?
            const options: MessageBoxOptions = {
              buttons: [
                t("InstallCompatibleVariantsModal:confirm"),
                t("InstallCompatibleVariantsModal:ignore"),
                t("InstallCompatibleVariantsModal:cancel"),
              ],
              cancelId: 2,
              defaultId: 0,
              detail: t("InstallCompatibleVariantsModal:description", {
                variants: variants.sort(),
              }),
              message: t("InstallCompatibleVariantsModal:confirmation"),
              noLink: true,
              title: t("InstallCompatibleVariantsModal:title"),
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
              const dependencyNames = mapDefined(dependencyIds, id => this.getPackageInfo(id)?.name)

              // TODO: Use our own modal rather than system one?
              const [confirmed] = await this.showConfirmation(
                packageInfo.name,
                t("EnableOptionalDependencies:confirmation"),
                t("EnableOptionalDependencies:description", {
                  dependencies: dependencyNames.sort(),
                  packageName: packageInfo.name,
                }),
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
                  if (!warning.id || !this.ignoredWarnings.has(warning.id)) {
                    const packageName = packageInfo.name

                    // TODO: Use our own modal rather than system one?
                    const [confirmed, doNotAskAgain] = await this.showConfirmation(
                      packageInfo.name,
                      t("EnableWarningModal:confirmation"),
                      warning.message ?? t(warning.id!, { ns: "Warning", packageName }),
                      !!warning.id,
                      "warning",
                    )

                    if (doNotAskAgain && warning.id) {
                      this.ignoredWarnings.add(warning.id)
                    }

                    if (!confirmed) {
                      return false
                    }
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
                  if (!warning.id || !this.ignoredWarnings.has(warning.id)) {
                    const packageName = packageInfo.name

                    // TODO: Use our own modal rather than system one?
                    const [confirmed, doNotAskAgain] = await this.showConfirmation(
                      packageInfo.name,
                      t("DisableWarningModal:confirmation"),
                      warning.message ?? t(warning.id!, { ns: "Warning", packageName }),
                      !!warning.id,
                      "warning",
                    )

                    if (doNotAskAgain && warning.id) {
                      this.ignoredWarnings.add(warning.id)
                    }

                    if (!confirmed) {
                      return false
                    }
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
              const assets = Array.from(missingAssets.values())
              const dependencyNames = mapDefined(
                installingDependencyIds,
                id => this.getPackageInfo(id)?.name,
              )

              const totalSize = assets.reduce(
                (total, asset) => (asset.size ? total + asset.size : NaN),
                0,
              )

              // TODO: Use our own modal rather than system one?
              const [confirmed] = await this.showConfirmation(
                t("DownloadAssetsModal:title"),
                t("DownloadAssetsModal:confirmation"),
                dependencyNames.length
                  ? [
                      t("DownloadAssetsModal:descriptionDependencies", {
                        dependencies: dependencyNames.sort(),
                        count: dependencyNames.length,
                      }),
                      t("DownloadAssetsModal:descriptionAssetsWithDependencies", {
                        assets: assets.map(asset => asset.id).sort(),
                        count: assets.length,
                        totalSize,
                      }),
                    ].join("\n\n")
                  : t("DownloadAssetsModal:descriptionAssets", {
                      assets: assets.map(asset => asset.id).sort(),
                      count: assets.length,
                      totalSize,
                    }),
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
        profile.features = resultingExternals
        profile.options = resultingOptions
        profile.packages = resultingConfigs
        this.features = resultingFeatures

        // Apply status changes
        for (const packageId in resultingStatus) {
          this.packages[packageId].status[profileId] = resultingStatus[packageId]
        }

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

        this.sendPackages()
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

        await writeConfig<Settings>(
          this.getRootPath(),
          FILENAMES.settings,
          data,
          newFormat,
          oldFormat,
        )

        settings.format = newFormat
        this.sendSettings()
      },
      { invalidate: true },
    )
  }
}
