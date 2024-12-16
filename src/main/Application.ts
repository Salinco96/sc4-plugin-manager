import fs from "node:fs/promises"
import path from "node:path"

import {
  $merge,
  type EmptyRecord,
  collect,
  entries,
  forEach,
  forEachAsync,
  isEmpty,
  keys,
  mapDefined,
  mapValues,
  sortBy,
  sumBy,
  toHex,
  uniqueBy,
  values,
  where,
} from "@salinco/nice-utils"
import log, { type LogLevel } from "electron-log"
import { net, Menu, type Session, app, ipcMain, session } from "electron/main"
import escapeHtml from "escape-html"
import { glob } from "glob"

import type { AssetInfo, Assets } from "@common/assets"
import type { AuthorID, Authors } from "@common/authors"
import type { BuildingID } from "@common/buildings"
import type { Categories } from "@common/categories"
import { DBPFDataType, type DBPFEntry, type DBPFFile, type TGI, parseTGI } from "@common/dbpf"
import {
  type ExemplarDataPatch,
  type ExemplarPropertyInfo,
  ExemplarType,
  getExemplarType,
} from "@common/exemplars"
import { getFeatureLabel, i18n, initI18n, t } from "@common/i18n"
import type { LotID } from "@common/lots"
import { type OptionInfo, getOptionValue } from "@common/options"
import {
  type PackageID,
  checkFile,
  isDependency,
  isIncluded,
  isInstalled,
  isLocal,
  isPatched,
} from "@common/packages"
import {
  type ProfileData,
  type ProfileID,
  type ProfileInfo,
  type ProfileUpdate,
  type Profiles,
  createUniqueId,
} from "@common/profiles"
import type { PropID } from "@common/props"
import type { Settings, SettingsData } from "@common/settings"
import type { ApplicationState, ApplicationStateUpdate } from "@common/state"
import { ConfigFormat, type Features, type PackageInfo, type Packages } from "@common/types"
import { globToRegex } from "@common/utils/glob"
import type { ContentsInfo, FileInfo, VariantID } from "@common/variants"
import { removeConfig, writeConfig } from "@node/configs"
import { getAssetKey } from "@node/data/assets"
import { loadBuildingInfo } from "@node/data/buildings"
import { CLEANITOL_EXTENSIONS, DOC_EXTENSIONS, SC4_EXTENSIONS, matchFiles } from "@node/data/files"
import { loadLotInfo } from "@node/data/lots"
import { type PackageData, writePackageInfo } from "@node/data/packages"
import { loadPropInfo } from "@node/data/props"
import { loadDBPF, loadDBPFEntry, patchDBPFEntries } from "@node/dbpf"
import { getBuildingData } from "@node/dbpf/buildings"
import { getLotData } from "@node/dbpf/lots"
import { getPropData } from "@node/dbpf/props"
import type { Exemplar } from "@node/dbpf/types"
import { download } from "@node/download"
import { extractRecursively } from "@node/extract"
import { get } from "@node/fetch"
import {
  FileOpenMode,
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
  writeFile,
} from "@node/files"
import { hashCode } from "@node/hash"
import { cmd } from "@node/processes"
import {
  ConflictConfirmationResponse,
  showConfirmation,
  showConflictConfirmation,
  showSuccess,
  showWarning,
} from "@utils/dialog"
import { getPluginsFolderName } from "@utils/linker"
import { type ToolID, getToolInfo } from "@utils/tools"

import { MainWindow } from "./MainWindow"
import { SplashScreen } from "./SplashScreen"
import { type AppConfig, loadAppConfig } from "./data/config"
import {
  loadAuthors,
  loadCategories,
  loadExemplarProperties,
  loadMaxisExemplars,
  loadProfileOptions,
  loadProfileTemplates,
} from "./data/db"
import { loadDownloadedAssets, loadLocalPackages, loadRemotePackages } from "./data/packages"
import { getDefaultVariant, resolvePackageUpdates, resolvePackages } from "./data/packages/resolve"
import { compactProfileConfig, loadProfiles, toProfileData } from "./data/profiles"
import { loadSettings, toSettingsData } from "./data/settings"
import type {
  UpdateDatabaseProcessData,
  UpdateDatabaseProcessResponse,
} from "./processes/updateDatabase/types"
import updateDatabaseProcessPath from "./processes/updateDatabase?modulePath"
import { DIRNAMES, FILENAMES, TEMPLATE_PREFIX } from "./utils/constants"
import { env, isDev } from "./utils/env"
import { check4GBPatch } from "./utils/exe"
import { createChildProcess } from "./utils/processes"
import { handleDocsProtocol } from "./utils/protocols"
import {
  SIMTROPOLIS_ORIGIN,
  type SimtropolisSession,
  getSimtropolisSession,
  getSimtropolisSessionCookies,
  simtropolisLogin,
  simtropolisLogout,
} from "./utils/sessions/simtropolis"
import { type TaskContext, TaskManager } from "./utils/tasks"

interface Loaded {
  assets: Assets
  authors: Authors
  categories: Categories
  exemplarProperties: Record<string, ExemplarPropertyInfo>
  features: Features
  maxis: Required<ContentsInfo>
  packages: Packages
  profiles: Profiles
  profileOptions: OptionInfo[]
  settings: Settings
  templates: Profiles
}

export class Application {
  /**
   * Current instance of the application.
   */
  protected static instance: Application | undefined

  /**
   * Launches an instance of the application.
   */
  public static async launch(): Promise<Application> {
    // Initialize translations
    initI18n(i18n)

    // Load app config
    const appConfig = await loadAppConfig()

    Application.instance ??= new Application(appConfig)

    return Application.instance
  }

  /**
   * Focuses the current instance.
   */
  public static focus(): void {
    Application.instance?.focus()
  }

  /**
   * Returns the current application window.
   */
  public static get mainWindow(): MainWindow | undefined {
    return Application.instance?.mainWindow
  }

  /**
   * Quits the current instance.
   */
  public static async quit(): Promise<void> {
    await Application.instance?.quit()
    Application.instance = undefined
  }

  /**
   * Absolute path to the game data directory, containing the 'Plugins' directory.
   */
  public readonly gamePath: string

  /**
   * IDs of warnings that should be ignored for the whole session.
   */
  public readonly ignoredWarnings = new Set<string>()

  /**
   * Main application window.
   */
  protected mainWindow: MainWindow | undefined

  /**
   * Current Simtropolis session cookies (null if logged out).
   */
  protected simtropolisSession: SimtropolisSession | null = null

  /**
   * Splash screen briefly shown on startup (except in dev).
   */
  protected splashScreen: SplashScreen | undefined

  public readonly tasks = new TaskManager({
    pools: {
      download: 6,
      extract: 6,
    },
  })

  /**
   * Returns the current Electron session object.
   */
  protected get browserSession(): Session {
    return session.defaultSession
  }

  /**
   * Application creation.
   * Contains one-time-only/non-reloadable synchronous initializations.
   */
  protected constructor(appConfig: AppConfig) {
    this.gamePath = appConfig.gamePath
    this.init()
  }

  /**
   * Back up an external file from 'Plugins' folder to 'Plugins (Backup)'
   * @param context Task context
   * @param relativePath relative path to the file to back up from 'Plugins' folder
   */
  protected async backUpFile(context: TaskContext, relativePath: string): Promise<void> {
    context.debug(`Backing up ${relativePath}...`)

    const pluginsPath = this.getPluginsPath()
    const originFullPath = path.join(pluginsPath, relativePath)
    const targetFullPath = path.join(this.getPluginsBackupPath(), relativePath)
    await moveTo(originFullPath, targetFullPath)

    // Clean up empty folders
    await removeIfEmptyRecursive(path.dirname(originFullPath), pluginsPath)
  }

  /**
   * Checks the 4GB Patch and suggests applying it.
   */
  public async check4GBPatch(): Promise<boolean> {
    const { settings } = await this.load()

    return this.tasks.queue("4gb:check", {
      handler: async context => {
        if (!settings.install?.path) {
          throw Error("Game installation path is not set")
        }

        const { applied } = await check4GBPatch(context, settings.install.path, {
          isStartupCheck: false,
          skipSuggestion: false,
        })

        if (applied) {
          settings.install.patched = true
        } else if (settings.install.patched) {
          settings.install.patched = undefined
        }

        await this.writeSettings(context, settings)

        return applied
      },
      pool: "main",
    })
  }

  /**
   * Runs cleaner for all enabled packages.
   */
  public async cleanPackages(options: { packageIds?: PackageID[] } = {}): Promise<void> {
    const { packages, profiles, settings } = await this.load()

    if (!settings.currentProfile) {
      return
    }

    const profileInfo = profiles[settings.currentProfile]
    if (!profileInfo) {
      return
    }

    const { externals } = await this.initLinks()

    await this.tasks.queue(options.packageIds ? `clean:${options.packageIds.join(",")}` : "clean", {
      handler: async context => {
        context.debug("Cleaning plugins...")
        context.setStep("Cleaning plugins...")

        let nPackages = 0
        const packageIds = options.packageIds ? options.packageIds : keys(packages)

        for (const packageId of packageIds) {
          context.setProgress(nPackages++, packageIds.length)

          const packageInfo = packages[packageId]
          if (!packageInfo) {
            throw Error(`Unknown package '${packageId}'`)
          }

          const packageStatus = packageInfo?.status[profileInfo.id]
          if (!packageStatus?.included) {
            continue
          }

          const variantId = packageStatus.variantId
          const variantInfo = packageInfo?.variants[variantId]
          if (!variantInfo?.files) {
            context.warn(`Variant '${packageId}#${variantId}' is not installed`)
            continue
          }

          const conflictingFiles = new Set<string>()
          const filePaths = new Set(variantInfo.files?.map(file => path.basename(file.path)))

          const variantPath = this.getVariantPath(packageId, variantId)
          const cleanitolPath = path.join(variantPath, DIRNAMES.cleanitol)

          const cleanitolFiles = await glob("*.txt", {
            cwd: cleanitolPath,
            dot: true,
            matchBase: true,
            nodir: true,
          })

          for (const cleanitolFile of cleanitolFiles) {
            const contents = await readFile(path.join(cleanitolPath, cleanitolFile))
            for (const line of contents.split("\n")) {
              const filePath = line.split(";")[0].trim()

              if (filePath) {
                filePaths.add(filePath)
              }
            }
          }

          for (const filePath of filePaths) {
            for (const externalFile of externals) {
              if (path.basename(externalFile) === filePath) {
                conflictingFiles.add(externalFile)
              }
            }
          }

          if (conflictingFiles.size) {
            const fileNames = Array.from(conflictingFiles)

            const { confirmed } = await showConfirmation(
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
                externals.delete(conflictingFile)
              }

              context.debug(`Resolved ${conflictingFiles.size} conflicts`)
            } else {
              context.debug(`Ignored ${conflictingFiles.size} conflicts`)
            }
          }
        }
      },
      invalidate: true,
      onStatusUpdate: info => {
        this.sendStateUpdate({ linker: info })
      },
      pool: "link",
    })
  }

  /**
   * Deletes a TXT log file.
   */
  public async clearPackageLogs(packageId: PackageID, variantId: VariantID): Promise<void> {
    const { packages } = await this.load()

    const variantInfo = packages[packageId]?.variants[variantId]
    if (!variantInfo?.logs) {
      throw Error(`Variant '${packageId}#${variantId}' does not have logs`)
    }

    const logsPath = path.join(this.getPluginsPath(), variantInfo.logs)

    await removeIfPresent(logsPath)
  }

  /**
   * Removes all non-local variants not used by any profile.
   */
  public async clearUnusedPackages(): Promise<void> {
    const { packages, profiles, profileOptions, settings } = await this.load()

    await this.tasks.queue("clear:packages", {
      handler: async context => {
        context.debug("Removing unused packages...")
        context.setStep("Removing unused packages...")

        const packageStatus = collect(profiles, profileInfo => {
          const { resultingStatus } = resolvePackages(
            packages,
            profileInfo,
            profileOptions,
            settings,
          )

          return resultingStatus
        })

        const unusedVariants = values(packages).flatMap(packageInfo => {
          return values(packageInfo.variants)
            .filter(
              variantInfo =>
                isInstalled(variantInfo) &&
                !isLocal(variantInfo) &&
                !packageStatus.some(status => isIncluded(variantInfo, status[packageInfo.id])),
            )
            .map(variantInfo => ({
              packageId: packageInfo.id,
              variantId: variantInfo.id,
              patched: isPatched(variantInfo),
            }))
        })

        if (unusedVariants.length) {
          const { confirmed } = await showConfirmation(
            i18n.t("ClearUnusedPackagesModal:title"),
            i18n.t("ClearUnusedPackagesModal:confirmation"),
            i18n.t("ClearUnusedPackagesModal:description", {
              count: unusedVariants.length,
              variants: unusedVariants
                .map(
                  ({ packageId, variantId, patched }) =>
                    `${packageId}#${variantId}${patched ? " (patched)" : ""}`,
                )
                .sort(),
            }),
            false,
            unusedVariants.some(({ patched }) => patched) ? "warning" : "question",
          )

          if (confirmed) {
            let nVariants = 0
            for (const { packageId, variantId } of unusedVariants) {
              context.setProgress(nVariants++, unusedVariants.length)
              await this.removeVariant(packageId, variantId)
            }
          }

          await showSuccess(
            i18n.t("ClearUnusedPackagesModal:title"),
            i18n.t("ClearUnusedPackagesModal:success"),
          )
        } else {
          await showSuccess(
            i18n.t("ClearUnusedPackagesModal:title"),
            i18n.t("ClearUnusedPackagesModal:description", { count: 0 }),
          )
        }
      },
      onStatusUpdate: info => {
        this.sendStateUpdate({ loader: info })
      },
      pool: "main",
    })
  }

  /**
   * Creates and checks out a new profile.
   * @param name Profile name
   * @param fromProfileId ID of the profile to copy (create an empty profile otherwise)
   */
  public async createProfile(name: string, fromProfileId?: ProfileID): Promise<void> {
    const { profiles, templates } = await this.load()

    const profileId = createUniqueId(name, keys(profiles))

    await this.tasks.queue(`create:${profileId}`, {
      handler: async context => {
        context.debug(`Creating profile '${profileId}'...`)

        const fromProfileInfo = fromProfileId
          ? fromProfileId.startsWith(TEMPLATE_PREFIX)
            ? templates[fromProfileId]
            : profiles[fromProfileId]
          : undefined

        const profileInfo: ProfileInfo = structuredClone({
          features: fromProfileInfo?.features ?? {},
          format: undefined,
          id: profileId,
          name,
          options: fromProfileInfo?.options ?? {},
          packages: fromProfileInfo?.packages ?? {},
        })

        profiles[profileId] = profileInfo

        await this.writeProfileConfig(context, profileInfo)
      },
      pool: "main",
    })

    await this.switchProfile(profileId)
  }

  /**
   * Creates a new variant.
   * @param packageId Package ID
   * @param name New variant name
   * @param fromVariantId ID of the variant to copy
   */
  public async createVariant(
    packageId: PackageID,
    name: string,
    fromVariantId: VariantID,
  ): Promise<void> {
    const { categories, exemplarProperties, packages } = await this.load()

    const packageInfo = packages[packageId]
    if (!packageInfo) {
      throw Error(`Unknown package '${packageId}'`)
    }

    const variantId = createUniqueId(name, keys(packageInfo.variants))

    await this.tasks.queue(`create:${packageId}#${variantId}`, {
      handler: async context => {
        const fromVariantInfo = packageInfo.variants[fromVariantId]

        if (!fromVariantInfo) {
          throw Error(`Unknown variant '${packageId}#${fromVariantId}'`)
        }

        context.info(`Creating variant '${packageId}#${variantId}'...`)

        // Install the source variant if it is not already
        if (!fromVariantInfo.installed) {
          await this.installVariant(packageId, fromVariantId)
        }

        const fromFiles = await glob("**", {
          cwd: this.getVariantPath(packageId, fromVariantId),
          ignore: [`${DIRNAMES.patches}/**`],
          nodir: true,
        })

        try {
          // Copy files from the source variant
          for (const fromPath of fromFiles) {
            const fileInfo = fromVariantInfo.files?.find(file => file.path === fromPath)

            // If file is patched, copy the patched version
            const fromFullPath = fileInfo
              ? await this.getPatchedFile(
                  context,
                  packageId,
                  fromVariantId,
                  fileInfo,
                  exemplarProperties,
                )
              : this.getVariantFilePath(packageId, fromVariantId, fromPath)

            // If file is a symbolic link to Downloads, find the real file
            const realPath = await fs.realpath(fromFullPath)

            const toPath = this.getVariantFilePath(packageId, variantId, fromPath)

            await copyTo(realPath, toPath)
          }

          // Copy configs from the source variant
          packageInfo.variants[variantId] = structuredClone({
            ...fromVariantInfo,
            assets: undefined,
            files: fromVariantInfo.files?.map(({ patches, ...file }) => file),
            id: variantId,
            installed: true,
            local: true,
            name,
            new: false,
            release: undefined,
            update: undefined,
          })

          await this.writePackageConfig(context, packageInfo, categories)
        } catch (error) {
          // If something goes wrong while installing, fully delete the new variant
          await removeIfPresent(this.getVariantPath(packageId, variantId))
          delete packageInfo.variants[variantId]
          throw error
        }
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  /**
   * Downloads an asset.
   */
  protected async downloadAsset(assetInfo: AssetInfo): Promise<string> {
    const key = this.getDownloadKey(assetInfo)
    const downloadPath = this.getDownloadPath(assetInfo)

    await this.tasks.queue(`download:${key}`, {
      cache: true,
      handler: async context => {
        const downloaded = await exists(downloadPath)

        context.setStep(`Downloading ${key}...`)

        if (!downloaded) {
          const response = await get(assetInfo.url, {
            cookies: origin => {
              // Pass Simtropolis credentials as cookie at that origin
              if (origin === SIMTROPOLIS_ORIGIN && this.simtropolisSession) {
                return getSimtropolisSessionCookies(this.simtropolisSession)
              }
            },
            fetch: net.fetch,
            logger: context,
          })

          await download(response, {
            downloadPath,
            downloadTempPath: this.getTempPath(downloadPath),
            exePath: exe => this.getToolExePath(exe),
            expectedSha256: assetInfo.sha256,
            expectedSize: assetInfo.size,
            logger: context,
            onProgress: context.setProgress,
            url: assetInfo.url,
          })
        }

        assetInfo.downloaded[assetInfo.version] = true

        context.setStep(`Extracting ${key}...`)

        await extractRecursively(downloadPath, {
          exePath: exe => this.getToolExePath(exe),
          logger: context,
          onProgress: context.setProgress,
        })
      },
      onStatusUpdate: info => {
        this.sendStateUpdate({ downloads: { [key]: info } })
      },
      pool: "download",
    })

    return downloadPath
  }

  protected focus(): void {
    this.mainWindow?.restore()
    this.mainWindow?.focus()
  }

  protected async generatePatchedFile(
    context: TaskContext,
    originalFullPath: string,
    patchedFullPath: string,
    patches: Record<TGI, ExemplarDataPatch | undefined>,
    exemplarProperties: Record<string, ExemplarPropertyInfo>,
  ): Promise<DBPFFile> {
    context.info(`Patching ${path.basename(originalFullPath)}...`)

    await createIfMissing(path.dirname(patchedFullPath))
    return openFile(originalFullPath, FileOpenMode.READ, originalFile => {
      return openFile(patchedFullPath, FileOpenMode.WRITE, patchedFile => {
        return patchDBPFEntries(originalFile, patchedFile, patches, { exemplarProperties })
      })
    })
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
   * Returns the download cache key for an asset.
   */
  protected getDownloadKey(assetInfo: AssetInfo): string {
    return getAssetKey(assetInfo.id, assetInfo.version)
  }

  /**
   * Returns the absolute path to the given asset's download cache.
   */
  public getDownloadPath(assetInfo: AssetInfo): string {
    return path.join(this.getDownloadsPath(), this.getDownloadKey(assetInfo))
  }

  /**
   * Returns the absolute path to the 'Downloads' directory.
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
    }

    return isDev() ? "debug" : "info"
  }

  /**
   * Returns the absolute path to the main log file.
   */
  public getLogsFile(): string {
    return path.join(this.getLogsPath(), FILENAMES.logs)
  }

  /**
   * Returns the absolute path to the 'Logs' directory, containing manager logs.
   */
  public getLogsPath(): string {
    return path.join(this.getRootPath(), DIRNAMES.logs)
  }

  /**
   * Returns the content of a TXT log file.
   */
  public async getPackageLogs(
    packageId: PackageID,
    variantId: VariantID,
  ): Promise<{ size: number; text: string } | null> {
    const { packages } = await this.load()

    const variantInfo = packages[packageId]?.variants[variantId]
    if (!variantInfo?.logs) {
      throw Error(`Variant '${packageId}#${variantId}' does not have logs`)
    }

    const logsPath = path.join(this.getPluginsPath(), variantInfo.logs)

    try {
      const { size } = await fs.stat(logsPath)
      const text = await fs.readFile(logsPath, "utf8")
      return { size, text }
    } catch (error) {
      if (error instanceof Error && error.message.match(/no such file or directory/i)) {
        return null
      }

      throw error
    }
  }

  /**
   * Returns the absolute package to an installed package, by ID.
   */
  public getPackagePath(packageId: PackageID): string {
    return path.join(this.getPackagesPath(), packageId)
  }

  /**
   * Returns the absolute path to the 'Packages' directory, containing installed packages.
   */
  public getPackagesPath(): string {
    return path.join(this.getRootPath(), DIRNAMES.packages)
  }

  /**
   * Returns the main README file for a given variant, as an HTML string.
   */
  public async getPackageReadme(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<{ html?: string; md?: string }> {
    const { packages } = await this.load()

    const variantInfo = packages[packageId]?.variants[variantId]
    if (!variantInfo?.readme) {
      throw Error(`Variant '${packageId}#${variantId}' does not have documentation`)
    }

    const docPath = path.join(this.getVariantPath(packageId, variantId), DIRNAMES.docs, filePath)
    const docExt = getExtension(docPath)

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

      // TODO: Support PDF?
      default: {
        throw Error(`Unsupported documentation format ${docExt}`)
      }
    }
  }

  protected async getPatchedFile(
    context: TaskContext,
    packageId: PackageID,
    variantId: VariantID,
    fileInfo: FileInfo,
    exemplarProperties: Record<string, ExemplarPropertyInfo>,
  ): Promise<string> {
    const originalFullPath = this.getVariantFilePath(packageId, variantId, fileInfo.path)
    const patches = fileInfo.patches

    if (!patches) {
      return originalFullPath
    }

    const patchedFullPath = this.getVariantFilePath(packageId, variantId, fileInfo.path, patches)
    const isGenerated = await exists(patchedFullPath)

    if (!isGenerated) {
      await this.generatePatchedFile(
        context,
        originalFullPath,
        patchedFullPath,
        patches,
        exemplarProperties,
      )
    }

    return patchedFullPath
  }

  /**
   * Returns the absolute path to the 'Plugins' directory.
   */
  public getPluginsPath(): string {
    return path.join(this.gamePath, DIRNAMES.plugins)
  }

  /**
   * Returns the absolute path to the 'Plugins (Backup)' directory.
   */
  public getPluginsBackupPath(): string {
    return path.join(this.gamePath, DIRNAMES.pluginsBackup)
  }

  /**
   * Returns the absolute path to the 'Profiles' directory, containing profile configs.
   */
  public getProfilesPath(): string {
    return path.join(this.getRootPath(), DIRNAMES.profiles)
  }

  /**
   * Returns the absolute path to the 'Manager' directory.
   */
  public getRootPath(): string {
    return path.join(this.gamePath, DIRNAMES.root)
  }

  /**
   * Returns the current state to synchronize with renderer.
   */
  public async getState(): Promise<ApplicationState> {
    const {
      authors,
      categories,
      exemplarProperties,
      maxis,
      features,
      packages,
      profiles,
      profileOptions,
      settings,
      templates,
    } = await this.load()

    return {
      authors,
      categories,
      downloads: {},
      exemplarProperties,
      features,
      linker: null,
      loader: null,
      maxis,
      packages,
      profiles,
      profileOptions,
      settings,
      simtropolis: this.simtropolisSession ? { userId: this.simtropolisSession.userId } : null,
      templates,
    }
  }

  /**
   * Returns the absolute path to the temporary download directory.
   * @param fullPath if provided, returns the temporary corresponding
   */
  public getTempPath(fullPath?: string): string {
    if (fullPath) {
      const relativePath = path.relative(this.getRootPath(), fullPath)
      return path.join(this.getRootPath(), DIRNAMES.temp, relativePath)
    }

    return path.join(this.getRootPath(), DIRNAMES.temp)
  }

  /**
   * Returns the path to the given tool's executable, downloading the tool as needed.
   */
  public async getToolExePath(toolId: string): Promise<string> {
    const { assets } = await this.load()

    const toolInfo = getToolInfo(toolId as ToolID)
    if (!toolInfo) {
      throw Error(`Unknown tool '${toolId}'`)
    }

    if (toolInfo.assetId) {
      const assetInfo = assets[toolInfo.assetId]
      if (!assetInfo) {
        throw Error(`Unknown asset '${toolInfo.assetId}'`)
      }

      const downloadPath = await this.downloadAsset(assetInfo)
      return path.join(downloadPath, toolInfo.exe)
    }

    return toolInfo.exe
  }

  /**
   * Returns the absolute path to a variant's files.
   */
  public getVariantPath(packageId: PackageID, variantId: VariantID): string {
    return path.join(this.getPackagePath(packageId), variantId)
  }

  public getVariantFilePath(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    patches?: Record<TGI, ExemplarDataPatch | undefined>,
  ): string {
    if (patches) {
      const hash = toHex(hashCode(JSON.stringify(patches)), 8)
      const extension = path.extname(filePath)

      return path.join(
        this.getVariantPath(packageId, variantId),
        DIRNAMES.patches,
        `${filePath.slice(0, -extension.length)}.${hash}${extension}`,
      )
    }

    return path.join(this.getVariantPath(packageId, variantId), filePath)
  }

  // biome-ignore lint/suspicious/noExplicitAny: function params generic
  protected handle<Event extends keyof this & string, Args extends any[]>(
    this: { [key in Event]: (...args: Args) => unknown },
    event: Event,
  ): void {
    ipcMain.handle(event, (_, ...args: Args) => this[event](...args))
  }

  protected init(): void {
    // Register message handlers
    this.handle("check4GBPatch")
    this.handle("clearPackageLogs")
    this.handle("clearUnusedPackages")
    this.handle("createProfile")
    this.handle("createVariant")
    this.handle("getPackageLogs")
    this.handle("getPackageReadme")
    this.handle("getState")
    this.handle("installVariant")
    this.handle("loadDBPFEntries")
    this.handle("loadDBPFEntry")
    this.handle("openAuthorURL")
    this.handle("openExecutableDirectory")
    this.handle("openInstallationDirectory")
    this.handle("openPackageConfig")
    this.handle("openPackageFile")
    this.handle("openProfileConfig")
    this.handle("openVariantURL")
    this.handle("patchDBPFEntries")
    this.handle("removeProfile")
    this.handle("removeVariant")
    this.handle("simtropolisLogin")
    this.handle("simtropolisLogout")
    this.handle("switchProfile")
    this.handle("updateProfile")

    this.initLogs()
    this.initCustomProtocols()

    this.initApplicationMenu()
    this.initMainWindow()

    // Initialize Simtropolis session
    getSimtropolisSession(this.browserSession).then(session => {
      if (session) {
        console.info("Logged in to Simtropolis")
        this.simtropolisSession = session
        this.sendStateUpdate({ simtropolis: { userId: session.userId } })
      } else {
        this.sendStateUpdate({ simtropolis: null })
      }
    })
  }

  protected initApplicationMenu(): void {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          role: "fileMenu",
          submenu: [
            {
              // Register Ctrl+Shift+I as Devtools command
              accelerator: "CmdOrCtrl+Shift+I",
              role: "toggleDevTools",
            },
            {
              // Register Ctrl+R as Reload command
              accelerator: "CmdOrCtrl+R",
              click: () => this.reload(),
              label: i18n.t("reload"),
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

  protected initCustomProtocols(): void {
    handleDocsProtocol(this.getRootPath(), DOC_EXTENSIONS)
  }

  protected async initLinks(isReload?: boolean): Promise<{
    externals: Set<string>
    links: Map<string, string>
  }> {
    return this.tasks.queue("link:init", {
      cache: true,
      handler: async context => {
        context.setStep("Initializing links...")

        const pluginsPath = this.getPluginsPath()

        await createIfMissing(pluginsPath)

        const externals = new Set<string>()
        const links = new Map<string, string>()

        const files = await glob("**", {
          cwd: pluginsPath,
          dot: true,
          nodir: true,
          withFileTypes: true,
        })

        let nFiles = 0
        for (const file of files) {
          context.setProgress(nFiles++, files.length)

          const relativePath = file.relative()

          if (file.isSymbolicLink()) {
            const targetPath = await fs.readlink(file.fullpath())
            links.set(relativePath, targetPath)
          } else if (![".ini", ".log"].includes(getExtension(relativePath))) {
            externals.add(relativePath)
          }
        }

        context.debug(`Done (found ${links.size} links and ${externals.size} external files)`)

        return { externals, links }
      },
      invalidate: isReload,
      onStatusUpdate: info => {
        this.sendStateUpdate({ linker: info })
      },
      pool: "link",
    })
  }

  protected initLogs(): void {
    app.setPath("logs", this.getLogsPath())
    log.transports.console.level = this.getLogLevel()
    log.transports.file.level = this.getLogLevel()
    log.transports.file.resolvePathFn = () => this.getLogsFile()
    Object.assign(console, log.functions)
  }

  protected initMainWindow(): MainWindow {
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

  public async installVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    const { assets, categories, exemplarProperties, packages } = await this.load()

    await this.tasks.queue(`install:${packageId}#${variantId}`, {
      handler: async context => {
        const packageInfo = packages[packageId]
        if (!packageInfo) {
          throw Error(`Unknown package '${packageId}'`)
        }

        const variantInfo = packageInfo.variants[variantId]
        if (!variantInfo) {
          throw Error(`Unknown variant '${packageId}#${variantId}'`)
        }

        const isUpdating = !!variantInfo.installed

        const oldFiles = variantInfo.files

        try {
          if (isUpdating) {
            context.info(`Updating variant '${packageId}#${variantId}'...`)
            variantInfo.action = "updating"
          } else {
            context.info(`Installing variant '${packageId}#${variantId}'...`)
            variantInfo.action = "installing"
          }

          this.sendPackageUpdate(packageInfo)

          const variantPath = this.getVariantPath(packageId, variantId)

          const variantAssets = variantInfo.update?.assets ?? variantInfo.assets ?? []

          // Download and extract all assets
          const downloadedAssets = await Promise.all(
            variantAssets.map(async asset => {
              const assetInfo = assets[asset.id]
              if (!assetInfo) {
                throw Error(`Unknown asset '${asset.id}'`)
              }

              const downloadPath = await this.downloadAsset(assetInfo)

              return { asset, assetInfo, downloadPath }
            }),
          )

          // Remove any previous installation files
          await removeIfPresent(variantPath)
          await createIfMissing(variantPath)

          try {
            const docs: string[] = []
            const includedPaths = new Set<string>()
            const files: FileInfo[] = []

            for (const { asset, downloadPath } of downloadedAssets) {
              const allPaths = await glob("**/*", {
                cwd: downloadPath,
                dot: true,
                nodir: true,
                posix: true,
              })

              const { matchedPaths: cleanitolFiles } = matchFiles(
                allPaths.filter(path => CLEANITOL_EXTENSIONS.includes(getExtension(path))),
                {
                  exclude: asset.exclude,
                  ignoreEmpty: !asset.cleanitol,
                  include: asset.cleanitol?.map(path => ({ path })) ?? [
                    { path: "*cleanitol*.txt" },
                  ],
                },
              )

              await forEachAsync(cleanitolFiles, async (file, oldPath) => {
                if (file) {
                  const newPath = path.join(DIRNAMES.cleanitol, file.path)
                  if (includedPaths.has(newPath)) {
                    context.warn(`Ignoring file ${oldPath} trying to unpack at ${newPath}`)
                  } else {
                    const targetFullPath = path.join(variantPath, newPath)
                    await createIfMissing(path.dirname(targetFullPath))
                    await fs.symlink(path.join(downloadPath, oldPath), targetFullPath)
                    includedPaths.add(newPath)
                  }
                }
              })

              const { matchedPaths: docFiles } = matchFiles(
                allPaths.filter(
                  path => DOC_EXTENSIONS.includes(getExtension(path)) && !cleanitolFiles[path],
                ),
                {
                  exclude: asset.exclude,
                  ignoreEmpty: !asset.docs,
                  include: asset.docs ?? [{ path: "" }],
                },
              )

              await forEachAsync(docFiles, async (file, oldPath) => {
                if (file) {
                  const newPath = path.join(DIRNAMES.docs, file.path)
                  if (includedPaths.has(newPath)) {
                    context.warn(`Ignoring file ${oldPath} trying to unpack at ${newPath}`)
                  } else {
                    const targetFullPath = path.join(variantPath, newPath)
                    await createIfMissing(path.dirname(targetFullPath))
                    await fs.symlink(path.join(downloadPath, oldPath), targetFullPath)
                    includedPaths.add(newPath)
                    docs.push(newPath)
                  }
                }
              })

              const { matchedPaths: sc4Files } = matchFiles(
                allPaths.filter(path => SC4_EXTENSIONS.includes(getExtension(path))),
                {
                  exclude: asset.exclude,
                  ignoreEmpty: !asset.include,
                  include: asset.include ?? [{ path: "" }],
                  options: variantInfo.options,
                },
              )

              await forEachAsync(sc4Files, async (file, oldPath) => {
                if (file) {
                  const newPath = file.path
                  if (includedPaths.has(newPath)) {
                    context.raiseInDev(`Ignoring file ${oldPath} trying to unpack at ${newPath}`)
                  } else {
                    const targetFullPath = path.join(variantPath, newPath)
                    await createIfMissing(path.dirname(targetFullPath))
                    await fs.symlink(path.join(downloadPath, oldPath), targetFullPath)
                    includedPaths.add(newPath)
                    files.push(file)
                  }
                }
              })
            }

            if (variantInfo.update) {
              Object.assign(variantInfo, variantInfo.update)
              variantInfo.update = undefined
            }

            variantInfo.files = sortBy(files, file => file.path)
            variantInfo.installed = true

            // Migrate existing patches
            // After updating, filenames may have changed!
            if (variantInfo.files && oldFiles) {
              const notFoundFiles: string[] = []

              for (const oldFile of oldFiles) {
                if (oldFile.patches) {
                  const normalize = (path: string) =>
                    path
                      .replace(/([v]|\d+[.])\d+([.]\d+)*[a-z]?/gi, "") // ignore patterns like 'v2' or '3.5.0'
                      .replace(/[-_^#@! ]/g, "") // ignore spacing and weird characters
                      .toLowerCase() // ignore case

                  const normalized = normalize(oldFile.path)
                  const newFile = variantInfo.files.find(
                    file => normalize(file.path) === normalized,
                  )

                  if (newFile) {
                    newFile.patches = oldFile.patches

                    await this.getPatchedFile(
                      context,
                      packageId,
                      variantId,
                      newFile,
                      exemplarProperties,
                    )
                  } else {
                    notFoundFiles.push(oldFile.path)
                  }
                }
              }

              if (notFoundFiles.length) {
                // TODO: Effectively old patches are lost/irrecoverable at this point - maybe give users a chance to redirect them manually or otherwise save the patch?
                await showWarning(
                  packageInfo.name,
                  "Patch migration failed",
                  `Failed to locate the following files after update. This usually means that the file structure of the package was changed by the author. The corresponding patches will not be applied.\n${notFoundFiles.map(file => `  - ${file}`).join("\n")}`,
                )
              }
            }

            // Rewrite config
            await this.writePackageConfig(context, packageInfo, categories)
          } catch (error) {
            // If something goes wrong while installing, fully delete the new variant
            await removeIfPresent(this.getVariantPath(packageId, variantId))
            variantInfo.files = undefined
            variantInfo.installed = undefined
            throw error
          }
        } finally {
          variantInfo.action = undefined
          this.sendPackageUpdate(packageInfo)
        }
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  protected async linkPackages(options: { packageId?: PackageID } = {}): Promise<void> {
    const { exemplarProperties, features, packages, profiles, profileOptions, settings } =
      await this.load()

    const { externals, links } = await this.initLinks()

    await this.tasks.queue(options.packageId ? `link:${options.packageId}` : "link", {
      handler: async context => {
        context.debug("Linking packages...")

        if (!settings.currentProfile) {
          return
        }

        const profileInfo = profiles[settings.currentProfile]
        if (!profileInfo) {
          return
        }

        const pluginsPath = this.getPluginsPath()

        context.setStep("Linking packages...")

        const oldLinks = new Set(links.keys())

        let nCreated = 0
        let nRemoved = 0
        let nUpdated = 0

        let nPackages = 0
        const packageIds = options.packageId ? [options.packageId] : keys(packages)

        for (const packageId of packageIds) {
          context.setProgress(nPackages++, packageIds.length)

          const packageInfo = packages[packageId]
          if (!packageInfo) {
            throw Error(`Unknown package '${packageId}'`)
          }

          const packageStatus = packageInfo?.status[profileInfo.id]
          if (!packageStatus?.included) {
            continue
          }

          const variantId = packageStatus.variantId
          const variantInfo = packageInfo?.variants[variantId]
          if (!variantInfo?.files) {
            context.warn(`Variant '${packageId}#${variantId}' is not installed`)
            continue
          }

          const makeLink = async (fromFullPath: string, toRelativePath: string) => {
            const toFullPath = path.join(pluginsPath, toRelativePath)
            await removeIfPresent(toFullPath)
            await createIfMissing(path.dirname(toFullPath))
            await fs.symlink(fromFullPath, toFullPath)
            links.set(toRelativePath, fromFullPath)
          }

          const patterns = packageStatus.files?.map(pattern => globToRegex(pattern))

          for (const file of variantInfo.files) {
            const isFileIncluded = checkFile(
              file,
              packageId,
              variantInfo,
              profileInfo,
              profileOptions,
              features,
              settings,
              patterns,
              false,
            )

            if (!isFileIncluded) {
              continue
            }

            const priority = file.priority ?? variantInfo.priority

            const patchedFullPath = await this.getPatchedFile(
              context,
              packageId,
              variantId,
              file,
              exemplarProperties,
            )

            // DLL and INI files must be in Plugins root
            const targetRelativePath = file.path.match(/\.(dll|ini)$/i)
              ? path.basename(file.path)
              : path.join(getPluginsFolderName(priority), packageId, file.path)

            oldLinks.delete(targetRelativePath)

            if (externals.has(targetRelativePath)) {
              await this.backUpFile(context, targetRelativePath)
              externals.delete(targetRelativePath)
            }

            const currentLinkPath = links.get(targetRelativePath)
            if (currentLinkPath !== patchedFullPath) {
              await makeLink(patchedFullPath, targetRelativePath)
              if (currentLinkPath) {
                nUpdated++
              } else {
                nCreated++
              }
            }
          }

          // Generate INI files
          if (variantInfo.options) {
            const iniFiles: { [filename: string]: OptionInfo[] } = {}
            for (const option of variantInfo.options) {
              if (option.file) {
                iniFiles[option.file] ??= []
                iniFiles[option.file].push(option)
              }
            }

            for (const filename in iniFiles) {
              let ini = ""
              let lastSection = ""
              for (const option of iniFiles[filename]) {
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
                await writeFile(targetPath, ini)
              }
            }
          }
        }

        // Remove obsolete links
        if (!options.packageId) {
          for (const relativePath of oldLinks) {
            const fullPath = path.join(pluginsPath, relativePath)
            await removeIfPresent(fullPath)
            await removeIfEmptyRecursive(path.dirname(fullPath), pluginsPath)
            links.delete(relativePath)
            nRemoved++
          }
        }

        context.debug(`Done (added ${nCreated}, removed ${nRemoved}, updated ${nUpdated})`)
      },
      invalidate: true,
      onStatusUpdate: info => {
        this.sendStateUpdate({ linker: info })
      },
      pool: "link",
    })
  }

  /**
   * Loads configs and user data.
   * @param isReload whether to force reloading all data, ignoring cache
   */
  protected async load(isReload?: boolean): Promise<Loaded> {
    return this.tasks.queue<Loaded>("load", {
      cache: true,
      handler: async context => {
        // Launch database update in child process
        const databaseUpdatePromise = this.updateDatabase(isReload)
        const downloadsPromise = loadDownloadedAssets(context, this.getDownloadsPath())

        // Launch link initialization in the background
        this.initLinks(isReload)

        // Creating window
        this.initMainWindow()

        // Load profiles...
        context.setStep("Loading profiles...")
        const profiles = await loadProfiles(context, this.getProfilesPath())
        this.sendStateUpdate({ profiles })

        // Load settings...
        context.setStep("Loading settings...")
        const settings = await loadSettings(
          context,
          this.getRootPath(),
          this.getPluginsPath(),
          profiles,
        )

        // Rewrite modified settings...
        this.writeSettings(context, settings)

        const profileInfo = settings.currentProfile ? profiles[settings.currentProfile] : undefined

        // Wait for database update...
        context.setStep("Updating database...")
        await databaseUpdatePromise

        // Load authors...
        context.setStep("Loading authors...")
        const authors = await loadAuthors(context, this.getDatabasePath())
        this.sendStateUpdate({ authors })

        // Load categories...
        context.setStep("Loading categories...")
        const categories = await loadCategories(context, this.getDatabasePath())
        this.sendStateUpdate({ categories })

        // Load profile options...
        context.setStep("Loading profile options...")
        const profileOptions = await loadProfileOptions(context, this.getDatabasePath())
        this.sendStateUpdate({ profileOptions })

        // Load local packages...
        context.setStep("Loading local packages...")
        const localPackages = await loadLocalPackages(context, this.getPackagesPath(), categories)

        if (!isReload) {
          this.sendStateUpdate({ packages: localPackages })
        }

        context.setStep("Loading remote packages...")
        const downloadedAssets = await downloadsPromise

        // Load remote packages...
        const { assets, packages } = await loadRemotePackages(
          context,
          this.getDatabasePath(),
          categories,
          localPackages,
          downloadedAssets,
        )

        if (!isReload || !profileInfo) {
          this.sendStateUpdate({ packages })
        }

        let features: Features = {}

        // Resolving packages if profile exists
        if (profileInfo) {
          // Resolve package status and dependencies (will also trigger linking)
          features = this.recalculatePackages(packages, profileInfo, profileOptions, settings)

          this.sendStateUpdate({ features, packages })

          // Run cleaner for all enabled packages
          this.cleanPackages()
        }

        context.setStep(null)

        const templates = await loadProfileTemplates(context, this.getDatabasePath())
        this.sendStateUpdate({ templates })

        const exemplarProperties = await loadExemplarProperties(context, this.getDatabasePath())
        this.sendStateUpdate({ exemplarProperties })

        const maxis = await loadMaxisExemplars(context, this.getDatabasePath(), categories)
        this.sendStateUpdate({ maxis })

        return {
          assets,
          authors,
          categories,
          exemplarProperties,
          features,
          maxis,
          packages,
          profiles,
          profileOptions,
          settings,
          templates,
        }
      },
      invalidate: isReload,
      onStatusUpdate: info => {
        this.sendStateUpdate({ loader: info })
      },
      pool: "main",
    })
  }

  public async loadDBPFEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<DBPFFile> {
    const { exemplarProperties, packages } = await this.load()

    return this.tasks.queue(`load:${packageId}#${variantId}/${filePath}`, {
      handler: async context => {
        const variantInfo = packages[packageId]?.variants[variantId]
        if (!variantInfo?.files) {
          throw Error(`Variant '${packageId}#${variantId}' is not installed`)
        }

        const fileInfo = variantInfo.files?.find(file => file.path === filePath)
        if (!fileInfo) {
          throw Error(`Missing file ${filePath} in '${packageId}#${variantId}'`)
        }

        const patchedFullPath = await this.getPatchedFile(
          context,
          packageId,
          variantId,
          fileInfo,
          exemplarProperties,
        )

        return openFile(patchedFullPath, FileOpenMode.READ, patchedFile => {
          return loadDBPF(patchedFile, { exemplarProperties, loadExemplars: true })
        })
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  public async loadDBPFEntry(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    entryId: TGI,
  ): Promise<DBPFEntry> {
    const { exemplarProperties, packages } = await this.load()

    return this.tasks.queue(`load:${packageId}#${variantId}/${filePath}#${entryId}`, {
      handler: async context => {
        const variantInfo = packages[packageId]?.variants[variantId]
        if (!variantInfo?.files) {
          throw Error(`Variant '${packageId}#${variantId}' is not installed`)
        }

        const fileInfo = variantInfo.files?.find(file => file.path === filePath)
        if (!fileInfo) {
          throw Error(`Missing file ${filePath} in '${packageId}#${variantId}'`)
        }

        const originalFullPath = this.getVariantFilePath(packageId, variantId, fileInfo.path)

        const patchedFullPath = await this.getPatchedFile(
          context,
          packageId,
          variantId,
          fileInfo,
          exemplarProperties,
        )

        // Load current data
        const entry = await openFile(patchedFullPath, FileOpenMode.READ, async patchedFile => {
          const contents = await loadDBPF(patchedFile, { exemplarProperties })
          const entry = contents.entries[entryId]

          if (!entry) {
            throw Error(`Missing entry ${entryId} in ${filePath}`)
          }

          entry.data = await loadDBPFEntry(patchedFile, entry, { exemplarProperties })
          return entry
        })

        // Load original data as needed
        if (originalFullPath !== patchedFullPath) {
          entry.original = await openFile(
            originalFullPath,
            FileOpenMode.READ,
            async originalFile => {
              const originalContents = await loadDBPF(originalFile, { exemplarProperties })
              const originalEntry = originalContents.entries[entryId]

              if (originalEntry) {
                return loadDBPFEntry(originalFile, originalEntry, { exemplarProperties })
              }
            },
          )
        }

        return entry
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  /**
   * Opens an author's homepage in browser, if present.
   */
  public async openAuthorURL(authorId: AuthorID): Promise<void> {
    const { authors } = await this.load()

    const authorInfo = authors[authorId]
    if (!authorInfo?.url) {
      throw Error(`Author '${authorId}' does not have a homepage URL`)
    }

    await this.openInExplorer(authorInfo.url)
  }

  /**
   * Opens the game's executable directory in Explorer.
   */
  public async openExecutableDirectory(): Promise<void> {
    const { settings } = await this.load()

    if (!settings.install?.path) {
      throw Error("Game installation path is not set")
    }

    await this.openInExplorer(path.dirname(path.join(settings.install.path, FILENAMES.sc4exe)))
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
  public async openInstallationDirectory(): Promise<void> {
    const { settings } = await this.load()

    if (!settings.install?.path) {
      throw Error("Game installation path is not set")
    }

    await this.openInExplorer(settings.install.path)
  }

  /**
   * Opens a package's config file in the default text editor.
   */
  public async openPackageConfig(packageId: PackageID): Promise<void> {
    const { packages } = await this.load()

    const packageInfo = packages[packageId]
    if (!packageInfo?.format) {
      throw Error(`Package '${packageId}' is not installed`)
    }

    const configName = FILENAMES.packageConfig + packageInfo.format
    await this.openInExplorer(path.join(this.getPackagePath(packageId), configName))
  }

  /**
   * Opens a variant's file in the default text editor.
   */
  public async openPackageFile(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<void> {
    await this.openInExplorer(this.getVariantFilePath(packageId, variantId, filePath))
  }

  /**
   * Opens a profile's config file in the default text editor.
   */
  public async openProfileConfig(profileId: ProfileID): Promise<void> {
    const { profiles } = await this.load()

    const profileInfo = profiles[profileId]
    if (!profileInfo?.format) {
      throw Error(`Profile '${profileId}' does not exist`)
    }

    const configName = profileId + profileInfo.format
    await this.openInExplorer(path.join(this.getProfilesPath(), configName))
  }

  /**
   * Opens a variant's URL in browser.
   */
  public async openVariantURL(
    packageId: PackageID,
    variantId: VariantID,
    type: "repository" | "support" | "url",
  ): Promise<void> {
    const { packages } = await this.load()

    const variantInfo = packages[packageId]?.variants[variantId]
    if (!variantInfo?.[type]) {
      const name = type === "url" ? "homepage" : type
      throw Error(`Variant '${packageId}#${variantId}' does not have a ${name} URL`)
    }

    await this.openInExplorer(variantInfo[type])
  }

  public async patchDBPFEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    patches: {
      [entryId in TGI]?: ExemplarDataPatch | null
    },
  ): Promise<DBPFFile> {
    const { categories, exemplarProperties, packages, settings } = await this.load()

    return this.tasks.queue(`patch:${packageId}#${variantId}/${filePath}`, {
      handler: async context => {
        const packageInfo = packages[packageId]
        if (!packageInfo) {
          throw Error(`Unknown package '${packageId}'`)
        }

        const variantInfo = packageInfo.variants[variantId]
        if (!variantInfo?.files) {
          throw Error(`Variant '${packageId}#${variantId}' is not installed`)
        }

        const fileInfo = variantInfo.files?.find(file => file.path === filePath)
        if (!fileInfo) {
          throw Error(`Missing file ${filePath} in '${packageId}#${variantId}'`)
        }

        const originalFullPath = this.getVariantFilePath(packageId, variantId, filePath)

        // For local variants, we apply changes to the file itself
        if (variantInfo.local) {
          const tempFullPath = this.getTempPath(originalFullPath)

          // Generate patched file in temp folder
          const file = await this.generatePatchedFile(
            context,
            originalFullPath,
            tempFullPath,
            mapValues(patches, patch => patch ?? undefined),
            exemplarProperties,
          )

          // Replace original file with the patched version
          await moveTo(tempFullPath, originalFullPath)

          // Unset original field (so renderer will not show a diff)
          forEach(file.entries, entry => {
            entry.original = undefined
          })

          return file
        }

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
          fileInfo.patches = undefined
        }

        let file: DBPFFile | undefined

        if (fileInfo.patches) {
          const patchedFullPath = this.getVariantFilePath(
            packageId,
            variantId,
            filePath,
            fileInfo.patches,
          )

          // Generate patched file and load new contents
          file = await this.generatePatchedFile(
            context,
            originalFullPath,
            patchedFullPath,
            fileInfo.patches,
            exemplarProperties,
          )
        } else {
          // Reload original contents
          file = await openFile(originalFullPath, FileOpenMode.READ, patchedFile => {
            return loadDBPF(patchedFile, { exemplarProperties, loadExemplars: true })
          })
        }

        // Delete old patches
        this.refreshPatches(packageId, variantId)

        // Trigger a relink of this package only if it is included in current profile
        if (settings.currentProfile) {
          if (isIncluded(variantInfo, packageInfo.status[settings.currentProfile])) {
            this.linkPackages({ packageId })
          }
        }

        for (const entry of values(file.entries)) {
          if (patches[entry.id] !== undefined) {
            if (entry.type === DBPFDataType.EXMP && entry.data && !entry.data.isCohort) {
              const instanceId = toHex(parseTGI(entry.id)[2], 8)
              switch (getExemplarType(entry.id, entry.data)) {
                case ExemplarType.Building: {
                  const buildingId = instanceId as BuildingID
                  const building = variantInfo.buildings?.find(
                    where({ file: filePath, id: buildingId }),
                  )

                  if (building) {
                    const exemplar = { ...entry, file: filePath } as Exemplar
                    const data = getBuildingData(exemplar)
                    $merge(building, loadBuildingInfo(filePath, buildingId, data, categories))
                  }

                  break
                }

                case ExemplarType.LotConfig: {
                  const lotId = instanceId as LotID
                  const lot = variantInfo.lots?.find(where({ file: filePath, id: lotId }))

                  if (lot) {
                    const exemplar = { ...entry, file: filePath } as Exemplar
                    const data = getLotData(exemplar)
                    $merge(lot, loadLotInfo(filePath, lotId, data))
                  }

                  break
                }

                case ExemplarType.Prop: {
                  const propId = instanceId as PropID
                  const prop = variantInfo.lots?.find(where({ file: filePath, id: propId }))

                  if (prop) {
                    const exemplar = { ...entry, file: filePath } as Exemplar
                    const data = getPropData(exemplar)
                    $merge(prop, loadPropInfo(filePath, propId, data))
                  }

                  break
                }
              }
            }
          }
        }

        // Persist config changes and send updates to renderer
        await this.writePackageConfig(context, packageInfo, categories)

        return file
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  protected async quit(): Promise<void> {
    await removeIfPresent(this.getTempPath())
  }

  /**
   * Recalculates package status/compatibility for the given profile.
   */
  protected recalculatePackages(
    packages: Packages,
    profileInfo: ProfileInfo,
    profileOptions: OptionInfo[],
    settings: Settings,
  ): Features {
    const { resultingFeatures, resultingStatus } = resolvePackages(
      packages,
      profileInfo,
      profileOptions,
      settings,
    )

    forEach(packages, (packageInfo, packageId) => {
      packageInfo.status[profileInfo.id] = resultingStatus[packageId]
    })

    // Trigger linking if current profile
    if (settings.currentProfile === profileInfo.id) {
      this.sendStateUpdate({ features: resultingFeatures, packages })
      this.linkPackages()
    } else {
      this.sendStateUpdate({ packages })
    }

    return resultingFeatures
  }

  protected async refreshPatches(packageId: PackageID, variantId: VariantID): Promise<void> {
    const { exemplarProperties, packages } = await this.load()

    return this.tasks.queue(`refresh:${packageId}#${variantId}`, {
      handler: async context => {
        const packageInfo = packages[packageId]
        if (!packageInfo) {
          throw Error(`Unknown package '${packageId}'`)
        }

        const variantInfo = packageInfo.variants[variantId]
        if (!variantInfo?.files) {
          throw Error(`Variant '${packageId}#${variantId}' is not installed`)
        }

        const basePath = this.getVariantPath(packageId, variantInfo.id)
        const patchesPath = path.join(basePath, DIRNAMES.patches)

        // Generate up-to-date patches
        const usefulPatchedFiles = new Set<string>()
        for (const file of variantInfo.files) {
          if (file.patches) {
            const patchedFullPath = await this.getPatchedFile(
              context,
              packageId,
              variantInfo.id,
              file,
              exemplarProperties,
            )

            usefulPatchedFiles.add(patchedFullPath)
          }
        }

        if (usefulPatchedFiles.size === 0) {
          // If there are no patches, delete that whole folder
          await removeIfPresent(patchesPath)
        } else {
          const patchesPaths = await glob("**", {
            cwd: patchesPath,
            nodir: true,
          })

          // Otherwise, remove only unused files
          for (const relativePath of patchesPaths) {
            const fullPath = path.join(patchesPath, relativePath)
            if (!usefulPatchedFiles.has(fullPath)) {
              await removeIfPresent(fullPath)
              await removeIfEmptyRecursive(path.dirname(fullPath), basePath)
            }
          }
        }
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  /**
   * Reloads data from files.
   */
  protected async reload() {
    this.ignoredWarnings.clear()
    this.tasks.invalidateCache()
    await this.load(true)
  }

  /**
   * Remove an installed variant.
   */
  public async removeProfile(profileId: ProfileID): Promise<boolean> {
    const { packages, profiles, profileOptions, settings } = await this.load()

    return this.tasks.queue(`remove:${profileId}`, {
      handler: async context => {
        const profileInfo = profiles[profileId]
        if (!profileInfo?.format) {
          throw Error(`Profile '${profileId}' does not exist`)
        }

        const newCurrentProfileId = keys(profiles).find(id => id !== profileId)
        if (!newCurrentProfileId) {
          throw Error("Cannot remove last profile")
        }

        const { confirmed } = await showConfirmation(
          i18n.t("RemoveProfileModal:title"),
          i18n.t("RemoveProfileModal:confirmation", { profileName: profileInfo.name }),
          i18n.t("RemoveProfileModal:description"),
          false,
          "warning",
        )

        if (!confirmed) {
          return false
        }

        // Change selected profile
        if (settings.currentProfile === profileId) {
          context.debug(`Selecting profile '${newCurrentProfileId}'...`)
          settings.currentProfile = newCurrentProfileId
          await this.writeSettings(context, settings)
          this.recalculatePackages(packages, profileInfo, profileOptions, settings)
        }

        context.debug(`Removing profile '${profileId}'...`)

        // Remove config file
        await removeConfig(this.getProfilesPath(), profileId, profileInfo.format)
        profileInfo.format = undefined

        // Send update to renderer
        this.sendStateUpdate({ profiles: { [profileId]: null } })

        await showSuccess(i18n.t("RemoveProfileModal:title"), i18n.t("RemoveProfileModal:success"))

        return true
      },
      pool: "main",
    })
  }

  /**
   * Remove an installed variant.
   */
  public async removeVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    // TODO: ATM this does not clean obsolete files from Downloads sub-folder!
    const { categories, packages, profiles } = await this.load()

    await this.tasks.queue(`remove:${packageId}#${variantId}`, {
      handler: async context => {
        // TODO: ATM this does not clean obsolete files from Downloads sub-folder!
        const packageInfo = packages[packageId]
        if (!packageInfo) {
          throw Error(`Unknown package '${packageId}'`)
        }

        const variantInfo = packageInfo.variants[variantId]
        if (!variantInfo) {
          throw Error(`Unknown variant '${packageId}#${variantId}'`)
        }

        if (!variantInfo.installed) {
          throw Error(`Variant '${packageId}#${variantId}' is not installed`)
        }

        const allVariants = values(packageInfo.variants)
        const installedVariants = allVariants.filter(variant => variant.installed)
        const isOnlyInstalledVariant = installedVariants.length === 1
        const namespace = isOnlyInstalledVariant ? "RemovePackageModal" : "RemoveVariantModal"

        // Confirm removal of local variants as files will be definitively lost
        if (variantInfo.local) {
          const { confirmed } = await showConfirmation(
            packageInfo.name,
            t(`${namespace}:confirmation`),
            t(`${namespace}:description`, {
              packageName: packageInfo.name,
              variantName: variantInfo.name,
            }),
          )

          if (!confirmed) {
            return
          }
        }

        try {
          context.info(`Removing variant '${packageId}#${variantId}'...`)

          variantInfo.action = "removing"
          this.sendPackageUpdate(packageInfo)

          variantInfo.files = undefined
          variantInfo.installed = undefined

          // Upon removing the only installed variant, remove the whole package directory
          if (isOnlyInstalledVariant) {
            await removeIfPresent(this.getPackagePath(packageId))
          } else {
            await removeIfPresent(this.getVariantPath(packageId, variantId))
            await this.writePackageConfig(context, packageInfo, categories)
          }

          // TODO: This assumes that package is disabled in other profiles!
          if (variantInfo.local) {
            if (isOnlyInstalledVariant) {
              delete packages[packageId]
            } else {
              delete packageInfo.variants[variantId]

              // Unselect the removed variant
              forEach(packageInfo.status, (packageStatus, profileId) => {
                const profileInfo = profiles[profileId]
                if (profileInfo && packageStatus.variantId === variantId) {
                  const defaultVariant = getDefaultVariant(packageInfo, profileInfo)
                  packageStatus.variantId = defaultVariant.id
                }
              })
            }
          }
        } finally {
          variantInfo.action = undefined

          if (packages[packageId]) {
            this.sendPackageUpdate(packageInfo)
          } else {
            this.sendStateUpdate({ packages: { [packageId]: null } })
          }
        }
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  /**
   * Sends updates to a single package to the renderer.
   */
  protected sendPackageUpdate(packageInfo: PackageInfo): void {
    this.sendStateUpdate({ packages: { [packageInfo.id]: packageInfo } })
  }

  /**
   * Sends updates to a single package to the renderer.
   */
  protected sendProfileUpdate(profileInfo: ProfileInfo): void {
    this.sendStateUpdate({ profiles: { [profileInfo.id]: profileInfo } })
  }

  /**
   * Sends updates to the renderer.
   */
  protected sendStateUpdate(data: ApplicationStateUpdate): void {
    this.mainWindow?.webContents.postMessage("updateState", data)
  }

  /**
   * Initiates a login to Simtropolis.
   */
  public async simtropolisLogin(): Promise<void> {
    const session = await simtropolisLogin(this.browserSession)
    if (session) {
      console.info("Logged in to Simtropolis")
      this.simtropolisSession = session
      this.sendStateUpdate({ simtropolis: { userId: session.userId } })
    }
  }

  /**
   * Logs out of Simtropolis.
   */
  public async simtropolisLogout(): Promise<void> {
    await simtropolisLogout(this.browserSession)
    console.info("Logged out from Simtropolis")
    this.simtropolisSession = null
    this.sendStateUpdate({ simtropolis: null })
  }

  /**
   * Checks out a profile by ID.
   */
  public async switchProfile(profileId: ProfileID): Promise<void> {
    const { packages, profiles, profileOptions, settings } = await this.load()

    await this.tasks.queue(`switch:${profileId}`, {
      handler: async context => {
        const profileInfo = profiles[profileId]
        if (!profileInfo) {
          throw Error(`Profile '${profileId}' does not exist`)
        }

        if (settings.currentProfile === profileId) {
          return
        }

        context.debug(`Selecting profile '${profileId}'...`)

        settings.currentProfile = profileId

        await this.writeSettings(context, settings)

        this.recalculatePackages(packages, profileInfo, profileOptions, settings)
      },
      pool: "main",
    })
  }

  /**
   * Attempts to pull latest data from the remote Git repository.
   * @param isReload whether to force refetching new data
   */
  protected async updateDatabase(isReload?: boolean): Promise<void> {
    await this.tasks.queue("db:update", {
      cache: true,
      handler: async context => {
        const origin = this.getDataRepository()
        if (!isURL(origin)) {
          return
        }

        const databasePath = this.getDatabasePath()
        await createIfMissing(databasePath)

        const branch = env.DATA_BRANCH || "main"
        context.info(`Updating database from ${origin}/${branch}...`)

        try {
          await new Promise<void>((resolve, reject) => {
            createChildProcess<
              UpdateDatabaseProcessData,
              EmptyRecord,
              UpdateDatabaseProcessResponse
            >(updateDatabaseProcessPath, {
              cwd: databasePath,
              data: {
                branch,
                origin,
              },
              onClose() {
                reject(Error("Closed"))
              },
              onMessage({ success, error }) {
                if (success) {
                  resolve()
                } else {
                  reject(error)
                }
              },
            })
          })

          context.info("Updated database")
        } catch (error) {
          context.warn("Failed to update database", error)
        }
      },
      invalidate: isReload,
      pool: "db",
    })
  }

  public async updateProfile(profileId: ProfileID, update: ProfileUpdate): Promise<boolean> {
    const key = `update:${profileId}#${toHex(Date.now(), 8)}`

    const confirmedWarnings: { [id: string]: PackageID[] } = {}

    let result: boolean | undefined

    while (result === undefined) {
      const { assets, features, packages, profiles, profileOptions, settings } = await this.load()

      const profileInfo = profiles[profileId]
      if (!profileInfo) {
        throw Error(`Profile '${profileId}' does not exist`)
      }

      result = await this.tasks.queue(key, {
        handler: async context => {
          update.features ??= {}
          update.options ??= {}
          update.packages ??= {}

          // Resolve conflicts/dependencies caused by pending profile changes
          if (!isEmpty(update.features) || !isEmpty(update.options) || !isEmpty(update.packages)) {
            const {
              disablingPackages,
              enablingPackages,
              explicitVariantChanges,
              implicitOptionChanges,
              implicitVariantChanges,
              incompatibleExternals,
              incompatiblePackages,
              installingVariants,
              resultingFeatures,
              resultingProfile,
              resultingStatus,
              shouldRecalculate,
              warnings,
            } = resolvePackageUpdates(
              context,
              packages,
              profileInfo,
              profileOptions,
              features,
              settings,
              update,
            )

            try {
              if (shouldRecalculate) {
                // Set enabling/disabling status
                for (const packageId of disablingPackages) {
                  const packageStatus = packages[packageId]?.status[profileId]
                  if (packageStatus) {
                    packageStatus.action = "disabling"
                  }
                }

                for (const packageId of enablingPackages) {
                  const packageStatus = packages[packageId]?.status[profileId]
                  if (packageStatus) {
                    packageStatus.action = "enabling"
                  }
                }

                this.sendStateUpdate(packages)

                // Apply implicit variant changes automatically
                if (!isEmpty(implicitVariantChanges)) {
                  for (const [packageId, variantIds] of entries(implicitVariantChanges)) {
                    update.packages[packageId] ??= {}
                    update.packages[packageId].variant = variantIds.new
                  }

                  // Recalculate
                  return
                }

                // Confirm incompatible externals
                if (incompatibleExternals.length) {
                  const featureNames = incompatibleExternals.map(feature => {
                    return getFeatureLabel(i18n.t, feature, "long")
                  })

                  const response = await showConflictConfirmation({
                    cancelLabel: i18n.t("ReplaceExternalPackagesModal:cancel"),
                    confirmLabel: i18n.t("ReplaceExternalPackagesModal:confirm"),
                    description: i18n.t("ReplaceExternalPackagesModal:description", {
                      features: featureNames.sort(),
                    }),
                    ignoreLabel: t("ReplaceExternalPackagesModal:ignore"),
                    message: t("ReplaceExternalPackagesModal:confirmation"),
                    title: t("ReplaceExternalPackagesModal:title"),
                  })

                  // Cancel
                  if (response === ConflictConfirmationResponse.CANCEL) {
                    return false
                  }

                  // Disable conflicted externals
                  if (response === ConflictConfirmationResponse.CONFIRM) {
                    for (const feature of incompatibleExternals) {
                      update.features[feature] = false
                    }

                    // Recalculate
                    return
                  }

                  // Ignore conflicted externals
                  for (const feature of incompatibleExternals) {
                    update.features[feature] = true
                  }
                }

                // Confirm fully-incompatible packages
                if (incompatiblePackages.length) {
                  const packageNames = incompatiblePackages.map(packageId => {
                    const packageInfo = packages[packageId]
                    return packageInfo?.name ?? packageId
                  })

                  const response = await showConflictConfirmation({
                    cancelLabel: i18n.t("DisableIncompatiblePackagesModal:cancel"),
                    confirmLabel: i18n.t("DisableIncompatiblePackagesModal:confirm"),
                    description: i18n.t("DisableIncompatiblePackagesModal:description", {
                      packages: packageNames.sort(),
                    }),
                    ignoreLabel: t("DisableIncompatiblePackagesModal:ignore"),
                    message: t("DisableIncompatiblePackagesModal:confirmation"),
                    title: t("DisableIncompatiblePackagesModal:title"),
                  })

                  // Cancel
                  if (response === ConflictConfirmationResponse.CANCEL) {
                    return false
                  }

                  // Disable fully-incompatible packages
                  if (response === ConflictConfirmationResponse.CONFIRM) {
                    for (const packageId of incompatiblePackages) {
                      update.packages[packageId] ??= {}
                      update.packages[packageId].enabled = false
                    }

                    // Recalculate
                    return
                  }

                  // Ignore fully-incompatible packages
                  for (const packageId of incompatiblePackages) {
                    update.packages[packageId] ??= {}
                    update.packages[packageId].enabled = true
                  }
                }

                // Confirm explicit variant changes
                if (!isEmpty(explicitVariantChanges)) {
                  const variants = collect(explicitVariantChanges, (variants, packageId) => {
                    const packageInfo = packages[packageId]
                    const oldVariant = packageInfo?.variants[variants.old]
                    const newVariant = packageInfo?.variants[variants.new]
                    return t("InstallCompatibleVariantsModal:variant", {
                      newVariantName: newVariant?.name ?? variants.new,
                      oldVariantName: oldVariant?.name ?? variants.old,
                      packageName: packageInfo?.name ?? packageId,
                    })
                  })

                  const response = await showConflictConfirmation({
                    cancelLabel: i18n.t("InstallCompatibleVariantsModal:cancel"),
                    confirmLabel: i18n.t("InstallCompatibleVariantsModal:confirm"),
                    description: i18n.t("InstallCompatibleVariantsModal:description", {
                      variants: variants.sort(),
                    }),
                    ignoreLabel: t("InstallCompatibleVariantsModal:ignore"),
                    message: t("InstallCompatibleVariantsModal:confirmation"),
                    title: t("InstallCompatibleVariantsModal:title"),
                  })

                  // Cancel
                  if (response === ConflictConfirmationResponse.CANCEL) {
                    return false
                  }

                  // Switch to compatible variants
                  if (response === ConflictConfirmationResponse.CONFIRM) {
                    for (const [packageId, variantIds] of entries(explicitVariantChanges)) {
                      update.packages[packageId] ??= {}
                      update.packages[packageId].variant = variantIds.new
                    }

                    // Recalculate
                    return
                  }

                  // Ignore incompatible variants
                  for (const [packageId, variantIds] of entries(explicitVariantChanges)) {
                    update.packages[packageId] ??= {}
                    update.packages[packageId].variant = variantIds.old
                  }
                }

                // Confirm dependencies with features
                for (const packageId of enablingPackages) {
                  const packageInfo = packages[packageId]
                  const packageStatus = resultingStatus[packageId]
                  if (!packageInfo || !packageStatus) {
                    context.raiseInDev(`Unknown package '${packageId}'`)
                    continue
                  }

                  const variantInfo = packageInfo.variants[packageStatus.variantId]

                  const dependencyIds = variantInfo?.dependencies
                    ?.map(dependency => dependency.id)
                    .filter(dependencyId => {
                      const dependencyInfo = packages[dependencyId]
                      const dependencyStatus = resultingStatus[dependencyId]
                      if (!dependencyInfo || !dependencyStatus) {
                        context.raiseInDev(`Unknown package '${dependencyId}'`)
                        return false
                      }

                      return !!dependencyInfo.features?.length && !dependencyStatus.enabled
                    })

                  if (dependencyIds?.length) {
                    const dependencyNames = dependencyIds.map(dependencyId => {
                      const dependencyInfo = packages[dependencyId]
                      return dependencyInfo?.name ?? dependencyId
                    })

                    const { confirmed } = await showConfirmation(
                      packageInfo.name,
                      t("EnableFeatures:confirmation"),
                      t("EnableFeatures:description", {
                        dependencies: dependencyNames.sort(),
                        packageName: packageInfo.name,
                      }),
                    )

                    // Cancel
                    if (!confirmed) {
                      return false
                    }

                    for (const dependencyId of dependencyIds) {
                      update.packages[dependencyId] ??= {}
                      update.packages[dependencyId].enabled = true
                    }

                    // Recalculate
                    return
                  }
                }

                // Confirm optional dependencies
                for (const packageId of enablingPackages) {
                  const packageInfo = packages[packageId]
                  const packageStatus = resultingStatus[packageId]
                  if (!packageInfo || !packageStatus) {
                    context.raiseInDev(`Unknown package '${packageId}'`)
                    continue
                  }

                  const variantInfo = packageInfo.variants[packageStatus.variantId]

                  const dependencyIds = variantInfo?.optional?.filter(dependencyId => {
                    const dependencyInfo = packages[dependencyId]
                    const dependencyStatus = resultingStatus[dependencyId]
                    if (!dependencyInfo || !dependencyStatus) {
                      context.raiseInDev(`Unknown package '${dependencyId}'`)
                      return false
                    }

                    return (
                      !dependencyStatus.enabled &&
                      !dependencyStatus.issues?.[dependencyStatus.variantId]?.length &&
                      update.packages?.[packageId]?.enabled !== undefined
                    )
                  })

                  if (dependencyIds?.length) {
                    const dependencyNames = dependencyIds.map(dependencyId => {
                      const dependencyInfo = packages[dependencyId]
                      return dependencyInfo?.name ?? dependencyId
                    })

                    const { confirmed } = await showConfirmation(
                      packageInfo.name,
                      t("EnableOptionalDependencies:confirmation"),
                      t("EnableOptionalDependencies:description", {
                        dependencies: dependencyNames.sort(),
                        packageName: packageInfo.name,
                      }),
                    )

                    for (const dependencyId of dependencyIds) {
                      update.packages[dependencyId] ??= {}
                      update.packages[dependencyId].enabled = confirmed
                    }

                    // Recalculate
                    if (confirmed) {
                      return
                    }
                  }
                }

                // Apply implicit option changes automatically
                if (!isEmpty(implicitOptionChanges)) {
                  for (const [packageId, options] of entries(implicitOptionChanges)) {
                    update.packages[packageId] ??= {}
                    update.packages[packageId].options = {
                      ...update.packages[packageId].options,
                      ...options.new,
                    }
                  }

                  // Recalculate
                  return
                }

                // Confirm warnings
                for (const warning of values(warnings)) {
                  if (this.ignoredWarnings.has(warning.id)) {
                    continue
                  }

                  const packageIds = warning.packageIds.filter(packageId => {
                    return !confirmedWarnings[warning.id]?.includes(packageId)
                  })

                  if (!packageIds.length) {
                    continue
                  }

                  const packageNames = packageIds.map(packageId => {
                    const packageInfo = packages[packageId]
                    return packageInfo?.name ?? packageId
                  })

                  const { confirmed, doNotAskAgain } = await showConfirmation(
                    i18n.t("WarningModal:title", {
                      count: packageNames.length - 1,
                      packageName: packageNames[0],
                    }),
                    warning.title,
                    warning.message,
                    !warning.id.includes(":"),
                    "warning",
                    i18n.t("continue"),
                    i18n.t("cancel"),
                  )

                  if (doNotAskAgain && warning.id) {
                    this.ignoredWarnings.add(warning.id)
                  }

                  if (!confirmed) {
                    return false
                  }

                  confirmedWarnings[warning.id] ??= []
                  confirmedWarnings[warning.id].push(...packageIds)
                }

                // Confirm download of new assets
                if (!isEmpty(installingVariants)) {
                  /** Assets that will be downloaded */
                  const missingAssets = uniqueBy(
                    entries(installingVariants).flatMap(([packageId, variantId]) =>
                      mapDefined(
                        packages[packageId]?.variants[variantId]?.assets ?? [],
                        asset => assets[asset.id],
                      ).filter(assetInfo => !assetInfo.downloaded[assetInfo.version]),
                    ),
                    assetInfo => assetInfo.id,
                  )

                  /** Dependencies that will be installed */
                  const missingDependencyIds = keys(installingVariants).filter(packageId => {
                    return isDependency(resultingStatus[packageId])
                  })

                  if (missingAssets.length) {
                    const dependencyNames = missingDependencyIds.map(dependencyId => {
                      const dependencyInfo = packages[dependencyId]
                      return dependencyInfo?.name ?? dependencyId
                    })

                    const totalSize = missingAssets.every(asset => asset.size)
                      ? sumBy(missingAssets, asset => asset.size ?? 0)
                      : undefined

                    const { confirmed } = await showConfirmation(
                      t("DownloadAssetsModal:title"),
                      t("DownloadAssetsModal:confirmation"),
                      missingDependencyIds.length
                        ? [
                            t("DownloadAssetsModal:descriptionDependencies", {
                              dependencies: dependencyNames.sort(),
                              count: missingDependencyIds.length,
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
                    collect(installingVariants, async (variantId, packageId) => {
                      await this.installVariant(packageId, variantId)
                    }),
                  )

                  // Recalculate (conflicts may have changed during install?)
                  return
                }
              }

              // Apply config changes
              Object.assign(profileInfo, resultingProfile)

              // Apply status changes
              forEach(packages, (packageInfo, packageId) => {
                packageInfo.status[profileId] = resultingStatus[packageId]
              })

              // Run cleaner and linker
              if (shouldRecalculate && settings.currentProfile === profileId) {
                this.sendStateUpdate({ features: resultingFeatures })
                this.cleanPackages({ packageIds: enablingPackages })
                this.linkPackages()
              }
            } finally {
              if (shouldRecalculate) {
                // Unset enabling/disabling status
                for (const packageId of disablingPackages) {
                  const packageStatus = packages[packageId]?.status[profileId]
                  if (packageStatus?.action === "disabling") {
                    packageStatus.action = undefined
                  }
                }

                for (const packageId of enablingPackages) {
                  const packageStatus = packages[packageId]?.status[profileId]
                  if (packageStatus?.action === "enabling") {
                    packageStatus.action = undefined
                  }
                }

                this.sendStateUpdate({ packages })
              }
            }
          }

          if (update.name) {
            profileInfo.name = update.name
          }

          await this.writeProfileConfig(context, profileInfo)

          return true
        },
        invalidate: true,
        pool: "main",
      })
    }

    return result
  }

  protected async writePackageConfig(
    context: TaskContext,
    packageInfo: PackageInfo,
    categories: Categories,
  ): Promise<void> {
    context.debug(`Saving package '${packageInfo.id}'...`)

    await writeConfig<PackageData>(
      this.getPackagePath(packageInfo.id),
      FILENAMES.packageConfig,
      writePackageInfo(packageInfo, true, categories),
      ConfigFormat.YAML,
      packageInfo.format,
    )

    packageInfo.format = ConfigFormat.YAML

    this.sendPackageUpdate(packageInfo)
  }

  protected async writeProfileConfig(
    context: TaskContext,
    profileInfo: ProfileInfo,
  ): Promise<void> {
    context.debug(`Saving profile '${profileInfo.id}'...`)

    compactProfileConfig(profileInfo)

    await writeConfig<ProfileData>(
      this.getProfilesPath(),
      profileInfo.id,
      toProfileData(profileInfo),
      ConfigFormat.YAML,
      profileInfo.format,
    )

    profileInfo.format = ConfigFormat.YAML

    this.sendProfileUpdate(profileInfo)
  }

  protected async writeSettings(context: TaskContext, settings: Settings): Promise<void> {
    context.debug("Saving settings...")

    await writeConfig<SettingsData>(
      this.getRootPath(),
      FILENAMES.settings,
      toSettingsData(settings),
      ConfigFormat.YAML,
      settings.format,
    )

    settings.format = ConfigFormat.YAML
    this.sendStateUpdate({ settings })
  }
}
