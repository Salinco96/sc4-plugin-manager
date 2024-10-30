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

import { AssetID, AssetInfo, Assets } from "@common/assets"
import { AuthorID, AuthorInfo, Authors } from "@common/authors"
import { Categories } from "@common/categories"
import { DBPFDataType, DBPFEntryData, DBPFFile, TGI } from "@common/dbpf"
import {
  ExemplarDataPatch,
  ExemplarPropertyData,
  ExemplarPropertyInfo,
  ExemplarValueType,
} from "@common/exemplars"
import { Translations, getFeatureLabel, i18n, initI18n, t } from "@common/i18n"
import { OptionInfo, Requirements, getOptionValue } from "@common/options"
import {
  ProfileData,
  ProfileID,
  ProfileInfo,
  ProfileUpdate,
  Profiles,
  createUniqueId,
} from "@common/profiles"
import { Settings } from "@common/settings"
import { ApplicationState, ApplicationStateUpdate, getInitialState } from "@common/state"
import {
  ConfigFormat,
  PackageConfig,
  PackageFile,
  PackageInfo,
  PackageStatus,
  PackageWarning,
} from "@common/types"
import { flatMap, mapDefined, sumBy, unique } from "@common/utils/arrays"
import { globToRegex, matchConditions } from "@common/utils/glob"
import { readHex } from "@common/utils/hex"
import {
  entries,
  forEach,
  forEachAsync,
  isEmpty,
  keys,
  mapValues,
  size,
  values,
} from "@common/utils/objects"
import { VariantID, VariantInfo } from "@common/variants"
import { loadConfig, readConfig, writeConfig } from "@node/configs"
import { loadDBPF, loadDBPFEntry, patchDBPFEntries } from "@node/dbpf"
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
  openFile,
  readFile,
  removeIfEmptyRecursive,
  removeIfPresent,
  toPosix,
} from "@node/files"
import { PEFlag, getPEFlag, getPEHeader, setPEFlag, setPEHeader } from "@node/pe"
import { cmd } from "@node/processes"
import { getPluginsFolderName } from "@utils/linker"
import { ToolID, getToolInfo } from "@utils/tools"

import { PackageID, checkFile, isDependency, isEnabled, isIncompatible } from "../common/packages"

import { getAssetKey } from "./data/assets"
import { AppConfig } from "./data/config"
import {
  loadDownloadedAssets,
  loadLocalPackages,
  loadRemotePackages,
  mergeLocalPackageInfo,
  writePackageConfig,
} from "./data/packages"
import { getDefaultVariant, resolvePackageUpdates, resolvePackages } from "./data/packages/resolve"
import { compactProfileConfig, fromProfileData, toProfileData } from "./data/profiles/configs"
import { defaultSettings } from "./data/settings"
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
  getSimtropolisSession,
  getSimtropolisSessionCookies,
  simtropolisLogin,
  simtropolisLogout,
} from "./utils/sessions/simtropolis"
import { TaskContext, TaskManager } from "./utils/tasks"

export class Application {
  public state: ApplicationState = getInitialState()

  public assets: Assets = {}
  public ignoredWarnings = new Set<string>()

  public mainWindow?: MainWindow
  public splashScreen?: SplashScreen

  public readonly browserSession: Session = session.defaultSession
  public readonly translations: { [lng: string]: Translations } = {}

  public gamePath!: string

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
        this.state.status.ongoingDownloads = tasks
        this.sendStatus()
      },
      parallel: 6,
    }),
    extract: new TaskManager("AssetExtractor", {
      onTaskUpdate: tasks => {
        this.state.status.ongoingExtracts = tasks
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
          this.state.status.linker = `Initializing...${task.progress ? ` (${task.progress.toFixed(0)}%)` : ""}`
        } else if (task?.key === "link") {
          this.state.status.linker = `Linking packages...${task.progress ? ` (${task.progress.toFixed(0)}%)` : ""}`
        } else if (task?.key === "clean:all") {
          this.state.status.linker = `Checking for conflicts...${task.progress ? ` (${task.progress.toFixed(0)}%)` : ""}`
        } else {
          this.state.status.linker = null
        }

        this.sendStatus()
      },
    }),
    writer: new TaskManager("ConfigWriter"),
  }

  protected databaseUpdatePromise?: Promise<boolean>

  public constructor() {
    // Register message handlers
    this.handle("check4GBPatch")
    this.handle("cleanVariant")
    this.handle("clearPackageLogs")
    this.handle("createProfile")
    this.handle("createVariant")
    this.handle("getPackageLogs")
    this.handle("getPackageReadme")
    this.handle("getState")
    this.handle("installPackages")
    this.handle("loadDBPFEntries")
    this.handle("loadDBPFEntry")
    this.handle("openAuthorURL")
    this.handle("openExecutableDirectory")
    this.handle("openInstallationDirectory")
    this.handle("openPackageConfig")
    this.handle("openPackageFile")
    this.handle("openProfileConfig")
    this.handle("openVariantRepository")
    this.handle("openVariantURL")
    this.handle("patchDBPFEntries")
    this.handle("removePackages")
    this.handle("simtropolisLogin")
    this.handle("simtropolisLogout")
    this.handle("switchProfile")
    this.handle("updateProfile")

    // Initialize translations
    initI18n(i18n)
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
      if (this.state.settings?.install?.path) {
        const filePath = path.join(this.state.settings.install.path, FILENAMES.sc4exe)
        file = await fs.open(filePath, "r+") // read-write mode

        try {
          const header = await getPEHeader(file)
          const patched = getPEFlag(header, PEFlag.LARGE_ADDRESS_AWARE)
          if (patched) {
            console.info("4GB Patch is already applied")
            if (!this.state.settings.install.patched) {
              this.state.settings.install.patched = true
              this.writeSettings()
            }
          } else if (isStartupCheck && this.state.settings.install.patched === false) {
            // Skip startup check if "Do not ask again" was previously checked
          } else {
            delete this.state.settings.install.patched

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
                this.state.settings.install.patched = true
              } catch (error) {
                console.error("Failed to apply the 4GB Patch", error)
                await this.showError(
                  t("Check4GBPatchModal:title"),
                  t("Check4GBPatchModal:failure"),
                  (error as Error).message,
                )
              }
            } else if (doNotAskAgain) {
              this.state.settings.install.patched = false
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
    if (this.state.settings?.install?.path) {
      const exePath = path.join(this.state.settings.install.path, FILENAMES.sc4exe)

      const stdout = await cmd(
        `wmic datafile where "name='${exePath.replace(/[\\'"]/g, "\\$&")}'" get version`,
      )

      const match = stdout.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/)
      if (!match) {
        throw Error("Failed to detect executable version")
      }

      const version = match[0]
      if (this.state.settings.install.version !== version) {
        console.info(`Detected version ${version}`)
        this.state.settings.install.version = version
        this.writeSettings()
      }
    }
  }

  protected async checkGameInstall(): Promise<void> {
    let installPath = this.state.settings?.install?.path
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

    if (this.state.settings && installPath !== this.state.settings.install?.path) {
      this.state.settings.install = { path: installPath }
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

      if (this.state.packages && currentProfile) {
        let nPackages = 0
        const nTotalPackages = Object.keys(this.state.packages).length
        const increment = Math.floor(nTotalPackages / 100)
        for (const packageId of keys(this.state.packages)) {
          const packageStatus = this.getPackageStatus(packageId)
          if (packageStatus?.included) {
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
  public async cleanVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    await this.tasks.linker.queue(`clean:${packageId}#${variantId}`, async context => {
      await this.doCleanVariant(context, packageId, variantId)
    })
  }

  /**
   * Creates and checks out a new profile.
   * @param name Profile name
   * @param fromProfileId ID of the profile to copy (create an empty profile otherwise)
   */
  public async createProfile(name: string, fromProfileId?: ProfileID): Promise<boolean> {
    if (!this.state.profiles || !this.state.settings) {
      return false
    }

    const profileId = createUniqueId(name, keys(this.state.profiles))

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

    this.state.profiles[profileId] = profile
    this.writeProfile(profileId)

    return this.switchProfile(profileId)
  }

  /**
   * Creates a new variant.
   * @param packageId Package ID
   * @param name Variant name
   * @param fromVariantId ID of the variant to copy
   */
  public async createVariant(
    packageId: PackageID,
    name: string,
    fromVariantId: VariantID,
  ): Promise<boolean> {
    const packageInfo = this.requirePackageInfo(packageId)

    const variantId = createUniqueId(name, keys(packageInfo.variants))

    let fromVariantInfo = this.requireVariantInfo(packageId, fromVariantId)

    if (!fromVariantInfo.installed) {
      await this.installVariant(packageId, fromVariantId)
    }

    fromVariantInfo = this.requireVariantInfo(packageId, fromVariantId)

    const fromFiles = await glob("**", {
      cwd: this.getVariantPath(packageId, fromVariantId),
      dot: true,
      ignore: `${DIRNAMES.patches}/**`,
      nodir: true,
    })

    try {
      for (const filePath of fromFiles) {
        const fromPath = this.getVariantFilePath(packageId, fromVariantId, filePath)
        const fromPatch = this.getVariantPatchPath(packageId, fromVariantId, filePath)
        const toPath = this.getVariantFilePath(packageId, variantId, filePath)
        await createIfMissing(path.dirname(toPath))
        if (await exists(fromPatch)) {
          await fs.copyFile(fromPatch, toPath)
        } else {
          const realPath = await fs.realpath(fromPath)
          await fs.copyFile(realPath, toPath)
        }
      }

      const variantInfo: VariantInfo = {
        ...structuredClone(fromVariantInfo),
        assets: undefined,
        files: fromVariantInfo.files?.map(({ patches, ...file }) => file),
        id: variantId,
        installed: true,
        local: true,
        name,
        new: false,
        release: undefined,
        update: undefined,
      }

      packageInfo.variants[variantId] = variantInfo
      await this.writePackageConfig(packageInfo)
      this.sendPackage(packageId)
    } catch (error) {
      delete packageInfo.variants[variantId]
      await fs.rm(this.getVariantPath(packageId, variantId), { force: true, recursive: true })
      throw error
    }

    return true
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
    packageId: PackageID,
    variantId: VariantID,
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

    if (!assetInfo.downloaded[assetInfo.version]) {
      await this.tasks.download.queue(key, async context => {
        const response = await get(assetInfo.url, {
          cookies: origin => {
            // Pass Simtropolis credentials as cookie at that origin
            if (origin === SIMTROPOLIS_ORIGIN && this.state.simtropolis) {
              return getSimtropolisSessionCookies(this.state.simtropolis)
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
          url: assetInfo.url,
        })

        assetInfo.downloaded[assetInfo.version] = true
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
  public getAssetInfo(assetId: AssetID): AssetInfo | undefined {
    return this.assets[assetId]
  }

  /**
   * Returns an author's data by ID, if it exists.
   */
  public getAuthorInfo(authorId: AuthorID): AuthorInfo | undefined {
    return this.state.authors?.[authorId]
  }

  /**
   * Returns the current profile's data, if any.
   */
  public getCurrentProfile(): ProfileInfo | undefined {
    const profileId = this.state.settings?.currentProfile
    return profileId ? this.state.profiles?.[profileId] : undefined
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
    return this.state.settings?.useYaml === false ? ConfigFormat.JSON : ConfigFormat.YAML
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
   * Deletes a TXT log file.
   */
  public async clearPackageLogs(packageId: PackageID, variantId: VariantID): Promise<void> {
    const variantInfo = this.requireVariantInfo(packageId, variantId)

    if (!variantInfo.logs) {
      throw Error(`Package '${packageId}#${variantId}' does not have logs`)
    }

    const logsPath = path.join(this.getPluginsPath(), variantInfo.logs)
    await removeIfPresent(logsPath)
  }

  /**
   * Returns the content of a TXT log file.
   */
  public async getPackageLogs(
    packageId: PackageID,
    variantId: VariantID,
  ): Promise<{ size: number; text: string } | null> {
    const variantInfo = this.requireVariantInfo(packageId, variantId)

    if (!variantInfo.logs) {
      throw Error(`Package '${packageId}#${variantId}' does not have logs`)
    }

    const logsPath = path.join(this.getPluginsPath(), variantInfo.logs)

    try {
      const { size } = await fs.stat(logsPath)
      const text = await fs.readFile(logsPath, "utf8")
      return { size, text }
    } catch (error) {
      if (error instanceof Error && error.message.match(/no such file or directory/i)) {
        return null
      } else {
        throw error
      }
    }
  }

  /**
   * Returns the main README file for a given variant, as an HTML string.
   */
  public async getPackageReadme(
    packageId: PackageID,
    variantId: VariantID,
  ): Promise<{ html?: string; md?: string }> {
    const variantInfo = this.requireVariantInfo(packageId, variantId)

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
  public getPackageInfo(packageId: PackageID): PackageInfo | undefined {
    return this.state.packages?.[packageId]
  }

  /**
   * Returns a package's data by ID, or throws if it dos not exist.
   */
  public requirePackageInfo(packageId: PackageID): PackageInfo {
    const packageInfo = this.getPackageInfo(packageId)

    if (!packageInfo) {
      throw Error(`Unknown package '${packageId}'`)
    }

    return packageInfo
  }

  /**
   * Returns a package's name.
   */
  public getPackageName(packageId: PackageID): string {
    return this.state.packages?.[packageId]?.name ?? packageId
  }

  /**
   * Returns the absolute package to an installed package, by ID.
   */
  public getPackagePath(packageId: PackageID): string {
    return path.join(this.getRootPath(), DIRNAMES.packages, packageId)
  }

  /**
   * Returns a package's data by ID, if it exists.
   */
  public getPackageStatus(
    packageId: PackageID,
    profileId: ProfileID | undefined = this.state.settings?.currentProfile,
  ): PackageStatus | undefined {
    return profileId ? this.state.packages?.[packageId]?.status[profileId] : undefined
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
  public getProfileInfo(profileId: ProfileID): ProfileInfo | undefined {
    return this.state.profiles?.[profileId]
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
  public getProfileTemplate(profileId: ProfileID): ProfileInfo | undefined {
    return this.state.templates?.[profileId]
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
    return this.state
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
  public async getToolExePath(toolId: string): Promise<string> {
    const toolInfo = getToolInfo(toolId as ToolID)
    if (!toolInfo) {
      throw Error(`Unknown tool '${toolId}'`)
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
   * Returns a variant's data by ID, if it exists.
   */
  public getVariantInfo(packageId: PackageID, variantId: VariantID): VariantInfo | undefined {
    return this.state.packages?.[packageId]?.variants[variantId]
  }

  /**
   * Returns a variant's data by ID, or throws if it does not exist.
   */
  public requireVariantInfo(packageId: PackageID, variantId: VariantID): VariantInfo {
    const variantInfo = this.requirePackageInfo(packageId).variants[variantId]

    if (!variantInfo) {
      throw Error(`Unknown variant '${packageId}#${variantId}'`)
    }

    return variantInfo
  }

  /**
   * Returns a variant's data by ID, or throws if it does not exist.
   */
  public requireCurrentVariant(packageId: PackageID, packageStatus?: PackageStatus): VariantInfo {
    if (packageStatus) {
      return this.requireVariantInfo(packageId, packageStatus.variantId)
    }

    const profileInfo = this.getCurrentProfile()
    const variantId = this.getPackageStatus(packageId, profileInfo?.id)?.variantId
    if (variantId) {
      return this.requireVariantInfo(packageId, variantId)
    }

    throw Error(`Missing status for package '${packageId}'`)
  }

  /**
   * Returns the absolute path to a variant's files.
   */
  public getVariantPath(packageId: PackageID, variantId: VariantID): string {
    return path.join(this.getPackagePath(packageId), variantId)
  }

  public getVariantFilePath(packageId: PackageID, variantId: VariantID, filePath: string): string {
    return path.join(this.getVariantPath(packageId, variantId), filePath)
  }

  public getVariantPatchPath(packageId: PackageID, variantId: VariantID, filePath: string): string {
    return path.join(this.getVariantPath(packageId, variantId), DIRNAMES.patches, filePath)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected handle<Event extends keyof this & string, Args extends any[]>(
    this: { [key in Event]: (...args: Args) => unknown },
    event: Event,
  ): void {
    ipcMain.handle(event, (_, ...args: Args) => this[event](...args))
  }

  protected async initialize(): Promise<void> {
    await i18n.init

    // Initialize session
    getSimtropolisSession(this.browserSession).then(session => {
      if (session) {
        console.info("Logged in to Simtropolis")
        this.state.simtropolis = session
        this.sendSessions()
      } else {
        this.state.simtropolis = null
      }
    })

    // Launch database update in child process
    const databaseUpdatePromise = this.tryUpdateDatabase()

    // Load authors...
    this.state.status.loader = "Loading authors..."
    this.sendStatus()
    await this.loadAuthors()
    this.sendAuthors()

    // Load categories...
    this.state.status.loader = "Loading configurations..."
    this.sendStatus()
    await this.loadConfigs()
    this.sendConfigs()

    // Load profiles...
    this.state.status.loader = "Loading profiles..."
    this.sendStatus()
    await this.loadProfiles()
    this.sendProfiles()

    // Load settings...
    this.state.status.loader = "Loading settings..."
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
    this.state.packages = await loadLocalPackages(
      this.getPackagesPath(),
      this.state.configs.categories,
      (c, t) => {
        if (c % 10 === 0) {
          this.state.status.loader = `Loading local packages (${Math.floor(100 * (c / t))}%)...`
          this.sendStatus()
        }
      },
    )

    this.sendPackages()

    const downloadedAssets = await loadDownloadedAssets(this.getDownloadsPath())

    // Wait for database update...
    this.state.status.loader = "Updating database..."
    this.sendStatus()
    await databaseUpdatePromise

    // Load remote packages...
    const remote = await loadRemotePackages(
      this.getDatabasePath(),
      this.state.configs.categories,
      downloadedAssets,
      (c, t) => {
        if (c % 10 === 0) {
          this.state.status.loader = `Loading remote packages (${Math.floor(100 * (c / t))}%)...`
          this.sendStatus()
        }
      },
    )

    this.assets = remote.assets

    // Merge local and remote package definitions...
    for (const remotePackageInfo of values(remote.packages)) {
      const localPackageInfo = this.state.packages[remotePackageInfo.id]
      if (localPackageInfo) {
        this.state.packages[remotePackageInfo.id] = mergeLocalPackageInfo(
          localPackageInfo,
          remotePackageInfo,
        )
      } else {
        this.state.packages[remotePackageInfo.id] = remotePackageInfo
      }
    }

    this.sendPackages()

    // Templates are loaded in the background
    const loadTemplatesPromise = this.loadTemplates()

    // Wait for installation check...
    this.state.status.loader = "Checking installation..."
    this.sendStatus()
    await checkGameInstallPromise

    // Done
    this.state.status.loader = null
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

  public async installPackages(packages: {
    [packageId in PackageID]?: VariantID
  }): Promise<boolean> {
    const updatingPackages: {
      [packageId in PackageID]?: PackageConfig
    } = {}

    // Check if we are updating already-enabled variants - in that case we need to recalculate
    const currentProfile = this.getCurrentProfile()
    if (currentProfile) {
      for (const [packageId, variantId] of entries(packages)) {
        const packageStatus = this.getPackageStatus(packageId)
        if (packageStatus?.included && packageStatus?.variantId === variantId) {
          const variantInfo = this.getVariantInfo(packageId, variantId)
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
      entries(packages)
        .filter(([packageId]) => !updatingPackages[packageId])
        .map(([packageId, variantId]) => this.installVariant(packageId, variantId)),
    )

    return true
  }

  protected async installVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    const packageInfo = this.requirePackageInfo(packageId)
    const variantInfo = this.requireVariantInfo(packageId, variantId)

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
              condition?: Requirements,
              include?: PackageFile,
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
                        patches: include?.patches,
                        path: newPath,
                        priority: include?.priority,
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
              condition?: Requirements,
              include?: PackageFile,
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
                  condition,
                  include,
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

                const condition = {
                  ...include?.condition,
                  ...matchConditions(pattern, oldPath),
                }

                if (entry.isDirectory()) {
                  await includeDirectory(oldPath, include?.as ?? "", type, condition, include)
                } else {
                  const filename = path.basename(entry.name)
                  await includeFile(
                    oldPath,
                    include?.as?.replace("*", filename) ?? filename,
                    type,
                    condition,
                    include,
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
                await includePath(include.path, "docs", include)
              }
            } else {
              await includeDirectory("", "", "docs")
            }

            // Exclude files
            if (asset.exclude) {
              for (const exclude of asset.exclude) {
                excludePath(exclude)
              }
            }

            // Include files (everything if not specified)
            if (asset.include) {
              for (const include of asset.include) {
                await includePath(include.path, "files", include)
                excludePath(include.path.replace(conditionRegex, "*"))
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

        // Apply patches
        if (variantInfo.files) {
          for (const file of variantInfo.files) {
            if (file.patches) {
              await this.calculatePatch(packageId, variantId, file.path)
            }
          }
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

  protected async linkPackages(packageIds?: PackageID[]): Promise<void> {
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
          if (!this.state.packages) {
            return
          }

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
          const nTotalPackages = packageIds?.length ?? size(this.state.packages)
          const increment = Math.floor(nTotalPackages / 100)

          await forEachAsync(this.state.packages, async (packageInfo, packageId) => {
            const status = packageInfo.status[profileInfo.id]
            if (status?.included) {
              const variantId = status.variantId
              const variantInfo = packageInfo.variants[variantId]
              if (variantInfo) {
                const variantPath = this.getVariantPath(packageId, variantId)
                if (variantInfo.files?.length) {
                  const patterns = status.files?.map(globToRegex)

                  for (const file of variantInfo.files) {
                    if (
                      checkFile(
                        file,
                        packageId,
                        variantInfo,
                        profileInfo,
                        this.state.configs.profileOptions,
                        this.state.features,
                        this.state.settings,
                        patterns,
                        false,
                      )
                    ) {
                      const priority = file.priority ?? variantInfo.priority

                      const fullPath = file.patches
                        ? path.join(variantPath, DIRNAMES.patches, file.path)
                        : path.join(variantPath, file.path)

                      const targetPath = path.join(
                        pluginsPath,
                        // DLL/INI files must be in Plugins root
                        file.path.match(/\.(dll|ini)$/i)
                          ? path.basename(file.path)
                          : path.join(getPluginsFolderName(priority), packageId, file.path),
                      )

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
          })

          if (!packageIds) {
            for (const linkPath of oldLinks) {
              nRemoved++
              await removeIfPresent(linkPath)
              await removeIfEmptyRecursive(path.dirname(linkPath), pluginsPath)
              delete this.links[linkPath]
            }
          }

          context.debug(`Done (added ${nCreated}, removed ${nRemoved}, updated ${nUpdated})`)
        },
        { invalidate: true },
      )
    }
  }

  public async loadDBPFEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<DBPFFile> {
    const originalFullPath = this.getVariantFilePath(packageId, variantId, filePath)
    const patchedFullPath = this.getVariantPatchPath(packageId, variantId, filePath)

    const hasPatch = await exists(patchedFullPath)
    const fullPath = hasPatch ? patchedFullPath : originalFullPath
    const file = await fs.open(fullPath, "r")

    try {
      const contents = await loadDBPF(file)
      return contents
    } finally {
      await file.close()
    }
  }

  public async loadDBPFEntry(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    entryId: TGI,
  ): Promise<{ data: DBPFEntryData; original?: DBPFEntryData }> {
    const { exemplarProperties } = this.state.configs

    const variantInfo = this.requireVariantInfo(packageId, variantId)
    const fileInfo = variantInfo.files?.find(file => file.path === filePath)

    if (!fileInfo) {
      throw Error(`Missing file ${filePath} in '${packageId}#${variantId}'`)
    }

    const originalFullPath = this.getVariantFilePath(packageId, variantId, filePath)
    const patchedFullPath = this.getVariantPatchPath(packageId, variantId, filePath)
    const isPatched = !!fileInfo.patches?.[entryId]

    const originalData = await openFile(originalFullPath, "r", async originalFile => {
      const originalContents = await loadDBPF(originalFile)
      const originalEntry = originalContents.entries[entryId]

      if (!originalEntry) {
        throw Error(`Missing entry ${entryId} in ${originalFullPath}`)
      }

      return loadDBPFEntry(originalFile, originalEntry, exemplarProperties)
    })

    if (!isPatched) {
      return { data: originalData }
    }

    const patchedData = await openFile(patchedFullPath, "r", async patchedFile => {
      const patchedContents = await loadDBPF(patchedFile)
      const patchedEntry = patchedContents.entries[entryId]

      if (!patchedEntry) {
        throw Error(`Missing entry ${entryId} in ${patchedFullPath}`)
      }

      return loadDBPFEntry(patchedFile, patchedEntry, exemplarProperties)
    })

    return { data: patchedData, original: originalData }
  }

  public async patchDBPFEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    patches: {
      [entryId in TGI]?: ExemplarDataPatch | null
    },
  ): Promise<DBPFFile> {
    const { exemplarProperties } = this.state.configs

    const packageInfo = this.requirePackageInfo(packageId)
    const variantInfo = this.requireVariantInfo(packageId, variantId)
    const fileInfo = variantInfo.files?.find(file => file.path === filePath)

    if (!fileInfo) {
      throw Error(`Missing file ${filePath} in '${packageId}#${variantId}'`)
    }

    if (variantInfo.local) {
      const originalFullPath = this.getVariantFilePath(packageId, variantId, filePath)
      const tempFullPath = path.join(
        this.getTempPath(),
        DIRNAMES.packages,
        packageId,
        variantId,
        filePath,
      )

      await createIfMissing(path.dirname(tempFullPath))
      const file = await openFile(originalFullPath, "r", async originalFile => {
        return openFile(tempFullPath, "w", async patchedFile => {
          return patchDBPFEntries(originalFile, patchedFile, patches, exemplarProperties)
        })
      })

      await moveTo(tempFullPath, originalFullPath)

      return {
        ...file,
        entries: mapValues(file.entries, ({ original, ...entry }) => entry),
      }
    } else {
      // Override patches in config
      forEach(patches, (patch, entryId) => {
        fileInfo.patches ??= {}
        if (patch?.parentCohortId || patch?.properties) {
          fileInfo.patches[entryId] = patch
        } else {
          delete fileInfo.patches[entryId]
        }
      })

      // Unset patches if all were removed
      if (fileInfo.patches && isEmpty(fileInfo.patches)) {
        delete fileInfo.patches
      }

      // Send updates to renderer
      this.sendPackage(packageId)

      // Persist config changes
      this.writePackageConfig(packageInfo)

      // Calculate patched file
      const file = await this.calculatePatch(packageId, variantId, filePath)

      // Relink this package only
      this.linkPackages([packageId])

      return file
    }
  }

  protected async calculatePatch(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<DBPFFile> {
    const { exemplarProperties } = this.state.configs

    const variantInfo = this.requireVariantInfo(packageId, variantId)
    const fileInfo = variantInfo.files?.find(file => file.path === filePath)

    if (!fileInfo) {
      throw Error(`Missing file ${filePath} in '${packageId}#${variantId}'`)
    }

    const originalFullPath = this.getVariantFilePath(packageId, variantId, filePath)
    const patchedFullPath = this.getVariantPatchPath(packageId, variantId, filePath)
    const patches = fileInfo.patches

    let file: DBPFFile

    if (patches) {
      // Create or update the patched file
      await createIfMissing(path.dirname(patchedFullPath))
      file = await openFile(originalFullPath, "r", async originalFile => {
        return openFile(patchedFullPath, "w", async patchedFile => {
          return patchDBPFEntries(originalFile, patchedFile, patches, exemplarProperties)
        })
      })
    } else {
      // Delete the patched file
      const variantPath = this.getVariantPath(packageId, variantId)
      await removeIfPresent(patchedFullPath)
      await removeIfEmptyRecursive(patchedFullPath, variantPath)

      // Reload the original exemplars
      file = await openFile(originalFullPath, "r", async originalFile => {
        const file = await loadDBPF(originalFile)

        for (const entry of values(file.entries)) {
          if (entry.type === DBPFDataType.EXMP) {
            entry.data = await loadDBPFEntry<DBPFDataType.EXMP>(
              originalFile,
              entry,
              exemplarProperties,
            )
          }
        }

        return file
      })
    }

    return file
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

  protected async loadAuthors(): Promise<Authors> {
    console.debug("Loading authors...")

    const config = await loadConfig<Authors>(this.getDatabasePath(), FILENAMES.dbAuthors)

    this.state.authors = config?.data ?? {}

    console.info(`Loaded ${Object.keys(this.state.authors).length} authors`)

    return this.state.authors
  }

  protected async loadConfigs(): Promise<void> {
    try {
      console.debug("Loading categories...")

      const config = await loadConfig<Categories>(this.getDatabasePath(), FILENAMES.dbCategories)

      if (!config) {
        throw Error("Missing config")
      }

      const categories = config.data

      this.state.configs.categories = categories

      console.debug(`Loaded ${size(categories)} categories`)
    } catch (error) {
      console.error("Failed to load categories", error)
    }

    try {
      console.debug("Loading profile options...")

      const config = await loadConfig<{ options: OptionInfo[] }>(
        this.getDatabasePath(),
        FILENAMES.dbProfileOptions,
      )

      if (!config) {
        throw Error("Missing config")
      }

      const options = config.data.options

      this.state.configs.profileOptions = options

      console.debug(`Loaded ${options.length} profile options`)
    } catch (error) {
      console.error("Failed to load profile options", error)
    }

    try {
      console.debug("Loading exemplar properties...")

      const config = await loadConfig<{
        [propertyIdHex in string]?: ExemplarPropertyData
      }>(this.getDatabasePath(), FILENAMES.dbExemplarProperties)

      if (!config) {
        throw Error("Missing config")
      }

      const properties: { [propertyId in number]?: ExemplarPropertyInfo } = {}

      forEach(config.data, (data, propertyIdHex) => {
        const propertyInfo: ExemplarPropertyInfo = {
          ...data,
          type: data.type && ExemplarValueType[data.type],
        }

        if (propertyIdHex.includes("-")) {
          const [firstId, lastId] = propertyIdHex.split("-").map(readHex)
          for (let propertyId = firstId; propertyId <= lastId; propertyId++) {
            properties[propertyId] = propertyInfo
          }
        } else {
          const propertyId = readHex(propertyIdHex)
          properties[propertyId] = propertyInfo
        }
      })

      this.state.configs.exemplarProperties = properties

      console.debug(`Loaded ${size(properties)} exemplar properties`)
    } catch (error) {
      console.error("Failed to load exemplar properties", error)
    }
  }

  protected async loadProfiles(): Promise<Profiles> {
    console.debug("Loading profiles")

    let nProfiles = 0
    this.state.profiles = {}

    const profilesPath = this.getProfilesPath()
    await createIfMissing(profilesPath)

    const entries = await fs.readdir(profilesPath, { withFileTypes: true })
    for (const entry of entries) {
      const format = path.extname(entry.name) as ConfigFormat
      if (entry.isFile() && Object.values(ConfigFormat).includes(format)) {
        const profileId = path.basename(entry.name, format) as ProfileID
        const profilePath = path.join(profilesPath, entry.name)
        if (this.state.profiles[profileId]) {
          console.warn(`Duplicate profile configuration '${entry.name}'`)
          continue
        }

        try {
          const data = await readConfig<ProfileData>(profilePath)
          const profile = fromProfileData(profileId, data)
          profile.format = format
          this.state.profiles[profileId] = profile
          nProfiles++
        } catch (error) {
          console.warn(`Invalid profile configuration '${entry.name}'`, error)
        }
      }
    }

    console.debug(`Loaded ${nProfiles} profiles`)

    return this.state.profiles
  }

  protected async loadSettings(): Promise<Settings> {
    console.debug("Loading settings...")

    const config = await loadConfig<Settings>(this.getRootPath(), FILENAMES.settings)

    this.state.settings = {
      format: config?.format,
      ...defaultSettings,
      ...config?.data,
    }

    // Select first profile if currently-selected profile no longer exists
    const profileIds = keys(this.state.profiles ?? {})
    const currentProfileId = this.state.settings.currentProfile
    if (!currentProfileId || !profileIds.includes(currentProfileId)) {
      this.state.settings.currentProfile = profileIds[0]
    }

    return this.state.settings
  }

  protected async loadTemplates(): Promise<Profiles> {
    console.debug("Loading profile templates")

    let nTemplates = 0
    this.state.templates = {}

    const templatesPath = this.getTemplatesPath()
    await createIfMissing(templatesPath)

    const entries = await fs.readdir(templatesPath, { withFileTypes: true })
    for (const entry of entries) {
      const format = path.extname(entry.name) as ConfigFormat
      if (entry.isFile() && Object.values(ConfigFormat).includes(format)) {
        const profileId = `${TEMPLATE_PREFIX}${path.basename(entry.name, format)}` as ProfileID
        const profilePath = path.join(templatesPath, entry.name)
        if (this.state.templates[profileId]) {
          console.warn(`Duplicate profile template '${entry.name}'`)
          continue
        }

        try {
          const data = await readConfig<ProfileData>(profilePath)
          const profile = fromProfileData(profileId, data)
          profile.format = format
          this.state.templates[profileId] = profile
          nTemplates++
        } catch (error) {
          console.warn(`Invalid profile template '${entry.name}'`, error)
        }
      }
    }

    console.debug(`Loaded ${nTemplates} profile templates`)
    this.sendTemplates()

    return this.state.templates
  }

  /**
   * Opens an author's homepage in browser, if present.
   */
  public async openAuthorURL(authorId: AuthorID): Promise<boolean> {
    const authorInfo = this.getAuthorInfo(authorId)
    if (authorInfo?.url) {
      await this.openInExplorer(authorInfo.url)
      return true
    }

    return false
  }

  /**
   * Opens the game's executable directory in Explorer.
   */
  public async openExecutableDirectory(): Promise<boolean> {
    if (this.state.settings?.install?.path) {
      this.openInExplorer(
        path.dirname(path.join(this.state.settings.install.path, FILENAMES.sc4exe)),
      )
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
    if (this.state.settings?.install?.path) {
      this.openInExplorer(this.state.settings.install.path)
      return true
    }

    return false
  }

  /**
   * Opens a package's config file in the default text editor.
   */
  public async openPackageConfig(packageId: PackageID): Promise<boolean> {
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
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<boolean> {
    this.openInExplorer(path.join(this.getVariantPath(packageId, variantId), filePath))
    return true
  }

  /**
   * Opens a profile's config file in the default text editor.
   */
  public async openProfileConfig(profileId: ProfileID): Promise<boolean> {
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
  public async openVariantRepository(packageId: PackageID, variantId: VariantID): Promise<boolean> {
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
  public async openVariantURL(packageId: PackageID, variantId: VariantID): Promise<boolean> {
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
  protected async recalculatePackages(profileId: ProfileID): Promise<void> {
    const profileInfo = this.getProfileInfo(profileId)
    if (!this.state.packages || !this.state.settings || !profileInfo) {
      return
    }

    const { resultingFeatures, resultingStatus } = resolvePackages(
      this.state.packages,
      profileInfo,
      this.state.configs.profileOptions,
      this.state.settings,
    )

    this.state.features = resultingFeatures
    for (const packageId of keys(resultingStatus)) {
      this.state.packages[packageId]!.status[profileId] = resultingStatus[packageId] // TODO
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
    this.state = getInitialState()

    this.tasks.linker.invalidateCache("init")

    this.sendStateReset()

    await this.initialize()
  }

  /**
   * Remove installed variants. If any variant is enabled in the current profile, it will be disabled first.
   * @param packages map of package ID to variant ID
   * @returns whether action was successful (i.e. not cancelled by user)
   */
  public async removePackages(packages: { [packageId: PackageID]: VariantID }): Promise<boolean> {
    // TODO: ATM this does not clean obsolete files from Downloads sub-folder!

    // TODO: ATM we only check the current profile - removing package may break other profiles
    const currentProfile = this.getCurrentProfile()
    if (currentProfile) {
      const enabledPackageIds: PackageID[] = []
      for (const packageId of keys(packages)) {
        if (currentProfile.packages[packageId]?.enabled) {
          const packageStatus = this.getPackageStatus(packageId, currentProfile.id)
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

    const promises = entries(packages).map(async ([packageId, variantId]) => {
      if (!this.assets || !this.state.packages || !this.state.profiles) {
        return false
      }

      const packageInfo = this.state.packages[packageId]
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
              delete this.state.packages[packageId]
            } else {
              delete packageInfo.variants[variantId]
              for (const profileId of keys(packageInfo.status)) {
                const packageStatus = packageInfo.status[profileId]
                const profileInfo = this.state.profiles[profileId]
                if (profileInfo && packageStatus?.variantId === variantId) {
                  const defaultVariant = getDefaultVariant(packageInfo, profileInfo)
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
    profileId: ProfileID,
    packageId: PackageID,
    variantId: VariantID,
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

  protected sendAuthors(): void {
    this.sendStateUpdate({
      authors: this.state.authors,
    })
  }

  protected sendConfigs(): void {
    this.sendStateUpdate({
      configs: this.state.configs,
    })
  }

  protected sendPackage(packageId: PackageID): void {
    this.sendStateUpdate({
      packages: {
        [packageId]: this.getPackageInfo(packageId) ?? null,
      },
    })
  }

  protected sendPackages(): void {
    this.sendStateUpdate({
      features: this.state.features,
      packages: this.state.packages,
    })
  }

  protected sendProfile(profileId: ProfileID): void {
    this.sendStateUpdate({
      profiles: {
        [profileId]: this.getProfileInfo(profileId) ?? null,
      },
    })
  }

  protected sendProfiles(): void {
    this.sendStateUpdate({
      profiles: this.state.profiles,
    })
  }

  protected sendSessions(): void {
    // Only send the UserID
    this.sendStateUpdate({
      simtropolis: this.state.simtropolis && { userId: this.state.simtropolis.userId },
    })
  }

  protected sendSettings(): void {
    this.sendStateUpdate({
      settings: this.state.settings,
    })
  }

  protected sendStateReset(): void {
    this.mainWindow?.webContents.postMessage("resetState", this.getState())
  }

  protected sendStateUpdate(data: ApplicationStateUpdate): void {
    this.mainWindow?.webContents.postMessage("updateState", data)
  }

  protected sendStatus(): void {
    this.sendStateUpdate({
      status: this.state.status,
    })
  }

  protected sendTemplates(): void {
    this.sendStateUpdate({
      templates: this.state.templates,
    })
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
      this.state.simtropolis = session
      this.sendSessions()
    }
  }

  /**
   * Logs out of Simtropolis.
   */
  public async simtropolisLogout(): Promise<void> {
    await simtropolisLogout(this.browserSession)
    console.info("Logged out from Simtropolis")
    this.state.simtropolis = null
    this.sendSessions()
  }

  /**
   * Checks out a profile by ID.
   */
  public async switchProfile(profileId: ProfileID): Promise<boolean> {
    const profile = this.getProfileInfo(profileId)
    if (!this.state.settings || !this.state.packages || !profile) {
      return false
    }

    this.state.settings.currentProfile = profileId

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
                i18n.reloadResources()
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

  public async updateProfile(profileId: ProfileID, update: ProfileUpdate): Promise<boolean> {
    const profileInfo = this.getProfileInfo(profileId)
    if (!this.state.packages || !this.state.settings || !profileInfo) {
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
        resultingFeatures,
        resultingProfile,
        resultingStatus,
        selectingVariants,
        shouldRecalculate,
      } = resolvePackageUpdates(
        this.state.packages,
        profileInfo,
        this.state.configs.profileOptions,
        this.state.settings,
        update,
      )

      try {
        if (shouldRecalculate) {
          // Set enabling/disabling status
          for (const packageId of disablingPackages) {
            const packageStatus = this.getPackageStatus(packageId, profileId)
            if (packageStatus) {
              packageStatus.action = "disabling"
            }
          }

          for (const packageId of enablingPackages) {
            const packageStatus = this.getPackageStatus(packageId, profileId)
            if (packageStatus) {
              packageStatus.action = "enabling"
            }
          }

          // Apply implicit variant changes automatically
          if (Object.keys(implicitVariantChanges).length) {
            for (const [packageId, variantIds] of entries(implicitVariantChanges)) {
              update.packages[packageId] = {
                ...update.packages[packageId],
                variant: variantIds.new,
              }
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
            const packageNames = incompatiblePackages.map(id => this.getPackageName(id))

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
                update.packages[packageId] = {
                  ...update.packages[packageId],
                  enabled: true,
                }
              }
            }

            // Disable conflicted packages
            if (result.response === 0) {
              for (const packageId of incompatiblePackages) {
                update.packages[packageId] = {
                  ...update.packages[packageId],
                  enabled: false,
                }
              }

              // Recalculate
              return this.updateProfile(profileId, update)
            }
          }

          // Confirm explicit variant changes
          if (Object.keys(explicitVariantChanges).length) {
            const variants = entries(explicitVariantChanges).map(([packageId, variants]) => {
              const packageInfo = this.getPackageInfo(packageId)! // TODO
              const oldVariant = packageInfo.variants[variants.old]! // TODO
              const newVariant = packageInfo.variants[variants.new]! // TODO
              return t("InstallCompatibleVariantsModal:variant", {
                newVariantName: newVariant.name,
                oldVariantName: oldVariant.name,
                packageName: packageInfo.name,
              })
            })

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
              for (const [packageId, variantIds] of entries(explicitVariantChanges)) {
                update.packages[packageId] = {
                  ...update.packages[packageId],
                  variant: variantIds.old,
                }
              }
            }

            // Switch to compatible variants
            if (result.response === 0) {
              for (const [packageId, variantIds] of entries(explicitVariantChanges)) {
                update.packages[packageId] = {
                  ...update.packages[packageId],
                  variant: variantIds.new,
                }
              }

              // Recalculate
              return this.updateProfile(profileId, update)
            }
          }

          // Confirm optional dependencies
          const optionalDependencies = new Map<PackageID, boolean>()
          for (const packageId of enablingPackages) {
            const packageInfo = this.requirePackageInfo(packageId)
            const variantInfo = this.requireCurrentVariant(packageId, resultingStatus[packageId])
            const dependencyIds = variantInfo?.optional?.filter(dependencyId => {
              const dependencyStatus = resultingStatus[dependencyId]
              const dependencyVariantInfo = this.requireCurrentVariant(
                dependencyId,
                dependencyStatus,
              )

              return (
                !isEnabled(dependencyVariantInfo, dependencyStatus) &&
                !isIncompatible(dependencyVariantInfo, dependencyStatus) &&
                optionalDependencies.has(dependencyId)
              )
            })

            if (packageInfo && dependencyIds?.length) {
              // TODO: Use our own modal rather than system one?
              const [confirmed] = await this.showConfirmation(
                packageInfo.name,
                t("EnableOptionalDependencies:confirmation"),
                t("EnableOptionalDependencies:description", {
                  dependencies: dependencyIds.map(id => this.getPackageName(id)).sort(),
                  packageName: packageInfo.name,
                }),
              )

              for (const dependencyId of dependencyIds) {
                optionalDependencies.set(dependencyId, confirmed)
              }
            }
          }

          if (optionalDependencies.size) {
            for (const [dependencyId, confirmed] of optionalDependencies) {
              update.packages[dependencyId] ??= {}
              update.packages[dependencyId].enabled = confirmed
            }

            // Recalculate
            return this.updateProfile(profileId, update)
          }

          // Collect warnings
          const warnings = new Map<string, { packageIds: PackageID[]; warning: PackageWarning }>()

          // On-enable warnings
          for (const packageId of enablingPackages) {
            const variantInfo = this.requireCurrentVariant(packageId, resultingStatus[packageId])
            if (variantInfo.warnings) {
              for (const warning of variantInfo.warnings) {
                if (warning.id && this.ignoredWarnings.has(warning.id)) {
                  continue
                }

                if (warning.on !== "enable") {
                  continue
                }

                const warningId = warning.id ?? warning.message
                if (!warningId) {
                  console.warn("Warning has neither id nor message")
                  continue
                }

                const existing = warnings.get(warningId)
                if (existing) {
                  existing.packageIds.push(packageId)
                } else {
                  warnings.set(warning.on + ":" + warningId, { packageIds: [packageId], warning })
                }
              }
            }
          }

          // On-disable warnings
          // TODO: Automatically detect disabling lots/mmps, including options?
          for (const packageId of disablingPackages) {
            const variantInfo = this.requireCurrentVariant(packageId, resultingStatus[packageId])
            if (variantInfo.warnings) {
              for (const warning of variantInfo.warnings) {
                if (warning.id && this.ignoredWarnings.has(warning.id)) {
                  continue
                }

                if (warning.on !== "disable") {
                  continue
                }

                const warningId = warning.id ?? warning.message
                if (!warningId) {
                  console.warn("Warning has neither id nor message")
                  continue
                }

                const existing = warnings.get(warningId)
                if (existing) {
                  existing.packageIds.push(packageId)
                } else {
                  warnings.set(warning.on + ":" + warningId, { packageIds: [packageId], warning })
                }
              }
            }
          }

          // On-variant-change warnings
          // TODO: Automatically detect disabling lots/mmps, including options?
          for (const packageId of keys(selectingVariants)) {
            const variantInfo = this.requireCurrentVariant(packageId, resultingStatus[packageId])
            if (variantInfo.warnings) {
              for (const warning of variantInfo.warnings) {
                if (warning.id && this.ignoredWarnings.has(warning.id)) {
                  continue
                }

                if (warning.on !== "variantChange") {
                  continue
                }

                const warningId = warning.id ?? warning.message
                if (!warningId) {
                  console.warn("Warning has neither id nor message")
                  continue
                }

                const existing = warnings.get(warningId)
                if (existing) {
                  existing.packageIds.push(packageId)
                } else {
                  warnings.set(warning.on + ":" + warningId, { packageIds: [packageId], warning })
                }
              }
            }
          }

          // Confirm warnings
          for (const { packageIds, warning } of warnings.values()) {
            const packageNames = packageIds.map(id => this.getPackageName(id)).sort()
            const { id = "bulldoze", on = "enable" } = warning

            // TODO: Use our own modal rather than system one?
            const [confirmed, doNotAskAgain] = await this.showConfirmation(
              t(`WarningModal:title`, {
                count: packageNames.length - 1,
                packageName: packageNames[0],
              }),
              t(`WarningModal:confirmation.${on}`),
              warning.message ??
                t(`${on}.${id}`, {
                  count: packageNames.length,
                  defaultValue: id,
                  ns: "Warning",
                  packageNames,
                }),
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

          // If there are packages to install...
          if (Object.keys(installingVariants).length) {
            /** Assets required by newly-installed variants */
            const installingAssets = unique(
              flatMap(entries(installingVariants), ([packageId, variantId]) => {
                const assets = this.getVariantInfo(packageId, variantId)?.assets ?? []
                return mapDefined(assets, assetInfo => this.getAssetInfo(assetInfo.id))
              }),
            )

            /** Assets that will be downloaded */
            const missingAssets = installingAssets.filter(assetInfo => {
              return !assetInfo.downloaded[assetInfo.version]
            })

            // Confirm installation of dependencies
            if (missingAssets.length) {
              const dependencyIds = keys(installingVariants).filter(id =>
                isDependency(resultingStatus[id]),
              )

              const totalSize = missingAssets.every(asset => asset.size)
                ? sumBy(missingAssets, asset => asset.size ?? 0)
                : undefined

              // TODO: Use our own modal rather than system one?
              const [confirmed] = await this.showConfirmation(
                t("DownloadAssetsModal:title"),
                t("DownloadAssetsModal:confirmation"),
                dependencyIds.length
                  ? [
                      t("DownloadAssetsModal:descriptionDependencies", {
                        dependencies: dependencyIds.map(id => this.getPackageName(id)).sort(),
                        count: dependencyIds.length,
                      }),
                      t("DownloadAssetsModal:descriptionAssetsWithDependencies", {
                        assets: missingAssets.map(asset => asset.id).sort(),
                        count: missingAssets.length,
                        totalSize,
                      }),
                    ].join("\n\n")
                  : t("DownloadAssetsModal:descriptionAssets", {
                      assets: missingAssets.map(asset => asset.id).sort(),
                      count: missingAssets.length,
                      totalSize,
                    }),
              )

              if (!confirmed) {
                return false
              }
            }

            // Install all packages
            await Promise.all(
              entries(installingVariants).map(([packageId, variantId]) =>
                this.installVariant(packageId, variantId),
              ),
            )

            // Recalculate (conflicts may have changed during install)
            return this.updateProfile(profileId, update)
          }
        }

        // Apply config changes
        Object.assign(profileInfo, resultingProfile)
        this.state.features = resultingFeatures

        // Apply status changes
        forEach(this.state.packages, (packageInfo, packageId) => {
          packageInfo.status[profileId] = resultingStatus[packageId]
        })

        // Run cleaner and linker
        if (shouldRecalculate) {
          for (const packageId of enablingPackages) {
            const variantInfo = this.requireCurrentVariant(packageId, resultingStatus[packageId])
            await this.cleanVariant(packageId, variantInfo.id)
          }

          this.linkPackages()
        }
      } finally {
        if (this.state.packages && shouldRecalculate) {
          // Clear disabling status
          for (const packageId of disablingPackages) {
            const packageStatus = this.getPackageStatus(packageId, profileId)
            if (packageStatus?.action === "disabling") {
              delete packageStatus.action
            }
          }

          // Clear enabling status
          for (const packageId of enablingPackages) {
            const packageStatus = this.getPackageStatus(packageId, profileId)
            if (packageStatus?.action === "enabling") {
              delete packageStatus.action
            }
          }
        }

        this.sendPackages()
      }
    }

    // Other changes can be applied directly
    profileInfo.name = update.name || profileInfo.name

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

  protected async writeProfile(profileId: ProfileID): Promise<void> {
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
        const settings = this.state.settings
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
