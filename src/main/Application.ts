import fs from "node:fs/promises"
import path from "node:path"

import {
  $merge,
  type EmptyRecord,
  collect,
  entries,
  filterValues,
  forEach,
  forEachAsync,
  isEmpty,
  keys,
  mapDefined,
  mapValues,
  size,
  sortBy,
  sumBy,
  toHex,
  union,
  uniqueBy,
  values,
  where,
} from "@salinco/nice-utils"
import log, { type LogLevel } from "electron-log"
import { net, Menu, type Session, app, ipcMain, session } from "electron/main"
import escapeHtml from "escape-html"

import type { AssetInfo, Assets } from "@common/assets"
import type { AuthorID } from "@common/authors"
import type { BuildingID } from "@common/buildings"
import type { Categories } from "@common/categories"
import {
  DBPFDataType,
  type DBPFInfo,
  type DBPFLoadedEntryInfo,
  type GroupID,
  type TGI,
  type TypeID,
} from "@common/dbpf"
import {
  type ExemplarDataPatch,
  type ExemplarProperties,
  ExemplarType,
  getExemplarType,
} from "@common/exemplars"
import { getFeatureLabel, i18n, initI18n, t } from "@common/i18n"
import type { LotID, LotInfo } from "@common/lots"
import { type OptionInfo, getOptionValue } from "@common/options"
import {
  type PackageID,
  checkFile,
  getOwnerId,
  isDependency,
  isIncluded,
  isInstalled,
  isLocal,
  isPatched,
  isSelected,
} from "@common/packages"
import type { FileContents, Index } from "@common/plugins"
import {
  type ProfileData,
  type ProfileID,
  type ProfileInfo,
  type ProfileUpdate,
  createUniqueId,
} from "@common/profiles"
import type { PropID } from "@common/props"
import {
  type CityBackupInfo,
  type CityID,
  type CityInfo,
  type RegionID,
  type UpdateSaveAction,
  getCityFileName,
  getCityLinkedProfileId,
  getRegionLinkedProfileId,
  hasBackup,
} from "@common/regions"
import type { Settings, SettingsData } from "@common/settings"
import type {
  ApplicationState,
  ApplicationStateUpdate,
  ApplicationStatusUpdate,
} from "@common/state"
import type { ToolID } from "@common/tools"
import { ConfigFormat, type Features, type PackageInfo, type Packages } from "@common/types"
import { globToRegex } from "@common/utils/glob"
import { split } from "@common/utils/string"
import type { EditableVariantInfo, FileInfo, VariantID } from "@common/variants"
import { getDefaultVariant } from "@common/variants"
import { loadConfig, removeConfig, writeConfig } from "@node/configs"
import { getAssetKey } from "@node/data/assets"
import { loadAuthors } from "@node/data/authors"
import { loadBuildingInfo } from "@node/data/buildings"
import { loadCollections } from "@node/data/collections"
import { CLEANITOL_EXTENSIONS, DOC_EXTENSIONS, SC4_EXTENSIONS, matchFiles } from "@node/data/files"
import { loadLotInfo } from "@node/data/lots"
import { type PackageData, writePackageInfo } from "@node/data/packages"
import { loadPropInfo } from "@node/data/props"
import { DBPF } from "@node/dbpf"
import { getBuildingInfo } from "@node/dbpf/buildings"
import { getLotInfo } from "@node/dbpf/lots"
import { getPropInfo } from "@node/dbpf/props"
import type { Exemplar } from "@node/dbpf/types"
import { download } from "@node/download"
import { extractClickTeam, extractRecursively } from "@node/extract"
import { get } from "@node/fetch"
import {
  FileOpenMode,
  fsCopy,
  fsCreate,
  fsExists,
  fsMove,
  fsOpen,
  fsQueryFiles,
  fsRead,
  fsRemove,
  fsRemoveIfEmptyRecursive,
  fsSymlink,
  fsWrite,
  getExtension,
  getFileSize,
  getFileVersion,
  getFilename,
  isChildPath,
  isDirectory,
  isErrorCode,
  isURL,
  joinPosix,
  toPosix,
} from "@node/files"
import { hashCode } from "@node/hash"
import { cmd, runFile } from "@node/processes"
import type { TaskContext } from "@node/tasks"
import {
  ConflictConfirmationResponse,
  showConfirmation,
  showConflictConfirmation,
  showSuccess,
  showWarning,
} from "@utils/dialog"
import { getPluginsFolderName } from "@utils/linker"
import { MainWindow } from "./MainWindow"
import { SplashScreen } from "./SplashScreen"
import { type AppConfig, loadAppConfig } from "./data/config"
import {
  loadCategories,
  loadExemplarProperties,
  loadMaxisContents,
  loadPlugins,
  loadProfileOptions,
  loadProfileTemplates,
  loadTools,
} from "./data/db"
import { calculateIndex } from "./data/indexes"
import { loadDownloadedAssets, loadLocalPackages, loadRemotePackages } from "./data/packages"
import { resolvePackageUpdates, resolvePackages } from "./data/packages/resolve"
import { compactProfileConfig, loadProfiles, toProfileData } from "./data/profiles"
import { getBackupFileName, loadRegions } from "./data/regions"
import { loadSaveInfo } from "./data/saves/load"
import { fixSave, growify, makeHistorical, updateLots } from "./data/saves/update"
import { loadSettings, toSettingsData } from "./data/settings"
import type {
  UpdateDatabaseProcessData,
  UpdateDatabaseProcessResponse,
} from "./processes/updateDatabase/types"
import updateDatabaseProcessPath from "./processes/updateDatabase?modulePath"
import { DIRNAMES, FILENAMES, TEMPLATE_PREFIX } from "./utils/constants"
import { env, isDev } from "./utils/env"
import { check4GBPatch, checkDgVoodoo } from "./utils/exe"
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
import { TaskManager } from "./utils/tasks"

type Loaded = {
  [K in Exclude<keyof ApplicationState, "simtropolis">]-?: Exclude<ApplicationState[K], undefined>
} & {
  assets: Assets
  maxis: FileContents
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
    const originFullPath = path.resolve(pluginsPath, relativePath)
    const targetFullPath = path.resolve(this.getPluginsBackupPath(), relativePath)
    await fsMove(originFullPath, targetFullPath, { overwrite: true })

    // Clean up empty folders
    await fsRemoveIfEmptyRecursive(path.dirname(originFullPath), pluginsPath)
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
   * Checks DgVoodoo setup and suggests installing it.
   */
  public async checkDgVoodoo(isStartupCheck?: boolean): Promise<boolean> {
    const { settings } = await this.load()

    return this.tasks.queue("dgvoodoo:check", {
      handler: async context => {
        if (!settings.install?.path) {
          throw Error("Game installation path is not set")
        }

        const { applied, doNotAskAgain } = await checkDgVoodoo(context, settings.install.path, {
          installTool: async toolId => this.installTool(toolId),
          isStartupCheck,
          skipSuggestion: isStartupCheck && settings.install.voodoo === false,
        })

        if (applied) {
          settings.install.voodoo = true
        } else if (isStartupCheck && doNotAskAgain) {
          settings.install.voodoo = false
        } else {
          settings.install.voodoo = undefined
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
  public async cleanPlugins(
    options: {
      isSilent?: boolean
      isStartup?: boolean
      packageIds?: PackageID[]
    } = {},
  ): Promise<void> {
    const state = await this.load()

    const { packages, plugins, profiles, settings } = state

    await this.tasks.queue(options.packageIds ? `clean:${options.packageIds.join(",")}` : "clean", {
      handler: async context => {
        context.debug("Cleaning plugins...")
        context.setStep("Cleaning plugins...")

        let nPackages = 0

        const profileInfo = profiles && settings.currentProfile && profiles[settings.currentProfile]

        forEach(plugins, file => {
          file.issues = undefined
        })

        if (profileInfo) {
          const nTotalPackages = size(packages)
          await forEachAsync(packages, async (packageInfo, packageId) => {
            context.setProgress(nPackages++, nTotalPackages)

            const packageStatus = packageInfo.status[profileInfo.id]
            if (!packageStatus?.included) {
              return
            }

            const variantId = packageStatus.variantId
            const variantInfo = packageInfo.variants[variantId]
            if (!variantInfo?.files) {
              context.warn(`Variant '${packageId}#${variantId}' is not installed`)
              return
            }

            const conflictingPaths: string[] = []
            const filePaths = new Set(variantInfo.files.map(file => getFilename(file.path)))

            const variantPath = this.getVariantPath(packageId, variantId)
            const cleanitolPath = path.resolve(variantPath, DIRNAMES.cleanitol)

            const cleanitolFiles = await fsQueryFiles(cleanitolPath, "**/*.txt")

            // TODO: Handle more complex Cleanitol formats
            for (const cleanitolFile of cleanitolFiles) {
              const contents = await fsRead(path.resolve(cleanitolPath, cleanitolFile))
              for (const line of contents.split("\n")) {
                const filePath = line.split(";")[0].trim()

                if (filePath) {
                  filePaths.add(filePath)
                }
              }
            }

            for (const filePath of filePaths) {
              forEach(plugins, (file, pluginPath) => {
                if (path.basename(pluginPath) === filePath) {
                  conflictingPaths.push(pluginPath)
                  file.issues ??= {}
                  file.issues.conflictingPackages ??= []
                  file.issues.conflictingPackages.push(packageId)
                }
              })
            }

            if (
              conflictingPaths.length &&
              !options.isSilent &&
              (!options.isStartup || settings.startup.removeConflictingPlugins) &&
              (!options.packageIds || options.packageIds.includes(packageId))
            ) {
              const { confirmed, doNotAskAgain } = await showConfirmation(
                packageInfo.name,
                t("RemoveConflictingFilesModal:confirmation"),
                t("RemoveConflictingFilesModal:description", {
                  files: conflictingPaths.sort(),
                  pluginsBackup: DIRNAMES.pluginsBackup,
                }),
                options.isStartup,
              )

              if (confirmed) {
                for (const conflictingPath of conflictingPaths) {
                  await this.backUpFile(context, conflictingPath)
                  delete plugins[conflictingPath]
                }

                context.debug(`Resolved ${conflictingPaths.length} conflicts`)
              } else {
                context.debug(`Ignored ${conflictingPaths.length} conflicts`)

                if (doNotAskAgain) {
                  settings.startup.removeConflictingPlugins = false
                  this.writeSettings(context, settings)
                }
              }
            }
          })
        }

        const unsupportedPaths: string[] = []

        forEach(plugins, (file, pluginPath) => {
          const extension = getExtension(pluginPath)
          if (extension === ".dll" && pluginPath !== path.basename(pluginPath)) {
            file.issues ??= {}
            file.issues.dllNotTopLevel = true
          } else if (!SC4_EXTENSIONS.includes(extension)) {
            unsupportedPaths.push(pluginPath)
            file.issues ??= {}
            file.issues.unsupported = true
          }
        })

        // Prompt to remove unsupported files (e.g. leftover docs)
        if (
          unsupportedPaths.length &&
          !options.isSilent &&
          (!options.isStartup || settings.startup.removeUnsupportedPlugins) &&
          !options.packageIds
        ) {
          const { confirmed, doNotAskAgain } = await showConfirmation(
            t("RemoveUnsupportedFilesModal:title"),
            t("RemoveUnsupportedFilesModal:confirmation"),
            t("RemoveUnsupportedFilesModal:description", {
              files: unsupportedPaths.sort(),
              pluginsBackup: DIRNAMES.pluginsBackup,
            }),
            options.isStartup,
          )

          if (confirmed) {
            for (const unsupportedPath of unsupportedPaths) {
              await this.backUpFile(context, unsupportedPath)
              delete plugins[unsupportedPath]
            }

            context.debug(`Removed ${unsupportedPaths.length} unsupported files`)
          } else {
            context.debug(`Ignored ${unsupportedPaths.length} unsupported files`)

            if (doNotAskAgain) {
              settings.startup.removeUnsupportedPlugins = false
              this.writeSettings(context, settings)
            }
          }
        }

        this.indexPlugins()
      },
      invalidate: true,
      onStatusUpdate: info => {
        this.sendStatusUpdate({ linker: info })
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

    const logsPath = path.resolve(this.getPluginsPath(), variantInfo.logs)

    await fsRemove(logsPath)
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
                !packageStatus.some(
                  status =>
                    isIncluded(status[packageInfo.id]) &&
                    isSelected(variantInfo, status[packageInfo.id]),
                ),
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
        this.sendStatusUpdate({ loader: info })
      },
      pool: "main",
    })
  }

  /**
   * Stores a copy of the current city's save file inside "Backups" folder.
   */
  public async createBackup(
    regionId: RegionID,
    cityId: CityID,
    description?: string,
  ): Promise<boolean> {
    const { regions } = await this.load()

    const region = regions[regionId]
    if (!region) {
      throw Error(`Region '${regionId}' does not exist`)
    }

    const city = region.cities[cityId]
    if (!city) {
      throw Error(`City '${cityId}' does not exist`)
    }

    if (hasBackup(city)) {
      return false
    }

    await this.tasks.queue(`backup:create:${regionId}:${cityId}`, {
      handler: async context => {
        const cityFullPath = this.getCityPath(regionId, cityId)

        const backupTime = new Date()
        const backupFile = getBackupFileName(backupTime, description)
        const backupFullPath = this.getCityBackupPath(regionId, cityId, backupFile)

        context.debug(`Backing up '${regionId}/${cityId}'...`)

        await fsCopy(cityFullPath, backupFullPath)

        city.backups.push({
          description,
          file: backupFile,
          time: backupTime,
          version: city.version,
        })

        this.sendStateUpdate({ regions })
      },
      pool: `region:${regionId}`,
    })

    return true
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

        const fromFiles = await fsQueryFiles(this.getVariantPath(packageId, fromVariantId), "**", {
          exclude: `${DIRNAMES.patches}/**`,
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

            await fsCopy(realPath, toPath)
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
          await fsRemove(this.getVariantPath(packageId, variantId))
          delete packageInfo.variants[variantId]
          throw error
        }
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  /**
   * Edits a variant's metadata.
   * @param packageId Package ID
   * @param variantId Variant ID
   * @param data Data to replace
   */
  public async editVariant(
    packageId: PackageID,
    variantId: VariantID,
    data: EditableVariantInfo,
  ): Promise<void> {
    const { categories, packages, settings } = await this.load()

    const packageInfo = packages[packageId]
    if (!packageInfo) {
      throw Error(`Unknown package '${packageId}'`)
    }

    const variantInfo = packageInfo.variants[variantId]
    if (!variantInfo) {
      throw Error(`Unknown variant '${packageId}#${variantId}'`)
    }

    await this.tasks.queue(`edit:${packageId}#${variantId}`, {
      handler: async context => {
        variantInfo.authors = data.authors
        variantInfo.categories = data.categories
        variantInfo.credits = data.credits?.length ? data.credits : undefined
        variantInfo.deprecated = data.deprecated
        variantInfo.description = data.description
        variantInfo.experimental = data.experimental
        variantInfo.images = data.images?.length ? data.images : undefined
        variantInfo.name = data.name
        variantInfo.repository = data.repository
        variantInfo.summary = data.summary
        variantInfo.support = data.support
        variantInfo.thanks = data.thanks?.length ? data.thanks : undefined
        variantInfo.thumbnail = data.thumbnail
        variantInfo.url = data.url
        variantInfo.version = data.version

        await this.writePackageConfig(context, packageInfo, categories)

        if (settings.db.path && !variantInfo.local) {
          const ownerId = getOwnerId(packageId)
          const dbPackagesPath = path.resolve(settings.db.path, DIRNAMES.dbPackages)

          const config = await loadConfig<{ [packageId: PackageID]: PackageData }>(
            dbPackagesPath,
            ownerId,
          )

          if (config?.data[packageId]) {
            config.data[packageId] = writePackageInfo(packageInfo, false, categories)
            await writeConfig(dbPackagesPath, ownerId, config.data, ConfigFormat.YAML)
          }
        }
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  /**
   * Downloads an asset.
   */
  protected async downloadAsset(assetInfo: AssetInfo, isTool?: boolean): Promise<string> {
    const key = this.getDownloadKey(assetInfo)
    const downloadPath = this.getDownloadPath(assetInfo)

    await this.tasks.queue(`download:${key}`, {
      cache: true,
      handler: async context => {
        const downloaded = await fsExists(downloadPath)

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
        context.debug(`Extracting ${key}...`)

        await extractRecursively(downloadPath, {
          exePath: exe => this.getToolExePath(exe),
          isTool,
          logger: context,
          onProgress: context.setProgress,
        })
      },
      onStatusUpdate: info => {
        this.sendStatusUpdate({ downloads: { [key]: info } })
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
    patches: { [tgi in TGI]?: ExemplarDataPatch | null },
    exemplarProperties: ExemplarProperties,
  ): Promise<DBPFInfo> {
    context.info(`Patching ${path.basename(originalFullPath)}...`)

    await fsCreate(path.dirname(patchedFullPath))
    return fsOpen(originalFullPath, FileOpenMode.READ, async originalFile => {
      const dbpf = await DBPF.fromFile(originalFile)
      await dbpf.loadExemplars()
      return dbpf.patchEntries(patchedFullPath, patches, exemplarProperties)
    })
  }

  /**
   * Returns the absolute path to the 'Backups' directory.
   */
  public getBackupsPath(): string {
    return path.resolve(this.gamePath, DIRNAMES.backups)
  }

  /**
   * Returns the absolute path to a city's backup file.
   */
  public getCityBackupPath(regionId: RegionID, cityId: CityID, file: string): string {
    return path.resolve(this.getBackupsPath(), regionId, cityId, file)
  }

  /**
   * Returns the absolute path to a city's save file.
   */
  public getCityPath(regionId: RegionID, cityId: CityID): string {
    return path.resolve(this.getRegionsPath(), regionId, getCityFileName(cityId))
  }

  /**
   * Returns the absolute path to the local database files:
   * - When using a Git repository, returns the path to the local clone.
   * - When using a local repository, returns the path to the repository itself.
   */
  public getDatabasePath(settings: Settings): string {
    return settings.db.path ?? path.resolve(this.getRootPath(), DIRNAMES.db)
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
    return path.resolve(this.getDownloadsPath(), this.getDownloadKey(assetInfo))
  }

  /**
   * Returns the absolute path to the 'Downloads' directory.
   */
  public getDownloadsPath(): string {
    return path.resolve(this.getRootPath(), DIRNAMES.downloads)
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
    return path.resolve(this.getLogsPath(), FILENAMES.logs)
  }

  /**
   * Returns the absolute path to the 'Logs' directory, containing manager logs.
   */
  public getLogsPath(): string {
    return path.resolve(this.getRootPath(), DIRNAMES.logs)
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

    const logsPath = path.resolve(this.getPluginsPath(), variantInfo.logs)

    try {
      const size = await getFileSize(logsPath)
      const text = await fsRead(logsPath)
      return { size, text }
    } catch (error) {
      if (isErrorCode(error, "ENOENT")) {
        return null
      }

      throw error
    }
  }

  /**
   * Returns the absolute package to an installed package, by ID.
   */
  public getPackagePath(packageId: PackageID): string {
    return path.resolve(this.getPackagesPath(), packageId)
  }

  /**
   * Returns the absolute path to the 'Packages' directory, containing installed packages.
   */
  public getPackagesPath(): string {
    return path.resolve(this.getRootPath(), DIRNAMES.packages)
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

    const docPath = path.resolve(this.getVariantPath(packageId, variantId), DIRNAMES.docs, filePath)
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
    exemplarProperties: ExemplarProperties,
  ): Promise<string> {
    const originalFullPath = this.getVariantFilePath(packageId, variantId, fileInfo.path)
    const patches = fileInfo.patches

    if (!patches) {
      return originalFullPath
    }

    const patchedFullPath = this.getVariantFilePath(packageId, variantId, fileInfo.path, patches)
    const isGenerated = await fsExists(patchedFullPath)

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
    return path.resolve(this.gamePath, DIRNAMES.plugins)
  }

  /**
   * Returns the absolute path to the 'Plugins (Backup)' directory.
   */
  public getPluginsBackupPath(): string {
    return path.resolve(this.gamePath, DIRNAMES.pluginsBackup)
  }

  /**
   * Returns the absolute path to the 'Profiles' directory, containing profile configs.
   */
  public getProfilesPath(): string {
    return path.resolve(this.getRootPath(), DIRNAMES.profiles)
  }

  /**
   * Returns the absolute path to the 'Regions' directory.
   */
  public getRegionsPath(): string {
    return path.resolve(this.gamePath, DIRNAMES.regions)
  }

  /**
   * Returns the absolute path to the 'Manager' directory.
   */
  public getRootPath(): string {
    return path.resolve(this.gamePath, DIRNAMES.root)
  }

  /**
   * Returns the current state to synchronize with renderer.
   */
  public async getState(): Promise<ApplicationState> {
    const {
      authors,
      categories,
      collections,
      exemplarProperties,
      features,
      index,
      packages,
      plugins,
      profiles,
      profileOptions,
      regions,
      settings,
      templates,
      tools,
    } = await this.load()

    return {
      authors,
      categories,
      collections,
      exemplarProperties,
      features,
      index,
      packages,
      plugins,
      profiles,
      profileOptions,
      regions,
      settings,
      simtropolis: this.simtropolisSession?.sessionId
        ? {
            displayName: this.simtropolisSession.displayName,
            sessionId: isDev() ? this.simtropolisSession.sessionId : undefined,
            userId: this.simtropolisSession.userId,
          }
        : null,
      templates,
      tools,
    }
  }

  /**
   * Returns the absolute path to the temporary download directory.
   * @param fullPath if provided, returns the temporary corresponding
   */
  public getTempPath(fullPath?: string): string {
    if (fullPath) {
      if (isChildPath(fullPath, this.getRootPath())) {
        return path.resolve(this.getTempPath(), path.relative(this.getRootPath(), fullPath))
      }

      if (isChildPath(fullPath, this.gamePath)) {
        return path.resolve(this.getTempPath(), path.relative(this.gamePath, fullPath))
      }

      throw Error(`Cannot generate temporary path for ${fullPath}`)
    }

    return path.resolve(this.getRootPath(), DIRNAMES.temp)
  }

  /**
   * Returns the path to the given tool's main executable, downloading the tool as needed.
   */
  public async getToolExePath(toolId: ToolID): Promise<string> {
    const { assets, settings, tools } = await this.load()

    const toolInfo = tools[toolId]
    if (!toolInfo) {
      throw Error(`Unknown tool '${toolId}'`)
    }

    if (toolInfo.asset) {
      const assetInfo = assets[toolInfo.asset]
      if (!assetInfo) {
        throw Error(`Unknown asset '${toolInfo.asset}'`)
      }

      const downloadPath = this.getDownloadPath(assetInfo)
      const downloaded = await fsExists(downloadPath)

      if (!downloaded) {
        await this.downloadAsset(assetInfo, true)
      }

      if (toolInfo.install) {
        if (!settings.install?.path) {
          throw Error("Missing installation path")
        }

        return path.resolve(settings.install.path, toolInfo.exe)
      }

      return path.resolve(downloadPath, toolInfo.exe)
    }

    return toolInfo.exe
  }

  /**
   * Returns the absolute path to a variant's files.
   */
  public getVariantPath(packageId: PackageID, variantId: VariantID): string {
    return path.resolve(this.getPackagePath(packageId), variantId)
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

      return path.resolve(
        this.getVariantPath(packageId, variantId),
        DIRNAMES.patches,
        `${filePath.slice(0, -extension.length)}.${hash}${extension}`,
      )
    }

    return path.resolve(this.getVariantPath(packageId, variantId), filePath)
  }

  // biome-ignore lint/suspicious/noExplicitAny: function params generic
  protected handle<Event extends keyof this & string, Args extends any[]>(
    this: { [key in Event]: (...args: Args) => unknown },
    event: Event,
  ): void {
    ipcMain.handle(event, (_, ...args: Args) => this[event](...args))
  }

  protected async indexPlugins(): Promise<Index> {
    const state = await this.load()
    const { maxis, plugins } = state

    return this.tasks.queue("plugins:index", {
      handler: async context => {
        context.debug("Indexing plugins...")
        const index = calculateIndex({ ...maxis, ...plugins })
        state.index = index
        this.sendStateUpdate({ index, plugins })

        return index
      },
      invalidate: true,
      pool: "main",
    })
  }

  protected init(): void {
    // Register message handlers
    this.handle("check4GBPatch")
    this.handle("checkDgVoodoo")
    this.handle("cleanPlugins")
    this.handle("clearPackageLogs")
    this.handle("clearUnusedPackages")
    this.handle("createBackup")
    this.handle("createProfile")
    this.handle("createVariant")
    this.handle("editVariant")
    this.handle("getPackageLogs")
    this.handle("getPackageReadme")
    this.handle("getState")
    this.handle("installTool")
    this.handle("installVariant")
    this.handle("loadPluginFileEntries")
    this.handle("loadPluginFileEntry")
    this.handle("loadSavePreviewPicture")
    this.handle("loadVariantFileEntries")
    this.handle("loadVariantFileEntry")
    this.handle("openAuthorURL")
    this.handle("openDataRepository")
    this.handle("openExecutableDirectory")
    this.handle("openInstallationDirectory")
    this.handle("openPackageConfig")
    this.handle("openPackageFile")
    this.handle("openPackageURL")
    this.handle("openPluginFolder")
    this.handle("openProfileConfig")
    this.handle("openRegionFolder")
    this.handle("openToolFile")
    this.handle("openToolURL")
    this.handle("patchPluginFileEntries")
    this.handle("patchVariantFileEntries")
    this.handle("reloadPlugins")
    this.handle("removeBackup")
    this.handle("removePluginFile")
    this.handle("removeProfile")
    this.handle("removeTool")
    this.handle("removeVariant")
    this.handle("restoreBackup")
    this.handle("runTool")
    this.handle("simtropolisLogin")
    this.handle("simtropolisLogout")
    this.handle("switchProfile")
    this.handle("updateProfile")
    this.handle("updateSave")
    this.handle("updateSettings")

    this.initLogs()
    this.initCustomProtocols()

    this.initApplicationMenu()
    this.initMainWindow()

    // Initialize Simtropolis session
    getSimtropolisSession(this.browserSession).then(session => {
      if (session?.sessionId) {
        console.info("Logged in to Simtropolis")
        this.simtropolisSession = session
        this.sendStateUpdate({
          simtropolis: {
            displayName: session.displayName,
            sessionId: isDev() ? session.sessionId : undefined,
            userId: session.userId,
          },
        })
      } else {
        this.sendStateUpdate({ simtropolis: null })
      }
    })

    this.checkDgVoodoo(true)
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

  protected async initLinks(isReload?: boolean): Promise<Map<string, string>> {
    return this.tasks.queue("link:init", {
      cache: true,
      handler: async context => {
        context.setStep("Initializing links...")

        const pluginsPath = this.getPluginsPath()

        await fsCreate(pluginsPath)

        const links = new Map<string, string>()

        const symlinkPaths = await fsQueryFiles(pluginsPath, "**", {
          symlinks: true,
        })

        let nFiles = 0
        for (const symlinkPath of symlinkPaths) {
          context.setProgress(nFiles++, symlinkPaths.length)
          const targetPath = await fs.readlink(path.resolve(pluginsPath, symlinkPath))
          links.set(symlinkPath, targetPath)
        }

        context.debug(`Done (found ${links.size} links)`)

        return links
      },
      invalidate: isReload,
      onStatusUpdate: info => {
        this.sendStatusUpdate({ linker: info })
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

  /**
   * Install a tool.
   */
  public async installTool(toolId: ToolID): Promise<string> {
    const { assets, settings, tools } = await this.load()

    return this.tasks.queue(`install:${toolId}`, {
      handler: async context => {
        const toolInfo = tools[toolId]
        if (!toolInfo?.asset) {
          throw Error(`Unknown tool '${toolId}'`)
        }

        try {
          context.info(`Installing tool '${toolId}'...`)
          toolInfo.action = "installing"
          toolInfo.installed = false
          this.sendStateUpdate({ tools })

          const assetInfo = assets[toolInfo.asset]
          if (!assetInfo) {
            throw Error(`Unknown asset '${toolInfo.asset}'`)
          }

          if (!settings.install?.path) {
            throw Error("Missing installation path")
          }

          const downloadPath = await this.downloadAsset(assetInfo, true)

          try {
            if (toolInfo.install) {
              const basePath = path.resolve(downloadPath, toolInfo.install)
              const relativePaths = await fsQueryFiles(basePath, "**", {
                exclude: "**/4gb_patch.exe",
              })

              for (const relativePath of relativePaths) {
                const fullPath = path.resolve(basePath, relativePath)
                const targetPath = path.resolve(settings.install.path, relativePath)
                await fsMove(fullPath, targetPath, { overwrite: true })
              }
            }

            // Hardcoded installation process
            if (toolId === "sc4pim") {
              const binPath = path.dirname(path.resolve(downloadPath, toolInfo.exe))

              const basePath = path.resolve(downloadPath, "Setup SC4 PIM-X (X-tool, X-PIM)")
              const exePath = path.resolve(basePath, "01. Install SetupSC4PIM/SetupSC4PIMRC8c.exe")

              // Extract from installer to bin
              await extractClickTeam(exePath, binPath, {
                exePath: exe => this.getToolExePath(exe),
                logger: context,
              })

              // Move DLLs and config overrides to bin
              const filesToMoveToBin = await fsQueryFiles(basePath, [
                "02. Copy into the SC4PIM install folder/*",
                "04. These go into the Win System 32 and or SysWOW64 folder/*.dll",
              ])

              for (const relativePath of filesToMoveToBin) {
                await fsMove(
                  path.resolve(basePath, relativePath),
                  path.resolve(binPath, path.basename(relativePath)),
                  { overwrite: true },
                )
              }

              // Move documentation to roots
              const filesToMoveToRoot = await fsQueryFiles(basePath, [
                "05. Set-up SC4PIM-X to the right compatibility mode/*",
                "06. SC4 PIM User Guide/*",
              ])

              for (const relativePath of filesToMoveToRoot) {
                await fsMove(
                  path.resolve(basePath, relativePath),
                  path.resolve(downloadPath, path.basename(relativePath)),
                  { overwrite: true },
                )
              }

              // Remove setup file
              await fsRemove(basePath)
            }
          } catch (error) {
            // If installation process fails, delete the download so it will not be treated as installed later
            // TODO: Install to some Tools folder rather than directly within Downloads, so this will no longer be an issue
            await fsRemove(downloadPath)
            throw error
          }

          toolInfo.installed = true

          if (toolId === "dgvoodoo") {
            settings.install.voodoo = true
            this.sendStateUpdate({ settings })
          }

          return downloadPath
        } finally {
          toolInfo.action = undefined
          this.sendStateUpdate({ tools })
        }
      },
      pool: toolId,
    })
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

          this.sendPackageUpdate(packageInfo, { recompute: false })

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
          await fsRemove(variantPath)
          await fsCreate(variantPath)

          try {
            const docs: string[] = []
            const includedPaths = new Set<string>()
            const files: FileInfo[] = []

            for (const { asset, downloadPath } of downloadedAssets) {
              const allPaths = await fsQueryFiles(downloadPath)

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
                  const newPath = joinPosix(DIRNAMES.cleanitol, file.path)
                  if (includedPaths.has(newPath)) {
                    context.warn(`Ignoring file ${oldPath} trying to unpack at ${newPath}`)
                  } else {
                    await fsSymlink(
                      path.resolve(downloadPath, oldPath),
                      path.resolve(variantPath, newPath),
                    )
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
                  const newPath = joinPosix(DIRNAMES.docs, file.path)
                  if (includedPaths.has(newPath)) {
                    context.warn(`Ignoring file ${oldPath} trying to unpack at ${newPath}`)
                  } else {
                    await fsSymlink(
                      path.resolve(downloadPath, oldPath),
                      path.resolve(variantPath, newPath),
                    )
                    includedPaths.add(newPath)
                    docs.push(newPath)
                  }
                }
              })

              const { matchedPaths: sc4Files } = matchFiles(
                allPaths.filter(path => SC4_EXTENSIONS.includes(getExtension(path))),
                {
                  exclude: union(["**/desktop.ini"], asset.exclude ?? []),
                  ignoreEmpty: !asset.include,
                  include: asset.include ?? [{ path: "" }],
                  options: variantInfo.options,
                },
              )

              await forEachAsync(sc4Files, async (file, oldPath) => {
                if (file) {
                  const newPath = file.path
                  if (includedPaths.has(newPath)) {
                    context.error(`Ignoring file ${oldPath} trying to unpack at ${newPath}`)
                  } else {
                    await fsSymlink(
                      path.resolve(downloadPath, oldPath),
                      path.resolve(variantPath, newPath),
                    )
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
            await fsRemove(this.getVariantPath(packageId, variantId))
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
    const { exemplarProperties, features, packages, plugins, profiles, profileOptions, settings } =
      await this.load()

    const links = await this.initLinks()

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
        let pluginsChanged = false

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
            await fsSymlink(fromFullPath, path.resolve(pluginsPath, toRelativePath), {
              overwrite: true,
            })
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
              ? getFilename(file.path)
              : joinPosix(getPluginsFolderName(priority), packageId, file.path)

            oldLinks.delete(targetRelativePath)

            if (plugins[targetRelativePath]) {
              await this.backUpFile(context, targetRelativePath)
              delete plugins[targetRelativePath]
              pluginsChanged = true
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

          if (pluginsChanged) {
            this.indexPlugins()
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
                const targetPath = path.resolve(pluginsPath, filename)
                await fsWrite(targetPath, ini)
              }
            }
          }
        }

        // Remove obsolete links
        if (!options.packageId) {
          for (const relativePath of oldLinks) {
            const fullPath = path.resolve(pluginsPath, relativePath)
            await fsRemove(fullPath)
            await fsRemoveIfEmptyRecursive(path.dirname(fullPath), pluginsPath)
            links.delete(relativePath)
            nRemoved++
          }
        }

        context.debug(`Done (added ${nCreated}, removed ${nRemoved}, updated ${nUpdated})`)
      },
      invalidate: true,
      onStatusUpdate: info => {
        this.sendStatusUpdate({ linker: info })
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
        const downloadsPromise = loadDownloadedAssets(context, this.getDownloadsPath())
        const regionsPromise = loadRegions(context, this.getRegionsPath(), this.getBackupsPath())

        // Launch link initialization in the background
        this.initLinks(isReload)

        // Creating window
        this.initMainWindow()

        // Load profiles...
        context.setStep("Loading profiles...")
        const profiles = await loadProfiles(context, this.getProfilesPath())
        this.sendStateUpdate({ profiles })

        // Load settings...
        const repository = env.DATA_REPOSITORY
        context.setStep("Loading settings...")
        const settings = await loadSettings(
          context,
          this.getRootPath(),
          this.getPluginsPath(),
          this.getRegionsPath(),
          isURL(repository) ? repository : path.resolve(__dirname, "../..", repository),
          profiles,
        )

        const dbPath = this.getDatabasePath(settings)

        // Rewrite modified settings...
        this.writeSettings(context, settings)

        const profileInfo = settings.currentProfile ? profiles[settings.currentProfile] : undefined

        // Wait for database update...
        if (settings.db.url) {
          context.setStep("Updating database...")
          await this.updateDatabase(settings.db.url, dbPath, isReload)
        }

        // Load authors...
        context.setStep("Loading authors...")
        const authors = await loadAuthors(context, dbPath)
        this.sendStateUpdate({ authors })

        // Load categories...
        context.setStep("Loading categories...")
        const categories = await loadCategories(context, dbPath)
        this.sendStateUpdate({ categories })

        // Load profile options...
        context.setStep("Loading profile options...")
        const profileOptions = await loadProfileOptions(context, dbPath)
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
          dbPath,
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
        }

        context.setStep("Indexing external plugins...")

        const exemplarProperties = await loadExemplarProperties(context, dbPath)
        this.sendStateUpdate({ exemplarProperties })

        let maxisPromise: Promise<FileContents> | undefined
        if (settings.install?.path) {
          maxisPromise = loadMaxisContents(context, this.getRootPath(), settings.install?.path, {
            categories,
            reload: settings.startup.reloadMaxis,
          })
        }

        const pluginsPromise = loadPlugins(context, this.getRootPath(), this.getPluginsPath(), {
          categories,
          reload: settings.startup.reloadPlugins,
        })

        const collections = await loadCollections(context, dbPath)
        const tools = await loadTools(context, dbPath, assets)
        const templates = await loadProfileTemplates(context, dbPath)
        this.sendStateUpdate({ collections, templates, tools })

        const regions = await regionsPromise
        this.sendStateUpdate({ regions })

        const maxis = (await maxisPromise) ?? {}
        const plugins = await pluginsPromise
        const index = calculateIndex({ ...maxis, ...plugins })
        this.sendStateUpdate({ index, plugins })
        this.cleanPlugins({ isStartup: true })

        return {
          assets,
          authors,
          categories,
          collections,
          exemplarProperties,
          features,
          index,
          maxis,
          packages,
          plugins,
          profiles,
          profileOptions,
          regions,
          settings,
          templates,
          tools,
        }
      },
      invalidate: isReload,
      onStatusUpdate: info => {
        this.sendStatusUpdate({ loader: info })
      },
      pool: "main",
    })
  }

  public async loadPluginFileEntries(pluginPath: string): Promise<DBPFInfo> {
    return this.tasks.queue(`plugins:load:${pluginPath}`, {
      handler: async () => {
        const fullPath = path.resolve(this.getPluginsPath(), pluginPath)

        return fsOpen(fullPath, FileOpenMode.READ, async patchedFile => {
          const dbpf = await DBPF.fromFile(patchedFile)
          return dbpf.loadExemplars()
        })
      },
      pool: `plugins:${pluginPath}`,
    })
  }

  public async loadPluginFileEntry(pluginPath: string, entryId: TGI): Promise<DBPFLoadedEntryInfo> {
    return this.tasks.queue(`plugins:load:${pluginPath}#${entryId}`, {
      handler: async () => {
        const fullPath = path.resolve(this.getPluginsPath(), pluginPath)

        return fsOpen(fullPath, FileOpenMode.READ, async file => {
          const dbpf = await DBPF.fromFile(file)
          return dbpf.getEntry(entryId)
        })
      },
      pool: `plugins:${pluginPath}`,
    })
  }

  public async loadSavePreviewPicture(
    regionId: RegionID,
    cityId: CityID,
    backupFile?: string,
  ): Promise<DBPFLoadedEntryInfo<DBPFDataType.PNG>> {
    return this.tasks.queue(
      `region:preview:${regionId}:${cityId}${backupFile ? `:${backupFile}` : ""}`,
      {
        handler: async () => {
          const fullPath = backupFile
            ? this.getCityBackupPath(regionId, cityId, backupFile)
            : this.getCityPath(regionId, cityId)

          const entryId = "8a2482b9-4a2482bb-00000000" as TGI // TODO
          return fsOpen(fullPath, FileOpenMode.READ, async file => {
            const dbpf = await DBPF.fromFile(file)
            const entry = await dbpf.getEntry(entryId, DBPFDataType.PNG)
            return entry
          })
        },
        pool: `region:${regionId}`,
      },
    )
  }

  public async loadVariantFileEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<DBPFInfo> {
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

        return fsOpen(patchedFullPath, FileOpenMode.READ, async patchedFile => {
          const dbpf = await DBPF.fromFile(patchedFile)
          return dbpf.loadExemplars()
        })
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  public async loadVariantFileEntry(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    entryId: TGI,
  ): Promise<DBPFLoadedEntryInfo> {
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
        const entry = await fsOpen(patchedFullPath, FileOpenMode.READ, async patchedFile => {
          const dbpf = await DBPF.fromFile(patchedFile)
          return dbpf.getEntry(entryId)
        })

        // Load original data as needed
        if (originalFullPath !== patchedFullPath) {
          entry.original = await fsOpen(originalFullPath, FileOpenMode.READ, async originalFile => {
            const dbpf = await DBPF.fromFile(originalFile)
            if (dbpf.entries[entryId]) {
              const originalEntry = await dbpf.getEntry(entryId)
              return originalEntry.data
            }
          })
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

  public async openDataRepository(): Promise<void> {
    const { settings } = await this.load()

    if (!settings.db) {
      throw Error("Data repository is not configured")
    }

    await this.openInExplorer(settings.db.path ?? settings.db.url)
  }

  /**
   * Opens the game's executable directory in Explorer.
   */
  public async openExecutableDirectory(): Promise<void> {
    const { settings } = await this.load()

    if (!settings.install?.path) {
      throw Error("Game installation path is not set")
    }

    await this.openInExplorer(path.dirname(path.resolve(settings.install.path, FILENAMES.sc4exe)))
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
    await this.openInExplorer(path.resolve(this.getPackagePath(packageId), configName))
  }

  /**
   * Opens a package's file in the default text editor.
   */
  public async openPackageFile(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<void> {
    await this.openInExplorer(this.getVariantFilePath(packageId, variantId, filePath))
  }

  /**
   * Opens a package's URL in browser.
   */
  public async openPackageURL(
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

  /**
   * Opens the Plugins folder or one of its subfolder in the file explorer.
   */
  public async openPluginFolder(pluginPath?: string): Promise<void> {
    if (pluginPath) {
      await this.openInExplorer(path.resolve(this.getPluginsPath(), pluginPath))
    } else {
      await this.openInExplorer(this.getPluginsPath())
    }
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
    await this.openInExplorer(path.resolve(this.getProfilesPath(), configName))
  }

  /**
   * Opens a region's savegame folder in the file explorer.
   */
  public async openRegionFolder(regionId: RegionID): Promise<void> {
    await this.openInExplorer(path.resolve(this.getRegionsPath(), regionId))
  }

  /**
   * Opens a tool's file in the default text editor.
   */
  public async openToolFile(toolId: ToolID, filePath: string): Promise<void> {
    const { assets, settings, tools } = await this.load()

    const toolInfo = tools[toolId]
    if (!toolInfo?.asset || !toolInfo.installed) {
      throw Error(`Tool '${toolId}' is not installed`)
    }

    if (toolInfo.install) {
      if (!settings.install?.path) {
        throw Error("Missing installation folder")
      }

      await this.openInExplorer(path.resolve(settings.install.path, filePath))
    } else {
      const assetInfo = assets[toolInfo.asset]
      if (!assetInfo?.downloaded[assetInfo.version]) {
        throw Error(`Asset '${toolInfo.asset}' is not installed`)
      }

      await this.openInExplorer(path.resolve(this.getDownloadPath(assetInfo), filePath))
    }
  }

  /**
   * Opens a tool's URL in browser.
   */
  public async openToolURL(toolId: ToolID, type: "repository" | "support" | "url"): Promise<void> {
    const { tools } = await this.load()

    const toolInfo = tools[toolId]
    if (!toolInfo?.[type]) {
      const name = type === "url" ? "homepage" : type
      throw Error(`Tool '${toolId}' does not have a ${name} URL`)
    }

    await this.openInExplorer(toolInfo[type])
  }

  public async patchPluginFileEntries(
    pluginPath: string,
    patches: {
      [entryId in TGI]?: ExemplarDataPatch | null
    },
  ): Promise<DBPFInfo> {
    const { exemplarProperties } = await this.load()

    return this.tasks.queue(`plugins:patch:${pluginPath}`, {
      handler: async context => {
        const fullPath = path.resolve(this.getPluginsPath(), pluginPath)

        const tempFullPath = this.getTempPath(fullPath)

        // Generate patched file in temp folder
        const file = await this.generatePatchedFile(
          context,
          fullPath,
          tempFullPath,
          mapValues(patches, patch => patch ?? undefined),
          exemplarProperties,
        )

        // Replace original file with the patched version
        await fsMove(tempFullPath, fullPath, { overwrite: true })

        // Unset original field (so renderer will not show a diff)
        forEach(file.entries, entry => {
          entry.original = undefined
        })

        // TODO: Reanalyze entries

        return file
      },
      pool: `plugins:${pluginPath}`,
    })
  }

  public async patchVariantFileEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    patches: {
      [entryId in TGI]?: ExemplarDataPatch | null
    },
  ): Promise<DBPFInfo> {
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
          await fsMove(tempFullPath, originalFullPath, { overwrite: true })

          // Unset original field (so renderer will not show a diff)
          forEach(file.entries, entry => {
            entry.original = undefined
          })

          return file
        }

        // Override patches in config
        forEach(patches, (patch, entryId) => {
          fileInfo.patches ??= {}
          if (patch?.parentCohort || patch?.properties) {
            fileInfo.patches[entryId] = patch
          } else {
            delete fileInfo.patches[entryId]
          }
        })

        // Unset patches if all were removed
        if (fileInfo.patches && isEmpty(fileInfo.patches)) {
          fileInfo.patches = undefined
        }

        let file: DBPFInfo | undefined

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
          file = await fsOpen(originalFullPath, FileOpenMode.READ, async patchedFile => {
            const dbpf = await DBPF.fromFile(patchedFile)
            return dbpf.loadExemplars()
          })
        }

        // Delete old patches
        this.refreshPatches(packageId, variantId)

        // Trigger a relink of this package only if it is included in current profile
        if (settings.currentProfile) {
          const packageStatus = packageInfo.status[settings.currentProfile]
          if (isIncluded(packageStatus) && isSelected(variantInfo, packageStatus)) {
            this.linkPackages({ packageId })
          }
        }

        // Reload exemplar info
        // TODO: Improve this!
        forEach(file.entries, (entry, tgi) => {
          if (patches[tgi]) {
            if (entry.data && entry.type === DBPFDataType.EXEMPLAR) {
              const exemplar: Exemplar = { ...entry, data: entry.data, file: filePath }

              switch (getExemplarType(tgi, exemplar.data)) {
                case ExemplarType.Building: {
                  const [, group, id] = split(tgi, "-") as [TypeID, GroupID, BuildingID]
                  const building = variantInfo.buildings?.find(where({ file: filePath, group, id }))

                  if (building) {
                    const data = getBuildingInfo(exemplar)
                    $merge(building, loadBuildingInfo(filePath, group, id, data, categories))
                  }

                  break
                }

                case ExemplarType.LotConfig: {
                  const [, , id] = split(tgi, "-") as [TypeID, GroupID, LotID]
                  const lot = variantInfo.lots?.find(where({ file: filePath, id }))

                  if (lot) {
                    const data = getLotInfo(exemplar)
                    $merge(lot, loadLotInfo(filePath, id, data))
                  }

                  break
                }

                case ExemplarType.Prop: {
                  const [, group, id] = split(tgi, "-") as [TypeID, GroupID, PropID]
                  const prop = variantInfo.props?.find(where({ file: filePath, group, id }))

                  if (prop) {
                    const data = getPropInfo(exemplar)
                    $merge(prop, loadPropInfo(filePath, group, id, data))
                  }

                  break
                }
              }
            }
          }
        })

        // Persist config changes and send updates to renderer
        await this.writePackageConfig(context, packageInfo, categories)

        return file
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  protected async quit(): Promise<void> {
    await fsRemove(this.getTempPath())
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
        const patchesPath = path.resolve(basePath, DIRNAMES.patches)

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
          await fsRemove(patchesPath)
        } else {
          const patchesPaths = await fsQueryFiles(patchesPath)

          // Otherwise, remove only unused files
          for (const relativePath of patchesPaths) {
            const fullPath = path.resolve(patchesPath, relativePath)
            if (!usefulPatchedFiles.has(fullPath)) {
              await fsRemove(fullPath)
              await fsRemoveIfEmptyRecursive(path.dirname(fullPath), basePath)
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
   * Reload plugins.
   */
  public async reloadPlugins(): Promise<void> {
    const state = await this.load()
    const { categories } = state

    await this.tasks.queue("plugins:load", {
      handler: async context => {
        const plugins = await loadPlugins(context, this.getRootPath(), this.getPluginsPath(), {
          categories,
        })

        state.plugins = plugins
        this.cleanPlugins({ isStartup: true })
      },
      pool: "main",
    })
  }

  /**
   * Removes a backup.
   */
  public async removeBackup(regionId: RegionID, cityId: CityID, file: string): Promise<void> {
    const { regions } = await this.load()

    const region = regions[regionId]
    if (!region) {
      throw Error(`Region '${regionId}' does not exist`)
    }

    const city = region.cities[cityId]
    if (!city) {
      throw Error(`City '${cityId}' does not exist`)
    }

    const backup = city.backups.find(backup => backup.file === file)
    if (!backup) {
      throw Error(`Backup '${backup}' does not exist`)
    }

    await this.tasks.queue(`backup:delete:${regionId}:${cityId}`, {
      handler: async context => {
        const fullPath = this.getCityBackupPath(regionId, cityId, backup.file)

        context.debug(`Deleting backup '${regionId}/${cityId}/${backup.file}'...`)

        await fsRemove(fullPath)
        await fsRemoveIfEmptyRecursive(path.dirname(fullPath), this.getBackupsPath())

        city.backups = city.backups.filter(backup => backup.file !== file)

        this.sendStateUpdate({ regions })
      },
      pool: `region:${regionId}`,
    })
  }

  /**
   * Remove a file or folder from Plugins (moving it to backup).
   */
  public async removePluginFile(pluginPath: string): Promise<void> {
    const { plugins } = await this.load()

    await this.tasks.queue(`plugins:patch:${pluginPath}`, {
      handler: async context => {
        const fullPath = path.resolve(this.getPluginsPath(), pluginPath)
        if (await isDirectory(fullPath)) {
          const subfilePaths = await fsQueryFiles(fullPath, "**", {
            symlinks: false,
          })

          for (const subfilePath of subfilePaths) {
            const filePath = joinPosix(pluginPath, subfilePath)
            await this.backUpFile(context, filePath)
            delete plugins[filePath]
          }
        } else {
          await this.backUpFile(context, pluginPath)
          delete plugins[pluginPath]
        }

        this.indexPlugins()
      },
      pool: `plugins:${pluginPath}`,
    })
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
          this.cleanPlugins({ isSilent: true })
        }

        context.debug(`Removing profile '${profileId}'...`)

        // Remove config file
        await removeConfig(this.getProfilesPath(), profileId, profileInfo.format)
        profileInfo.format = undefined

        // Send update to renderer
        this.sendProfileDeletion(profileId)

        return true
      },
      pool: "main",
    })
  }

  /**
   * Remove an installed tool.
   */
  public async removeTool(toolId: ToolID): Promise<void> {
    const { assets, tools } = await this.load()

    await this.tasks.queue(`install:${toolId}`, {
      handler: async context => {
        const toolInfo = tools[toolId]
        if (!toolInfo?.asset) {
          throw Error(`Unknown tool '${toolId}'`)
        }

        try {
          context.info(`Removing tool '${toolId}'...`)
          toolInfo.action = "removing"
          this.sendStateUpdate({ tools })

          const assetInfo = assets[toolInfo.asset]
          if (!assetInfo) {
            throw Error(`Unknown asset '${toolInfo.asset}'`)
          }

          const downloadPath = this.getDownloadPath(assetInfo)
          await fsRemove(downloadPath)

          toolInfo.installed = undefined
        } finally {
          toolInfo.action = undefined
          this.sendStateUpdate({ tools })
        }
      },
      pool: toolId,
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
          this.sendPackageUpdate(packageInfo, { recompute: false })

          variantInfo.files = undefined
          variantInfo.installed = undefined

          // Upon removing the only installed variant, remove the whole package directory
          if (isOnlyInstalledVariant) {
            await fsRemove(this.getPackagePath(packageId))
          } else {
            await fsRemove(this.getVariantPath(packageId, variantId))
            await this.writePackageConfig(context, packageInfo, categories)
          }

          // TODO: This assumes that package is disabled in other profiles!
          if (variantInfo.local) {
            if (allVariants.length === 1) {
              delete packages[packageId]
            } else {
              delete packageInfo.variants[variantId]

              // Unselect the removed variant
              forEach(packageInfo.status, (packageStatus, profileId) => {
                const profileInfo = profiles[profileId]
                if (profileInfo && packageStatus.variantId === variantId) {
                  const defaultVariant = getDefaultVariant(packageInfo, packageStatus)
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
            this.sendPackageDeletion(packageId)
          }
        }
      },
      pool: `${packageId}#${variantId}`,
    })
  }

  /**
   * Restores a backup. THIS PERMANENTLY OVERWRITES THE CURRENT SAVE!
   */
  public async restoreBackup(regionId: RegionID, cityId: CityID, file: string): Promise<boolean> {
    const { regions } = await this.load()

    const region = regions[regionId]
    if (!region) {
      throw Error(`Region '${regionId}' does not exist`)
    }

    const city = region.cities[cityId]
    if (!city) {
      throw Error(`City '${cityId}' does not exist`)
    }

    const backup = city.backups.find(backup => backup.file === file)
    if (!backup) {
      throw Error(`Backup '${backup}' does not exist`)
    }

    return this.tasks.queue(`backup:restore:${regionId}:${cityId}`, {
      handler: async context => {
        if (!hasBackup(city)) {
          const { confirmed } = await showConfirmation(
            `${region.name} - ${city.name}`,
            t("RestoreBackupModal:confirmation"),
            t("RestoreBackupModal:description"),
            false,
            "warning",
          )

          if (!confirmed) {
            return false
          }
        }

        const backupPath = this.getCityBackupPath(regionId, cityId, file)

        context.debug(`Restoring backup '${region}/${cityId}/${file}'...`)

        await fsCopy(backupPath, this.getCityPath(regionId, cityId), { overwrite: true })

        city.save = undefined // may now be outdated, clear to lazy-reload later
        city.version = backup.version

        this.sendStateUpdate({ regions })

        return true
      },
      pool: `region:${regionId}`,
    })
  }

  /**
   * Run an installed tool.
   */
  public async runTool(toolId: ToolID): Promise<void> {
    const { tools } = await this.load()

    await this.tasks.queue(`run:${toolId}`, {
      handler: async context => {
        const toolInfo = tools[toolId]
        if (!toolInfo?.asset) {
          throw Error(`Unknown tool '${toolId}'`)
        }

        try {
          const exePath = await this.getToolExePath(toolId)

          context.info(`Running tool '${toolId}'...`)
          toolInfo.action = "running"
          this.sendStateUpdate({ tools })

          await runFile(exePath, { logger: context })
        } catch (error) {
          console.error(error)
        } finally {
          toolInfo.action = undefined
          this.sendStateUpdate({ tools })
        }
      },
      pool: toolId,
    })
  }

  /**
   * Sends deletion of a single package to the renderer.
   */
  protected sendPackageDeletion(packageId: PackageID): void {
    this.sendStateUpdate({ packages: { [packageId]: null } }, { merge: true, recompute: true })
  }

  /**
   * Sends updates to a single package to the renderer.
   */
  protected sendPackageUpdate(packageInfo: PackageInfo, options?: { recompute?: boolean }): void {
    this.sendStateUpdate(
      { packages: { [packageInfo.id]: packageInfo } },
      { ...options, merge: true },
    )
  }

  /**
   * Sends deletion of a single profile to the renderer.
   */
  protected sendProfileDeletion(profileId: ProfileID): void {
    this.sendStateUpdate({ profiles: { [profileId]: null } }, { merge: true })
  }

  /**
   * Sends updates to a single profile to the renderer.
   */
  protected sendProfileUpdate(profileInfo: ProfileInfo): void {
    this.sendStateUpdate({ profiles: { [profileInfo.id]: profileInfo } }, { merge: true })
  }

  /**
   * Sends updates to the renderer.
   */
  protected sendStateUpdate(
    data: ApplicationStateUpdate,
    options?: {
      merge?: boolean
      recompute?: boolean
    },
  ): void {
    this.mainWindow?.webContents.postMessage("updateState", {
      data,
      merge: options?.merge ?? false,
      recompute: options?.recompute ?? !!data.packages,
    })
  }

  /**
   * Sends status updates to the renderer.
   */
  protected sendStatusUpdate(data: ApplicationStatusUpdate): void {
    this.mainWindow?.webContents.postMessage("updateStatus", data)
  }

  /**
   * Initiates a login to Simtropolis.
   */
  public async simtropolisLogin(): Promise<void> {
    this.sendStateUpdate({ simtropolis: undefined })
    const session = await simtropolisLogin(this.browserSession)
    if (session?.sessionId) {
      console.info("Logged in to Simtropolis")
      this.simtropolisSession = session
      this.sendStateUpdate({
        simtropolis: {
          sessionId: session.sessionId,
          userId: session.userId,
        },
      })
    } else {
      this.sendStateUpdate({ simtropolis: null })
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
        this.cleanPlugins({ isSilent: true })
      },
      pool: "main",
    })
  }

  /**
   * Attempts to pull latest data from the remote Git repository.
   * @param isReload whether to force refetching new data
   */
  protected async updateDatabase(dbUrl: string, dbPath: string, isReload?: boolean): Promise<void> {
    await this.tasks.queue("db:update", {
      cache: true,
      handler: async context => {
        await fsCreate(dbPath)

        const branch = env.DATA_BRANCH || "main"
        context.info(`Updating database from ${dbUrl}/${branch}...`)

        try {
          await new Promise<void>((resolve, reject) => {
            createChildProcess<
              UpdateDatabaseProcessData,
              EmptyRecord,
              UpdateDatabaseProcessResponse
            >(updateDatabaseProcessPath, {
              cwd: dbPath,
              data: {
                branch,
                origin: dbUrl,
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
      const { assets, features, packages, profiles, profileOptions, regions, settings } =
        await this.load()

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
              disablingLots,
              disablingPackages,
              enablingPackages,
              explicitVariantChanges,
              implicitOptionChanges,
              implicitVariantChanges,
              incompatibleExternals,
              incompatiblePackages,
              installingVariants,
              replacingLots,
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
                const packagesWithAction: typeof packages = {}

                // Set enabling/disabling status
                for (const packageId of disablingPackages) {
                  const packageStatus = packages[packageId]?.status[profileId]
                  if (packageStatus) {
                    packageStatus.action = "disabling"
                    packagesWithAction[packageId] = packages[packageId]
                  }
                }

                for (const packageId of enablingPackages) {
                  const packageStatus = packages[packageId]?.status[profileId]
                  if (packageStatus) {
                    packageStatus.action = "enabling"
                    packagesWithAction[packageId] = packages[packageId]
                  }
                }

                if (!isEmpty(packagesWithAction)) {
                  this.sendStateUpdate(
                    { packages: packagesWithAction },
                    { merge: true, recompute: false },
                  )
                }

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
                    context.error(`Unknown package '${packageId}'`)
                    continue
                  }

                  const variantInfo = packageInfo.variants[packageStatus.variantId]

                  const dependencyIds = variantInfo?.dependencies
                    ?.map(dependency => dependency.id)
                    .filter(dependencyId => {
                      const dependencyInfo = packages[dependencyId]
                      const dependencyStatus = resultingStatus[dependencyId]
                      if (!dependencyInfo || !dependencyStatus) {
                        context.error(`Unknown package '${dependencyId}'`)
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
                    context.error(`Unknown package '${packageId}'`)
                    continue
                  }

                  const variantInfo = packageInfo.variants[packageStatus.variantId]

                  const dependencyIds = variantInfo?.optional?.filter(dependencyId => {
                    const dependencyInfo = packages[dependencyId]
                    const dependencyStatus = resultingStatus[dependencyId]
                    if (!dependencyInfo || !dependencyStatus) {
                      context.error(`Unknown package '${dependencyId}'`)
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

              // Update saves!
              const saveUpdates: {
                cityId: CityID
                regionId: RegionID
                removeLots: LotID[]
                replaceLots: { [id in LotID]: LotInfo }
              }[] = []

              if (!isEmpty(disablingLots) || !isEmpty(replacingLots)) {
                // Loading all linked saves
                await forEachAsync(regions, async (region, regionId) => {
                  const regionProfileId = getRegionLinkedProfileId(regionId, settings, profiles)
                  await forEachAsync(region.cities, async (city, cityId) => {
                    const cityProfileId = getCityLinkedProfileId(regionId, cityId, settings)
                    if (city.established && (cityProfileId ?? regionProfileId) === profileId) {
                      const fullPath = this.getCityPath(regionId, cityId)
                      city.save ??= await loadSaveInfo(context, fullPath)

                      const removeLots: LotID[] = []
                      const replaceLots: { [id in LotID]: LotInfo } = {}

                      for (const id of city.save.lots) {
                        if (disablingLots[id]) {
                          // TODO: Lot destruction not implemented
                          // removeLots.push(id)
                        } else if (replacingLots[id]) {
                          replaceLots[id] = replacingLots[id].newInfo
                        }
                      }

                      if (removeLots.length || !isEmpty(replaceLots)) {
                        saveUpdates.push({ cityId, regionId, removeLots, replaceLots })
                      }
                    }
                  })
                })

                if (saveUpdates.length) {
                  const { confirmed } = await showConfirmation(
                    "Update cities",
                    "Update cities?",
                    `The following cities will be updated:\n${saveUpdates
                      .map(
                        ({ cityId, regionId }) =>
                          `- ${regions[regionId]?.cities[cityId]?.name ?? cityId} (${regions[regionId]?.name ?? regionId})`,
                      )
                      .join("\n")}\n\nBackups will be created.`,
                    false,
                    "question",
                    "Confirm",
                    "Skip",
                  )

                  if (confirmed) {
                    const backups: {
                      backup: CityBackupInfo
                      backupPath: string
                      city: CityInfo
                      cityPath: string
                    }[] = []

                    try {
                      for (const { regionId, cityId, ...updates } of saveUpdates) {
                        const region = regions[regionId]
                        const city = regions[regionId]?.cities[cityId]

                        if (!region || !city) {
                          throw Error(`Unknown city ${regionId}/${cityId}`)
                        }

                        const cityFullPath = this.getCityPath(regionId, cityId)

                        const backupName = "(auto)"
                        const backupTime = new Date()
                        const backupFile = getBackupFileName(backupTime, backupName)
                        const backupFullPath = this.getCityBackupPath(regionId, cityId, backupFile)

                        await fsCopy(cityFullPath, backupFullPath)

                        backups.push({
                          backup: {
                            description: backupName,
                            file: backupFile,
                            time: backupTime,
                            version: city.version,
                          },
                          backupPath: backupFullPath,
                          city,
                          cityPath: cityFullPath,
                        })

                        let retry: boolean

                        do {
                          retry = false

                          try {
                            await updateLots(context, cityFullPath, {
                              tempPath: this.getTempPath(cityFullPath),
                              ...updates,
                            })
                          } catch (error) {
                            console.error(error)

                            const canRetry =
                              error instanceof Error &&
                              !!error.message.match(/resource busy or locked/i)

                            const { confirmed } = await showConfirmation(
                              `${region?.name ?? regionId} - ${city?.name ?? cityId}`,
                              "Update failed",
                              canRetry
                                ? "The city could not be updated. If you are currently running the city, exit it before retrying."
                                : "The city could not be updated. You may either skip it or revert all changes.",
                              false,
                              "error",
                              canRetry ? "Retry" : "Skip",
                              "Cancel",
                            )

                            if (!confirmed) {
                              throw error
                            }

                            retry = canRetry
                          }
                        } while (retry)
                      }

                      // All successful - Update cities
                      for (const backup of backups) {
                        backup.city.backups.push(backup.backup)
                        backup.city.save = undefined // may now be outdated, clear to lazy-reload later
                        backup.city.version = await getFileVersion(backup.cityPath)
                      }

                      this.sendStateUpdate({ regions })
                    } catch (_) {
                      // Rollback - Restore from automatic backups
                      for (const backup of backups) {
                        if (await fsExists(backup.backupPath)) {
                          await fsMove(backup.backupPath, backup.cityPath, { overwrite: true })
                        }
                      }

                      return false
                    }
                  }
                }
              }

              // Apply config changes
              Object.assign(profileInfo, resultingProfile)

              // Apply status changes
              forEach(packages, (packageInfo, packageId) => {
                packageInfo.status[profileId] = resultingStatus[packageId]
              })

              if (update.packages && !shouldRecalculate) {
                this.sendStateUpdate(
                  { packages: filterValues(packages, info => !!update.packages?.[info.id]) },
                  { merge: true, recompute: false },
                )
              }

              // Run cleaner and linker
              if (shouldRecalculate && settings.currentProfile === profileId) {
                // Apply feature changes
                forEach(features, (_packageIds, feature) => {
                  if (!resultingFeatures[feature]?.length) {
                    features[feature] = undefined
                  }
                })
                forEach(resultingFeatures, (packageIds, feature) => {
                  features[feature] = packageIds
                })

                this.sendStateUpdate({ features })
                this.cleanPlugins({ packageIds: enablingPackages })
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

  public async updateSave(
    regionId: RegionID,
    cityId: CityID,
    file: string | null,
    action: UpdateSaveAction,
  ): Promise<boolean> {
    const { regions } = await this.load()

    return this.tasks.queue(`region:update:${regionId}:${cityId}`, {
      handler: async context => {
        let source: CityBackupInfo | CityInfo
        let sourceFullPath: string
        let backup: CityBackupInfo | undefined
        let backupFullPath: string | undefined

        const region = regions[regionId]
        if (!region) {
          throw Error(`Region '${regionId}' does not exist`)
        }

        const city = region.cities[cityId]
        if (!city) {
          throw Error(`City '${cityId}' does not exist`)
        }

        if (file) {
          const backup = city.backups.find(backup => backup.file === file)
          if (!backup) {
            throw Error(`Backup '${file}' does not exist`)
          }

          source = backup
          sourceFullPath = this.getCityBackupPath(regionId, cityId, file)
        } else {
          source = city
          sourceFullPath = this.getCityPath(regionId, cityId)
        }

        if (action.backup) {
          const description = `(${action.action})`
          const backupTime = new Date()
          const backupFile = getBackupFileName(backupTime, description)
          backupFullPath = this.getCityBackupPath(regionId, cityId, backupFile)

          await fsCopy(sourceFullPath, backupFullPath)

          backup = {
            description,
            file: backupFile,
            time: backupTime,
            version: source.version,
          }
        }

        const tempPath = this.getTempPath(sourceFullPath)

        let updated: boolean

        switch (action.action) {
          case "fix": {
            updated = await fixSave(context, sourceFullPath, { ...action, tempPath })
            break
          }

          case "growify": {
            updated = await growify(context, sourceFullPath, { ...action, tempPath })
            break
          }

          case "historical": {
            updated = await makeHistorical(context, sourceFullPath, { ...action, tempPath })
            break
          }
        }

        if (updated) {
          if (backup) {
            city.backups.push(backup)
          }

          // File was updated - update the version
          source.version = await getFileVersion(sourceFullPath)
          this.sendStateUpdate({ regions })
        } else if (backupFullPath) {
          // File was not updated - automatic backup no longer needed
          await fsRemove(backupFullPath)
        }

        return updated
      },
      pool: `region:${regionId}`,
    })
  }

  public async updateSettings(data: Partial<Settings>): Promise<boolean> {
    const { profiles, regions, settings } = await this.load()

    return this.tasks.queue("settings:update", {
      handler: async context => {
        const newSettings = { ...settings, ...data }

        // Warn about changing the linked profile of established cities
        if (data.regions && !this.ignoredWarnings.has("relinkEstablishedCities")) {
          const relinkedCities = values(regions).flatMap(region => {
            const oldRegionProfileId = getRegionLinkedProfileId(region.id, settings, profiles)
            const newRegionProfileId = getRegionLinkedProfileId(region.id, newSettings, profiles)

            return values(region.cities).filter(city => {
              const oldCityProfileId =
                getCityLinkedProfileId(region.id, city.id, settings) ?? oldRegionProfileId
              const newCityProfileId =
                getCityLinkedProfileId(region.id, city.id, newSettings) ?? newRegionProfileId

              return city.established && oldCityProfileId !== newCityProfileId
            })
          })

          if (relinkedCities.length) {
            const { confirmed, doNotAskAgain } = await showConfirmation(
              t("RelinkEstablishedCitiesModal:title", {
                city: relinkedCities[0].name,
                count: relinkedCities.length,
              }),
              t("RelinkEstablishedCitiesModal:confirmation", {
                city: relinkedCities[0].name,
                count: relinkedCities.length,
              }),
              t("RelinkEstablishedCitiesModal:description", {
                cities: relinkedCities.map(city => city.name).sort(),
                count: relinkedCities.length,
              }),
              true,
              "warning",
              t("RelinkEstablishedCitiesModal:confirm"),
              t("RelinkEstablishedCitiesModal:cancel"),
            )

            if (!confirmed) {
              return false
            }

            if (doNotAskAgain) {
              this.ignoredWarnings.add("relinkEstablishedCities")
            }
          }
        }

        settings.regions = data.regions

        this.sendStateUpdate({ settings })

        await this.writeSettings(context, settings)

        return true
      },
      pool: "main",
    })
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
