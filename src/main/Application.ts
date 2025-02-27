import fs from "node:fs/promises"
import path, { isAbsolute } from "node:path"

import {
  $merge,
  collect,
  entries,
  filterValues,
  forEach,
  forEachAsync,
  indexBy,
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
import update, { type Spec } from "immutability-helper"
import { stringify as writeINI } from "ini"

import type { AssetID, AssetInfo, Assets } from "@common/assets"
import type { Authors } from "@common/authors"
import type { BuildingID } from "@common/buildings"
import type { Categories } from "@common/categories"
import type { Collections } from "@common/collections"
import {
  DBPFDataType,
  type DBPFInfo,
  type DBPFLoadedEntryInfo,
  type GroupID,
  type TGI,
  type TypeID,
} from "@common/dbpf"
import {
  type ExemplarDataPatches,
  type ExemplarProperties,
  ExemplarType,
  getExemplarType,
} from "@common/exemplars"
import { getFeatureLabel, i18n, initI18n } from "@common/i18n"
import { GroupLogger } from "@common/logs"
import type { LotID, LotInfo } from "@common/lots"
import { type OptionInfo, type OptionValue, getOptionValue } from "@common/options"
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
import type { FileContents, Plugins } from "@common/plugins"
import {
  type ProfileData,
  type ProfileID,
  type ProfileInfo,
  type ProfileUpdate,
  type Profiles,
  createUniqueId,
} from "@common/profiles"
import type { PropID } from "@common/props"
import {
  type CityBackupInfo,
  type CityID,
  type CityInfo,
  type RegionID,
  type Regions,
  type UpdateSaveAction,
  getCityFileName,
  getCityLinkedProfileId,
  getRegionLinkedProfileId,
  hasBackup,
} from "@common/regions"
import type { DatabaseSettings, Settings, SettingsData, SettingsUpdate } from "@common/settings"
import { type ApplicationState, type ApplicationStatus, getInitialState } from "@common/state"
import { ToolID, type ToolInfo, type Tools } from "@common/tools"
import { ConfigFormat, type Features, type Packages } from "@common/types"
import { globToRegex } from "@common/utils/glob"
import { split } from "@common/utils/string"
import {
  type EditableVariantInfo,
  type FileInfo,
  type VariantID,
  type VariantInfo,
  getDefaultVariant,
} from "@common/variants"
import { loadConfig, removeConfig, writeConfig } from "@node/configs"
import { getDownloadKey } from "@node/data/assets"
import { loadAuthors } from "@node/data/authors"
import { loadBuildingInfo } from "@node/data/buildings"
import { loadCollections } from "@node/data/collections"
import { CLEANITOL_EXTENSIONS, DOC_EXTENSIONS, SC4_EXTENSIONS, matchFiles } from "@node/data/files"
import { loadLotInfo } from "@node/data/lots"
import { type PackageData, writePackageInfo } from "@node/data/packages"
import { loadPropInfo } from "@node/data/props"
import { DBPF } from "@node/dbpf"
import { analyzeSC4File, analyzeSC4Files } from "@node/dbpf/analyze"
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
  isErrorCode,
  joinPosix,
  removeExtension,
  replaceExtension,
  toPosix,
} from "@node/files"
import { hashCode } from "@node/hash"
import { cmd, runFile } from "@node/processes"
import type { TaskContext } from "@node/tasks"
import { DIRNAMES, FILENAMES, TEMPLATE_PREFIX } from "@utils/constants"
import {
  ConflictConfirmationResponse,
  showConfirmation,
  showConflictConfirmation,
  showError,
  showSuccess,
  showWarning,
} from "@utils/dialog"
import { check4GBPatch } from "@utils/exe"
import { getPluginsFolderName } from "@utils/linker"
import { handleDocsProtocol } from "@utils/protocols"
import { TaskRunner } from "./utils/tasks"

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
  updateDatabase,
} from "./data/db"
import { calculateIndex } from "./data/indexes"
import {
  loadDownloadedAssets,
  loadLocalPackages,
  loadRemoteAssets,
  loadRemotePackages,
} from "./data/packages"
import { resolvePackageUpdates, resolvePackages } from "./data/packages/resolve"
import { type PackInfo, type Packs, loadPacks, writePacks } from "./data/packs"
import { compactProfileConfig, loadProfiles, toProfileData } from "./data/profiles"
import { getBackupFileName, loadRegions } from "./data/regions"
import { loadSaveInfo } from "./data/saves/load"
import { fixSave, growify, makeHistorical, updateLots } from "./data/saves/update"
import { loadSettings, toSettingsData } from "./data/settings"
import { env, isDev } from "./utils/env"
import {
  SIMTROPOLIS_ORIGIN,
  type SimtropolisSession,
  getSimtropolisSession,
  getSimtropolisSessionCookies,
  simtropolisLogin,
  simtropolisLogout,
} from "./utils/sessions/simtropolis"

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

    // Load AppConfig
    // AppConfig is managed/stored by electron in its userData folder, and merely points to the location of the SimCity 4 folder
    // If we cannot locate the SimCity 4 folder on first launch, this will prompt the user to select it
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
  protected readonly gamePath: string

  /**
   * IDs of warnings that should be ignored for the whole session.
   */
  protected readonly ignoredWarnings = new Set<string>()

  /**
   * Task manager
   */
  protected readonly runner = new TaskRunner({
    loaders: {
      assets: () => this.loadAssets(),
      authors: () => this.loadAuthors(),
      categories: () => this.loadCategories(),
      collections: () => this.loadCollections(),
      db: () => this.updateDatabase(),
      downloads: () => this.loadDownloadedAssets(),
      exemplarProperties: () => this.loadExemplarProperties(),
      features: () => this.loadPackages().then(({ features }) => features),
      links: () => this.loadPlugins().then(({ links }) => links),
      localPackages: () => this.loadLocalPackages(),
      maxis: () => this.loadMaxisContents(),
      packages: () => this.loadPackages().then(({ packages }) => packages),
      packs: () => this.loadPacks(),
      plugins: () => this.loadPlugins().then(({ plugins }) => plugins),
      profileOptions: () => this.loadProfileOptions(),
      profileTemplates: () => this.loadProfileTemplates(),
      profiles: () => this.loadProfiles(),
      regions: () => this.loadRegions(),
      settings: () => this.loadSettings(),
      simtropolis: () => this.loadSimtropolisSession(),
      tools: () => this.loadTools(),
    },
    logger: new GroupLogger(console, "TaskRunner"),
    onUpdate: tasks => this.updateStatus({ tasks }),
    pools: {
      dialogs: 1,
      downloads: 6,
    },
    // verbose: import.meta.env.DEV,
  })

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

  /**
   * Current application state reflecting the UI state, see {@link getState}.
   */
  protected state: ApplicationState = getInitialState()

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

    // Register message handlers
    this.handle("check4GBPatch")
    this.handle("checkDgVoodoo")
    this.handle("checkPlugins")
    this.handle("clearPackageLogs")
    this.handle("createBackup")
    this.handle("createProfile")
    this.handle("createVariant")
    this.handle("editVariant")
    this.handle("getPackageDocs")
    this.handle("getPackageLogs")
    this.handle("getState")
    this.handle("installTool")
    this.handle("installVariant")
    this.handle("loadPackageFileEntries")
    this.handle("loadPackageFileEntry")
    this.handle("loadPluginFileEntries")
    this.handle("loadPluginFileEntry")
    this.handle("loadSavePreviewPicture")
    this.handle("openAuthorUrl")
    this.handle("openDataRepository")
    this.handle("openExecutableDirectory")
    this.handle("openInstallationDirectory")
    this.handle("openPackageConfig")
    this.handle("openPackageDirectory")
    this.handle("openPackageUrl")
    this.handle("openPluginDirectory")
    this.handle("openProfileConfig")
    this.handle("openRegionDirectory")
    this.handle("openToolDirectory")
    this.handle("openToolUrl")
    this.handle("patchPackageFileEntries")
    this.handle("patchPluginFileEntries")
    this.handle("refreshLocalVariant")
    this.handle("reloadPlugins")
    this.handle("removeBackup")
    this.handle("removePlugin")
    this.handle("removeProfile")
    this.handle("removeTool")
    this.handle("removeUnusedPackages")
    this.handle("removeVariant")
    this.handle("restoreBackup")
    this.handle("runTool")
    this.handle("simtropolisLogin")
    this.handle("simtropolisLogout")
    this.handle("switchProfile")
    this.handle("updateCity")
    this.handle("updateProfile")
    this.handle("updateSettings")

    this.initLogs()
    this.initCustomProtocols()
    this.initApplicationMenu()
    this.initMainWindow()
    this.load()
    this.loadSimtropolisSession().then(session => {
      this.updateState({
        simtropolis: {
          $set: session && {
            // Filter out fields like deviceKey/loginKey that have nothing to do in UI
            displayName: session.displayName,
            sessionId: isDev() ? session.sessionId : undefined,
            userId: session.userId,
          },
        },
      })
    })
  }

  /**
   * Checks the 4GB Patch and suggests applying it.
   */
  public async check4GBPatch(isStartupCheck?: boolean): Promise<boolean> {
    return this.runner.queue("4gb:check", {
      handler: async (context, { settings }) => {
        if (!settings.install?.path) {
          throw Error("Game installation path is not set")
        }

        const { applied, doNotAskAgain } = await check4GBPatch(context, settings.install.path, {
          isStartupCheck,
          skipSuggestion: isStartupCheck && settings.install.patched === false,
        })

        if (applied) {
          settings.install.patched = true
        } else if (isStartupCheck && doNotAskAgain) {
          settings.install.voodoo = false
        } else if (settings.install.patched) {
          settings.install.patched = undefined
        }

        this.writeSettings()

        return applied
      },
      reads: { settings: true },
      writes: { settings: true },
    })
  }

  /**
   * Checks DgVoodoo setup and suggests installing it.
   */
  public async checkDgVoodoo(isStartupCheck?: boolean): Promise<boolean> {
    const confirmed = await this.runner.queue("dgvoodoo:check", {
      handler: async (context, { settings }) => {
        context.info("Checking DgVoodoo setup...")

        if (!settings.install?.path) {
          throw Error("Game installation path is not set")
        }

        const exePath = path.join(settings.install.path, FILENAMES.dgVoodoo)
        if (await fsExists(exePath)) {
          context.info("DgVoodoo is already installed")

          if (!settings.install.voodoo) {
            settings.install.voodoo = true
            this.updateState({ $merge: { settings } })
            this.writeSettings()
          }

          return false
        }

        if (isStartupCheck && settings.install.voodoo === false) {
          return false
        }

        const { confirmed, doNotAskAgain } = await showConfirmation(
          i18n.t("CheckDgVoodooModal:title"),
          i18n.t("CheckDgVoodooModal:confirmation"),
          i18n.t("CheckDgVoodooModal:description"),
          isStartupCheck,
        )

        if (confirmed) {
          return true
        }

        if (settings.install.voodoo || isStartupCheck) {
          settings.install.voodoo = doNotAskAgain ? false : undefined
          this.updateState({ $merge: { settings } })
          this.writeSettings()
        }

        return confirmed
      },
      reads: { settings: true },
      writes: { settings: true },
    })

    if (confirmed) {
      try {
        await this.installTool(ToolID.DgVoodoo)

        await showSuccess(i18n.t("CheckDgVoodooModal:title"), i18n.t("CheckDgVoodooModal:success"))

        return true
      } catch (error) {
        await showError(
          i18n.t("CheckDgVoodooModal:title"),
          i18n.t("CheckDgVoodooModal:failure"),
          (error as Error).message,
        )
      }
    }

    return false
  }

  /**
   * Runs cleaner for all enabled packages.
   */
  public async checkPlugins(
    options: {
      isSilent?: boolean
      isStartup?: boolean
    } = {},
  ): Promise<void> {
    await this.runner.queue("plugins:clean", {
      handler: async (context, { packages, plugins, profiles, settings }) => {
        let nPackages = 0

        const pluginsPath = this.getPluginsPath()
        const profileInfo = profiles && settings.currentProfile && profiles[settings.currentProfile]

        forEach(plugins, file => {
          if (file.issues?.conflictingPackages) {
            if (size(file.issues) === 1) {
              file.issues = undefined
            } else {
              file.issues.conflictingPackages = undefined
            }
          }
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
              const fileName = path.basename(filePath)
              forEach(plugins, (file, pluginPath) => {
                if (path.basename(pluginPath) === fileName) {
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
              (!options.isStartup || settings.startup.removeConflictingPlugins)
            ) {
              const { confirmed, doNotAskAgain } = await showConfirmation(
                packageInfo.name,
                i18n.t("RemoveConflictingFilesModal:confirmation"),
                i18n.t("RemoveConflictingFilesModal:description", {
                  files: conflictingPaths.sort(),
                  pluginsBackup: DIRNAMES.pluginsBackup,
                }),
                options.isStartup,
              )

              if (confirmed) {
                for (const conflictingPath of conflictingPaths) {
                  const originFullPath = path.resolve(pluginsPath, conflictingPath)
                  const targetFullPath = path.resolve(this.getPluginsBackupPath(), conflictingPath)
                  await fsMove(originFullPath, targetFullPath, { overwrite: true })
                  await fsRemoveIfEmptyRecursive(path.dirname(originFullPath), pluginsPath)
                  delete plugins[conflictingPath]
                }

                context.debug(`Resolved ${conflictingPaths.length} conflicts`)

                this.indexPlugins()
              } else {
                context.debug(`Ignored ${conflictingPaths.length} conflicts`)

                if (doNotAskAgain) {
                  settings.startup.removeConflictingPlugins = false
                  this.writeSettings()
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
          (!options.isStartup || settings.startup.removeUnsupportedPlugins)
        ) {
          const { confirmed, doNotAskAgain } = await showConfirmation(
            i18n.t("RemoveUnsupportedFilesModal:title"),
            i18n.t("RemoveUnsupportedFilesModal:confirmation"),
            i18n.t("RemoveUnsupportedFilesModal:description", {
              files: unsupportedPaths.sort(),
              pluginsBackup: DIRNAMES.pluginsBackup,
            }),
            options.isStartup,
          )

          if (confirmed) {
            for (const unsupportedPath of unsupportedPaths) {
              const originFullPath = path.resolve(pluginsPath, unsupportedPath)
              const targetFullPath = path.resolve(this.getPluginsBackupPath(), unsupportedPath)
              await fsMove(originFullPath, targetFullPath, { overwrite: true })
              await fsRemoveIfEmptyRecursive(path.dirname(originFullPath), pluginsPath)
              delete plugins[unsupportedPath]
            }

            context.debug(`Removed ${unsupportedPaths.length} unsupported files`)

            this.indexPlugins()
          } else {
            context.debug(`Ignored ${unsupportedPaths.length} unsupported files`)

            if (doNotAskAgain) {
              settings.startup.removeUnsupportedPlugins = false
              this.writeSettings()
            }
          }
        }

        this.updateState({ plugins: { $set: plugins } })
      },
      invalidate: true,
      label: "Checking plugins...",
      reads: { packages: true, plugins: true, profiles: true, settings: true },
    })
  }

  /**
   * Deletes a package's TXT log file.
   */
  public async clearPackageLogs(packageId: PackageID, variantId: VariantID): Promise<void> {
    return this.runner.queue(`packages:logs:clear:${packageId}#${variantId}`, {
      handler: async (_, { packages }) => {
        const variantInfo = packages[packageId]?.variants[variantId]
        if (variantInfo?.logs) {
          // Logs are always relative to the root of Plugins (since DLLs must be at the root anyways)
          const logsPath = path.join(this.getPluginsPath(), variantInfo.logs)
          await fsRemove(logsPath)
        }
      },
      reads: { packages: [packageId] },
      writes: { packages: [packageId] },
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
    return this.runner.queue(`backups:create:${regionId}:${cityId}`, {
      handler: async (context, { regions }) => {
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

        this.updateState({ regions: { [regionId]: { cities: { [cityId]: { $set: city } } } } })
        return true
      },
      reads: { regions: [regionId] },
      writes: { regions: [regionId] },
    })
  }

  /**
   * Creates and checks out a new profile.
   * @param name Profile name
   * @param fromProfileId ID of the profile to copy (create an empty profile otherwise)
   */
  public async createProfile(name: string, fromProfileId?: ProfileID): Promise<void> {
    await this.runner.queue(`profiles:create@${Date.now() /* TODO: profileId */}`, {
      handler: async (_, { profiles, profileTemplates }) => {
        const profileId = createUniqueId(name, keys(profiles))

        const fromProfileInfo = fromProfileId
          ? fromProfileId.startsWith(TEMPLATE_PREFIX)
            ? profileTemplates[fromProfileId]
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

        this.updateState({ profiles: { $merge: { [profileId]: profileInfo } } })
        this.writeProfileConfig(profileId)
        this.switchProfile(profileId)
      },
      invalidate: true,
      label: `Creating profile '${name}'...`,
      reads: { profiles: true, profileTemplates: true },
      writes: { profiles: true },
    })
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
    // Install the source variant if it is not already
    await this.installVariant(packageId, fromVariantId)

    await this.runner.queue(`packages:create:${packageId}#${name /* TODO: variantId */}`, {
      handler: async (context, { exemplarProperties, packages }) => {
        const packageInfo = packages[packageId]
        if (!packageInfo) {
          throw Error(`Unknown package '${packageId}'`)
        }

        const variantId = createUniqueId(name, keys(packageInfo.variants))
        const fromVariantInfo = packageInfo.variants[fromVariantId]

        if (!fromVariantInfo) {
          throw Error(`Unknown variant '${packageId}#${fromVariantId}'`)
        }

        context.info(`Creating variant '${packageId}#${variantId}'...`)

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
        } catch (error) {
          // If something goes wrong while installing, fully delete the new variant
          await fsRemove(this.getVariantPath(packageId, variantId))
          throw error
        }

        // Copy configs from the source variant
        const variantInfo = structuredClone({
          ...fromVariantInfo,
          assets: undefined,
          files: fromVariantInfo.files?.map(({ patches, ...file }) => file), // Unset patches
          id: variantId,
          installed: true,
          local: true,
          name,
          new: false,
          release: undefined,
          update: undefined,
        })

        packageInfo.variants[variantId] = variantInfo

        this.updateState(
          {
            packages: {
              [packageId]: {
                variants: {
                  [variantId]: {
                    $set: variantInfo,
                  },
                },
              },
            },
          },
          true,
        )

        this.writePackageConfig(packageId)
      },
      reads: { exemplarProperties: true, packages: [packageId] },
      writes: { packages: [packageId] },
    })
  }

  /**
   * Downloads an asset.
   */
  protected async downloadAsset(assetInfo: AssetInfo, isTool?: boolean): Promise<string> {
    const key = getDownloadKey(assetInfo)
    const downloadPath = this.getDownloadPath(assetInfo)

    await this.runner.queue(`download:${key}`, {
      handler: async context => {
        const downloaded = await fsExists(downloadPath)

        if (!downloaded) {
          context.setLabel(`Downloading ${key}...`)
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

        context.setLabel(`Extracting ${key}...`)

        await extractRecursively(downloadPath, {
          exePath: exe => this.getToolExePath(exe),
          isTool,
          logger: context,
          onProgress: context.setProgress,
        })
      },
      pools: ["downloads"],
      reads: { assets: [assetInfo.id] },
      writes: { downloads: [assetInfo.id] },
    })

    return downloadPath
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
    await this.runner.queue(`packages:edit:${packageId}#${variantId}`, {
      handler: async (_, { categories, packages, settings }) => {
        const packageInfo = packages[packageId]
        if (!packageInfo) {
          throw Error(`Unknown package '${packageId}'`)
        }

        const variantInfo = packageInfo.variants[variantId]
        if (!variantInfo) {
          throw Error(`Unknown variant '${packageId}#${variantId}'`)
        }

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

        this.updateState(
          {
            packages: {
              [packageId]: {
                variants: {
                  [variantId]: {
                    $set: variantInfo,
                  },
                },
              },
            },
          },
          true,
        )

        this.writePackageConfig(packageId)

        // Update local database
        if (!settings.db.url && !variantInfo.local) {
          const ownerId = getOwnerId(packageId)
          const dbPackagesPath = path.join(settings.db.path, DIRNAMES.dbPackages)

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
      reads: { categories: true, packages: [packageId], settings: true },
      writes: { packages: [packageId] },
    })
  }

  /**
   * Focuses the main window (if it exists).
   */
  protected focus(): void {
    this.mainWindow?.restore()
    this.mainWindow?.focus()
  }

  /**
   * Patches a DBPF file.
   */
  protected async generatePatchedFile(
    context: TaskContext,
    originalFullPath: string,
    patchedFullPath: string,
    patches: ExemplarDataPatches,
    exemplarProperties: ExemplarProperties,
  ): Promise<DBPFInfo> {
    context.info(`Patching ${getFilename(originalFullPath)}...`)
    await fsCreate(path.dirname(patchedFullPath))
    return DBPF.patchEntries(originalFullPath, patchedFullPath, patches, exemplarProperties)
  }

  /**
   * Returns the absolute path to the 'Backups' directory, containing save backups.
   *
   * TODO: Maybe synchronize our backups with Auto-Save DLL somehow?
   */
  public getBackupsPath(): string {
    return path.join(this.gamePath, DIRNAMES.backups)
  }

  /**
   * Returns the absolute path to a city's backup file.
   */
  public getCityBackupPath(regionId: RegionID, cityId: CityID, file: string): string {
    return path.join(this.getBackupsPath(), regionId, cityId, file)
  }

  /**
   * Returns the absolute path to a city's save file.
   */
  public getCityPath(regionId: RegionID, cityId: CityID): string {
    return path.join(this.getRegionsPath(), regionId, getCityFileName(cityId))
  }

  /**
   * Returns the absolute path to the given asset's download cache.
   */
  public getDownloadPath(assetInfo: AssetInfo): string {
    return path.join(this.getDownloadsPath(), getDownloadKey(assetInfo))
  }

  /**
   * Returns the absolute path to the 'Manager/Downloads' directory, containing downloaded assets.
   */
  public getDownloadsPath(): string {
    return path.join(this.getManagerPath(), DIRNAMES.downloads)
  }

  /**
   * Returns the absolute path to the game data directory, containing the 'Plugins' and 'Regions' directories.
   */
  public getGamePath(): string {
    return this.gamePath
  }

  /**
   * Returns a 32-bit hexadecimal hash string for a given patch.
   */
  protected getHash(value: object): string {
    return toHex(hashCode(JSON.stringify(value)), 8)
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
    return path.join(this.getManagerPath(), DIRNAMES.logs)
  }

  /**
   * Returns the absolute path to the 'Manager' directory.
   */
  public getManagerPath(): string {
    return path.join(this.getGamePath(), DIRNAMES.manager)
  }

  /**
   * Returns the content of a package's readme file.
   */
  public async getPackageDocs(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<{ iframe: string } | { md: string } | { text: string }> {
    return this.runner.queue(`packages:docs:get:${packageId}#${variantId}:${filePath}`, {
      handler: async (_, { packages }) => {
        const variantInfo = packages[packageId]?.variants[variantId]
        if (!variantInfo?.docs) {
          throw Error(`Variant ${packageId}#${variantId} does not have documentation`)
        }

        const docsPath = path.join(this.getVariantPath(packageId, variantId), variantInfo.docs)
        const docPath = path.join(docsPath, filePath)
        const extension = getExtension(docPath)

        switch (extension) {
          case ".htm":
          case ".html": {
            const src = await fs.realpath(docPath)
            const pathname = toPosix(path.relative(this.getManagerPath(), src))
            return { iframe: `docs://sc4-plugin-manager/${pathname}` }
          }

          case ".md": {
            const contents = await fsRead(docPath)
            return { md: contents }
          }

          case ".txt": {
            const contents = await fsRead(docPath)
            return { text: contents }
          }

          // TODO: Support PDF?
          default: {
            throw Error(`Unsupported documentation format ${extension}`)
          }
        }
      },
      reads: { packages: [packageId] },
    })
  }

  /**
   * Returns the content of a package's TXT log file.
   */
  public async getPackageLogs(
    packageId: PackageID,
    variantId: VariantID,
  ): Promise<{ size: number; text: string } | null> {
    return this.runner.queue(`packages:logs:get:${packageId}#${variantId}`, {
      handler: async (_, { packages }) => {
        const variantInfo = packages[packageId]?.variants[variantId]
        if (variantInfo?.logs) {
          // Logs are always relative to the root of Plugins (since DLLs must be at the root anyways)
          const logsPath = path.join(this.getPluginsPath(), variantInfo.logs)

          try {
            const size = await getFileSize(logsPath)
            const text = await fsRead(logsPath)
            return { size, text }
          } catch (error) {
            if (!isErrorCode(error, "ENOENT")) {
              throw error
            }
          }
        }

        return null
      },
      reads: { packages: [packageId] },
    })
  }

  /**
   * Returns the absolute path to a package's installation directory.
   */
  public getPackagePath(packageId: PackageID): string {
    return path.join(this.getPackagesPath(), packageId)
  }

  /**
   * Returns the absolute path to the 'Manager/Packages' directory, containing installed packages.
   */
  public getPackagesPath(): string {
    return path.join(this.getManagerPath(), DIRNAMES.packages)
  }

  /**
   * Returns the absolute path to the 'Manager/Packs' directory, containing generated DAT-packed packages.
   */
  public getPacksPath(): string {
    return path.join(this.getManagerPath(), DIRNAMES.packs)
  }

  /**
   * Returns the absolute path to a variant's file, possibly patched, and possibly generating the patched file on the way.
   */
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

    const hash = this.getHash(patches)
    const patchedFullPath = this.getVariantFilePath(packageId, variantId, fileInfo.path, hash)
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
   * Returns the absolute path to the 'Plugins' directory. (We only ever deal with the 'Documents' one atm.)
   */
  public getPluginsPath(): string {
    return path.join(this.getGamePath(), DIRNAMES.plugins)
  }

  /**
   * Returns the absolute path to the 'Plugins (Backup)' directory.
   */
  public getPluginsBackupPath(): string {
    return path.join(this.getGamePath(), DIRNAMES.pluginsBackup)
  }

  /**
   * Returns the absolute path to the 'Manager/Profiles' directory, containing profile configs.
   */
  public getProfilesPath(): string {
    return path.join(this.getManagerPath(), DIRNAMES.profiles)
  }

  /**
   * Returns the absolute path to the 'Regions' directory, containing save files.
   */
  public getRegionsPath(): string {
    return path.join(this.getGamePath(), DIRNAMES.regions)
  }

  /**
   * Returns the current application state.
   *
   * The application may emit state updates before the renderer thread is actually listening.
   *
   * This is called once by the renderer thread when it starts, in order to synchronize these missing updates.
   */
  public getState(): ApplicationState {
    return this.state
  }

  /**
   * Returns the absolute path to a temporary path.
   */
  public getTempPath(absoluteOrRelativePath?: string): string {
    if (absoluteOrRelativePath && isAbsolute(absoluteOrRelativePath)) {
      if (isChildPath(absoluteOrRelativePath, this.getManagerPath())) {
        return this.getTempPath(path.relative(this.getManagerPath(), absoluteOrRelativePath))
      }

      if (isChildPath(absoluteOrRelativePath, this.getGamePath())) {
        return this.getTempPath(path.relative(this.getGamePath(), absoluteOrRelativePath))
      }
    }

    return path.join(this.getManagerPath(), DIRNAMES.temp, absoluteOrRelativePath ?? "")
  }

  /**
   * Returns the absolute path to a tool's installation directory.
   */
  public getToolPath(toolId: ToolID, relativePath?: string): string {
    return path.join(this.getToolsPath(), toolId, relativePath ?? "")
  }

  /**
   * Returns the path to the given tool's main executable, downloading the tool as needed.
   */
  public async getToolExePath(toolId: ToolID): Promise<string> {
    const toolInfo = await this.installTool(toolId)
    return this.getToolPath(toolId, toolInfo.exe)
  }

  /**
   * Returns the absolute path to the 'Manager/Tools' directory, containg installed tools.
   */
  public getToolsPath(): string {
    return path.join(this.getManagerPath(), DIRNAMES.tools)
  }

  /**
   * Returns the absolute path to a variant's file.
   */
  public getVariantFilePath(
    packageId: PackageID,
    variantId: VariantID,
    relativePath: string,
    /** 32-bit hexadecimal hash from {@link getHash} */
    hash?: string,
  ): string {
    if (hash) {
      const extension = getExtension(relativePath)

      return path.join(
        this.getVariantPath(packageId, variantId),
        DIRNAMES.patches,
        replaceExtension(relativePath, `.${hash}${extension}`),
      )
    }

    return path.join(this.getVariantPath(packageId, variantId), relativePath)
  }

  /**
   * Returns the absolute path to a variant's installation directory.
   */
  public getVariantPath(packageId: PackageID, variantId: VariantID): string {
    return path.join(this.getPackagePath(packageId), variantId)
  }

  /**
   * Links an IPC event from renderer thread to the instance method with the same name.
   */
  protected handle<Event extends keyof this & string>(
    // biome-ignore lint/suspicious/noExplicitAny: function params generic
    this: Record<Event, (...args: any[]) => unknown>,
    event: Event,
  ): void {
    ipcMain.handle(event, (_, ...args) => this[event](...args))
  }

  protected async indexPlugins(): Promise<void> {
    return this.runner.queue("plugins:index", {
      handler: async (_, { maxis, plugins }) => {
        const index = calculateIndex({ ...maxis, ...plugins })
        this.updateState({ $merge: { index, plugins } })
      },
      invalidate: true,
      label: "Indexing external plugins...",
      reads: { maxis: true, plugins: true },
    })
  }

  /**
   * Initializes the main menu.
   */
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

  /**
   * Initialize custom protocols.
   *
   * This is currently only used for showing HTML readme files as `<iframe>`.
   */
  protected initCustomProtocols(): void {
    handleDocsProtocol(this.getManagerPath(), DOC_EXTENSIONS) // TODO: could use some refactoring too tbh
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
   * @param toolId Tool ID
   */
  public async installTool(toolId: ToolID): Promise<ToolInfo> {
    return this.runner.queue(`tools:install:${toolId}`, {
      handler: async (context, { assets, settings, tools }) => {
        const toolInfo = tools[toolId]
        if (!toolInfo?.asset) {
          throw Error(`Unknown tool '${toolId}'`)
        }

        if (toolInfo.installed) {
          return toolInfo
        }

        try {
          toolInfo.action = "installing"
          toolInfo.installed = false
          this.updateState({ tools: { [toolId]: { $set: toolInfo } } })

          const assetInfo = assets[toolInfo.asset]
          if (!assetInfo) {
            throw Error(`Unknown asset '${toolInfo.asset}'`)
          }

          // Download the asset (we assume tools will always match exactly 1 asset)
          const downloadPath = await this.downloadAsset(assetInfo, true)

          context.setLabel(`Installing ${toolInfo.name}...`)

          // For tools it should always be safe to move the downloaded files directly to Tools, rather than having symbolic links to Downloads
          const toolPath = this.getToolPath(toolId)
          await fsMove(downloadPath, toolPath, { overwrite: true })

          try {
            // Hardcoded installation process for some tools
            switch (toolId) {
              case ToolID.DgVoodoo: {
                if (!settings.install?.path) {
                  throw Error("Missing installation path")
                }

                const setupPath = path.join(toolPath, "DgVoodoo 2 SC4 Version")
                const binPath = path.join(setupPath, "SimCity 4")

                // Backup SGR files
                const filesToBackup = await fsQueryFiles(settings.install.path, "*.sgr")
                for (const relativePath of filesToBackup) {
                  await fsCopy(
                    path.join(settings.install.path, relativePath),
                    path.join(settings.install.path, replaceExtension(relativePath, ".sgr.backup")),
                    { overwrite: true },
                  )
                }

                // Move files to SC4 installation directory
                const filesToMoveToInstall = await fsQueryFiles(binPath)
                for (const relativePath of filesToMoveToInstall) {
                  await fsMove(
                    path.join(binPath, relativePath),
                    path.join(settings.install.path, relativePath),
                    { overwrite: true },
                  )
                }

                // Move documentation to ~docs
                const filesToMoveToDocs = await fsQueryFiles(setupPath, "**/*.txt")
                for (const relativePath of filesToMoveToDocs) {
                  await fsMove(
                    path.join(setupPath, relativePath),
                    path.join(toolPath, DIRNAMES.docs, relativePath),
                    { overwrite: true },
                  )
                }

                // Create a symbolic link to executable
                await fsSymlink(
                  path.join(settings.install.path, toolInfo.exe),
                  path.join(toolPath, path.basename(toolInfo.exe)),
                )

                // Remove setup file
                await fsRemove(setupPath)

                // Set DgVoodoo in settings
                if (settings.install.voodoo) {
                  settings.install.voodoo = true
                  this.updateState({ $merge: { settings } })
                  this.writeSettings()
                }

                break
              }

              case ToolID.SC4PIM: {
                const binPath = path.dirname(path.join(toolPath, toolInfo.exe))
                const setupPath = path.join(toolPath, "Setup SC4 PIM-X (X-tool, X-PIM)")
                const exePath = path.join(setupPath, "01. Install SetupSC4PIM/SetupSC4PIMRC8c.exe")

                // Extract from installer to bin
                await extractClickTeam(exePath, binPath, {
                  exePath: exe => this.getToolExePath(exe),
                  logger: context,
                })

                // Move DLLs and config overrides to bin
                const filesToMoveToBin = await fsQueryFiles(setupPath, [
                  "02. Copy into the SC4PIM install folder/*",
                  "04. These go into the Win System 32 and or SysWOW64 folder/*.dll",
                ])

                for (const relativePath of filesToMoveToBin) {
                  await fsMove(
                    path.join(setupPath, relativePath),
                    path.join(binPath, path.basename(relativePath)),
                    { overwrite: true },
                  )
                }

                // Move documentation to docs
                const filesToMoveToDocs = await fsQueryFiles(setupPath, [
                  "05. Set-up SC4PIM-X to the right compatibility mode/*",
                  "06. SC4 PIM User Guide/*",
                ])

                for (const relativePath of filesToMoveToDocs) {
                  await fsMove(
                    path.join(setupPath, relativePath),
                    path.join(toolPath, DIRNAMES.docs, path.basename(relativePath)),
                    { overwrite: true },
                  )
                }

                // Remove setup file
                await fsRemove(setupPath)
              }
            }
          } catch (error) {
            // If installation process fails, delete the download so it will not be treated as installed later
            await fsRemove(toolPath)
            throw error
          }

          toolInfo.installed = true
        } finally {
          toolInfo.action = undefined
          this.updateState({ tools: { [toolId]: { $set: toolInfo } } })
        }

        return toolInfo
      },
      reads: { assets: true, settings: true, tools: [toolId] },
      writes: { tools: [toolId] },
    })
  }

  /**
   * Installs a variant.
   * @param packageId Package ID
   * @param variantId Variant ID
   */
  public async installVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    await this.runner.queue(`packages:install:${packageId}#${variantId}`, {
      handler: async (context, { assets, exemplarProperties, packages }) => {
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

          this.updateState({
            packages: {
              [packageId]: {
                variants: {
                  [variantId]: {
                    $set: variantInfo,
                  },
                },
              },
            },
          })

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

          context.setLabel(`Installing ${packageInfo.name}...`)

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
                      path.join(downloadPath, oldPath),
                      path.join(variantPath, newPath),
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
                      path.join(downloadPath, oldPath),
                      path.join(variantPath, newPath),
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
                    const { patches, ...rest } = file

                    if (patches) {
                      await this.generatePatchedFile(
                        context,
                        path.join(downloadPath, oldPath),
                        path.join(variantPath, newPath),
                        patches,
                        exemplarProperties,
                      )
                    } else {
                      await fsSymlink(
                        path.join(downloadPath, oldPath),
                        path.join(variantPath, newPath),
                      )
                    }

                    includedPaths.add(newPath)
                    files.push(rest)
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
            this.writePackageConfig(packageId)
          } catch (error) {
            // If something goes wrong while installing, fully delete the new variant
            await fsRemove(this.getVariantPath(packageId, variantId))
            variantInfo.files = undefined
            variantInfo.installed = undefined
            throw error
          }
        } finally {
          variantInfo.action = undefined

          this.updateState(
            {
              packages: {
                [packageId]: {
                  variants: {
                    [variantId]: {
                      $set: variantInfo,
                    },
                  },
                },
              },
            },
            true,
          )
        }

        return {}
      },
      reads: { assets: true, exemplarProperties: true, packages: [packageId] },
      writes: { packages: [packageId] },
    })
  }

  protected async linkPackages(): Promise<void> {
    await this.runner.queue("packages:link", {
      handler: async (
        context,
        {
          exemplarProperties,
          features,
          links,
          packages,
          packs,
          plugins,
          profiles,
          profileOptions,
          settings,
        },
      ) => {
        if (!settings.currentProfile) {
          return
        }

        const profileInfo = profiles[settings.currentProfile]
        if (!profileInfo) {
          return
        }

        const packsPath = this.getPacksPath()
        const pluginsPath = this.getPluginsPath()

        /** Current version is part of unique variant key because links need to change when the variant is updated */
        type VariantKey = `${PackageID}#${VariantID}@${string}`

        /** Root links (DLL and INI files must be in Plugins root) */
        const desiredRootLinks: {
          [key in VariantKey]: Set<string>
        } = {}

        /** Normal links, grouped by priority and variants */
        const desiredLinks: {
          [priority in number]: {
            [key in VariantKey]: Set<string>
          }
        } = {}

        /** Packs to use */
        const desiredPacks: {
          [filename in string]?: PackInfo
        } = {}

        /** We will remove relevant links from here, so in the end it will only contain obsolete ones */
        const oldLinks = new Set(links.keys())

        let nCreated = 0
        let nOverwritten = 0
        let nRemoved = 0
        let nUpdated = 0
        let nPackages = 0

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

          // Generate INI files from options (commonly used by DLLs)
          type INI = { [section: string]: { [field: string]: OptionValue } }
          const iniFiles: { [filename: string]: INI } = {}
          if (variantInfo.options?.length) {
            const optionValues = {
              ...profileInfo.options,
              ...profileInfo.packages[packageId]?.options,
            }

            for (const option of variantInfo.options) {
              if (option.file) {
                const filename = option.file
                const [section, field] = option.id.split(".", 2)
                if (field) {
                  iniFiles[filename] ??= {}
                  iniFiles[filename][section] ??= {}
                  iniFiles[filename][section][field] = getOptionValue(option, optionValues)
                } else {
                  context.warn(
                    `In variant '${packageId}#${variantId}': ${option.id} is not a valid option ID for INI generation (expected 'scope.field')`,
                  )
                }
              }
            }
          }

          const patterns = packageStatus.files?.map(pattern => globToRegex(pattern))
          const variantPath = this.getVariantPath(packageId, variantId)
          const includedFiles = variantInfo.files.filter(file =>
            checkFile(
              file,
              packageId,
              variantInfo,
              profileInfo,
              profileOptions,
              features,
              settings,
              patterns,
              false,
            ),
          )

          await Promise.all([
            ...includedFiles.map(async file => {
              const priority = file.priority ?? variantInfo.priority

              const patchedFullPath = await this.getPatchedFile(
                context,
                packageId,
                variantId,
                file,
                exemplarProperties,
              )

              const patchedRelativePath = toPosix(path.relative(variantPath, patchedFullPath)) // relative paths always posix for consistency
              const key: VariantKey = `${packageId}#${variantId}@${variantInfo.version}`
              const extension = getExtension(file.path)

              if (extension === ".dll" || extension === ".ini") {
                desiredRootLinks[key] ??= new Set()
                desiredRootLinks[key].add(patchedRelativePath)
              } else {
                desiredLinks[priority] ??= {}
                desiredLinks[priority][key] ??= new Set()
                desiredLinks[priority][key].add(patchedRelativePath)
              }
            }),
            ...entries(iniFiles).map(async ([filename, data]) => {
              await fsWrite(path.join(this.getPluginsPath(), filename), writeINI(data))
            }),
          ])
        })

        // Find usable existing packs
        forEach(packs, (pack, filename) => {
          const { files, priority } = pack

          const isPackIncluded = keys(files).every(key =>
            files[key]?.every(path => desiredLinks[priority]?.[key]?.has(path)),
          )

          // TODO: Remove obsolete packs
          if (!isPackIncluded) {
            // fsRemove(path.join(packsPath, filename))
            // delete packs[filename]
            // this.writePacks()
            return
          }

          // If pack is included, replace the individual links with it
          desiredPacks[filename] = pack
          forEach(files, (paths, key) => {
            if (desiredLinks[priority][key].size === paths.length) {
              delete desiredLinks[priority][key]
            } else {
              for (const path of paths) {
                desiredLinks[priority][key].delete(path)
              }
            }
          })
        })

        let nLinks = 0
        const nTotalLinks =
          sumBy(values(desiredRootLinks), paths => paths.size) +
          sumBy(values(desiredLinks), priorityLinks =>
            sumBy(values(priorityLinks), paths => paths.size),
          ) +
          size(desiredPacks)

        // Create root links (never packed)
        await forEachAsync(desiredRootLinks, async (paths, variantKey) => {
          const [packageAndVariant] = split(variantKey, "@")
          const [packageId, variantId] = split(packageAndVariant, "#")

          for (const path of paths) {
            await makeLink(this.getVariantFilePath(packageId, variantId, path), getFilename(path))
          }
        })

        // Create normal links
        await forEachAsync(desiredLinks, async (priorityLinks, priority) => {
          const priorityFolder = getPluginsFolderName(Number(priority))

          // TODO: Generate packs
          // if (Number(true) === 0) {
          //   let fileCount = sumBy(values(priorityLinks), paths => paths.size)
          //   while (fileCount >= 30) {
          //     context.setLabel(`Packing ${priorityFolder}...`)

          //     // TODO: Improve splitting logic
          //     let packCount = 0
          //     const packed: typeof priorityLinks = {}
          //     for (const [variantKey, paths] of entries(priorityLinks)) {
          //       delete priorityLinks[variantKey]
          //       packed[variantKey] = paths
          //       packCount += paths.size
          //       fileCount -= paths.size

          //       if (packCount > 100) {
          //         break
          //       }
          //     }

          //     const filename = `Pack-${priority.padStart(3, "0")}-${toHex(randomInt(2 ** 32), 8)}.dat`
          //     const pack: PackInfo = {
          //       files: mapValues(packed, toArray),
          //       priority: Number(priority),
          //     }

          //     context.debug(`Packing ${filename}...`)
          //     await fsCreate(packsPath)
          //     await DBPF.packFiles(
          //       context,
          //       collect(pack.files, (paths, variantKey) => {
          //         const [packageAndVariant] = split(variantKey, "@")
          //         const [packageId, variantId] = split(packageAndVariant, "#")
          //         return paths.map(path => this.getVariantFilePath(packageId, variantId, path))
          //       }).flat(),
          //       path.join(packsPath, filename),
          //     )

          //     packs[filename] = pack
          //     desiredPacks[filename] = pack
          //     this.writePacks()
          //   }
          // }

          await forEachAsync(priorityLinks, async (paths, variantKey) => {
            const [packageAndVariant] = split(variantKey, "@")
            const [packageId, variantId] = split(packageAndVariant, "#")

            for (const relativePath of paths) {
              await makeLink(
                this.getVariantFilePath(packageId, variantId, relativePath),
                path.posix.join(
                  priorityFolder,
                  packageId,
                  relativePath.replace(`${DIRNAMES.patches}/`, ""),
                ),
              )
            }
          })
        })

        // Create pack links
        await forEachAsync(desiredPacks, async (pack, filename) => {
          await makeLink(
            path.join(packsPath, filename),
            path.posix.join(getPluginsFolderName(pack.priority), filename),
          )
        })

        async function makeLink(linkFullPath: string, pluginRelativePath: string): Promise<void> {
          context.abortCheck()
          context.setProgress(nLinks++, nTotalLinks)

          // Overwrite existing files - TODO: Back it up? What about directory?
          if (plugins[pluginRelativePath]) {
            delete plugins[pluginRelativePath]
            nOverwritten++
          }

          // Link is not obsolete (so it will not be deleted)
          oldLinks.delete(pluginRelativePath)

          // Make a system call only if link has changed
          const currentLinkPath = links.get(pluginRelativePath)
          if (currentLinkPath !== linkFullPath) {
            const pluginFullPath = path.join(pluginsPath, pluginRelativePath)
            await fsSymlink(linkFullPath, pluginFullPath, { overwrite: true })
            links.set(pluginRelativePath, linkFullPath)
            if (currentLinkPath) {
              nUpdated++
            } else {
              nCreated++
            }
          }
        }

        if (nOverwritten) {
          this.indexPlugins()
        }

        // Remove obsolete links
        for (const pluginRelativePath of oldLinks) {
          context.abortCheck()
          context.setProgress(nRemoved++, oldLinks.size)

          const fullPath = path.join(pluginsPath, pluginRelativePath)
          await fsRemove(fullPath)
          await fsRemoveIfEmptyRecursive(path.dirname(fullPath), pluginsPath) // TODO: Optimize
          links.delete(pluginRelativePath)
        }

        context.debug(`Done (added ${nCreated}, removed ${nRemoved}, updated ${nUpdated})`)
      },
      invalidate: true,
      label: "Linking packages...",
      reads: {
        exemplarProperties: true,
        features: true,
        links: true,
        packages: true,
        packs: true,
        plugins: true,
        profileOptions: true,
        profiles: true,
        settings: true,
      },
      writes: { links: true, packs: true },
    })
  }

  protected async load(): Promise<void> {
    // Load and send everything to renderer
    await Promise.all([
      // Ordered by rough importance (first registered tasks will be picked first)
      this.loadSettings().then(settings => {
        this.updateState({ $merge: { settings } })
      }),
      this.loadProfiles().then(profiles => {
        this.updateState({ $merge: { profiles } })
      }),
      this.loadLocalPackages().then(packages => {
        if (!this.state.packages) {
          // do not set local packages alone when reloading
          this.updateState({ $merge: { packages } }, true)
        }
      }),
      this.loadPackages().then(({ features, packages }) => {
        this.updateState({ $merge: { features, packages } }, true)
      }),
      this.loadAuthors().then(authors => {
        this.updateState({ $merge: { authors } })
      }),
      this.loadCategories().then(categories => {
        this.updateState({ $merge: { categories } })
      }),
      this.loadCollections().then(collections => {
        this.updateState({ $merge: { collections } })
      }),
      this.loadExemplarProperties().then(exemplarProperties => {
        this.updateState({ $merge: { exemplarProperties } })
      }),
      this.loadProfileOptions().then(profileOptions => {
        this.updateState({ $merge: { profileOptions } })
      }),
      this.loadProfileTemplates().then(templates => {
        this.updateState({ $merge: { templates } })
      }),
      this.loadTools().then(tools => {
        this.updateState({ $merge: { tools } })
      }),
      this.loadRegions().then(regions => {
        this.updateState({ $merge: { regions } })
      }),
      // Startup checks last so we will not delay others accidentally
      this.linkPackages(),
      this.check4GBPatch(true),
      this.checkDgVoodoo(true),
      this.checkPlugins({ isStartup: true }),
      this.indexPlugins(),
    ])
  }

  protected async loadAssets(): Promise<Assets> {
    return this.runner.queue("load:assets", {
      handler: (context, { db, downloads }) => {
        return loadRemoteAssets(context, db.path, downloads)
      },
      label: "Loading assets...",
      reads: { db: true, downloads: true },
      writes: { assets: true },
    })
  }

  protected async loadAuthors(): Promise<Authors> {
    return this.runner.queue("load:authors", {
      handler: async (context, { db }) => {
        return loadAuthors(context, db.path)
      },
      label: "Loading authors...",
      reads: { db: true },
      writes: { authors: true },
    })
  }

  protected async loadCategories(): Promise<Categories> {
    return this.runner.queue("load:categories", {
      handler: async (context, { db }) => {
        return loadCategories(context, db.path)
      },
      label: "Loading categories...",
      reads: { db: true },
      writes: { categories: true },
    })
  }

  protected async loadCollections(): Promise<Collections> {
    return this.runner.queue("load:collections", {
      handler: async (context, { db }) => {
        return loadCollections(context, db.path)
      },
      label: "Loading collections...",
      reads: { db: true },
      writes: { collections: true },
    })
  }

  protected async loadDownloadedAssets(): Promise<{ [id in AssetID]?: string[] }> {
    return this.runner.queue("load:downloads", {
      handler: context => {
        return loadDownloadedAssets(context, this.getDownloadsPath())
      },
      writes: { downloads: true },
    })
  }

  protected async loadExemplarProperties(): Promise<ExemplarProperties> {
    return this.runner.queue("load:properties", {
      handler: async (context, { db }) => {
        return loadExemplarProperties(context, db.path)
      },
      label: "Loading exemplar properties...",
      reads: { db: true },
      writes: { exemplarProperties: true },
    })
  }

  protected async loadLocalPackages(): Promise<Packages> {
    return this.runner.queue("load:packages:local", {
      handler: (context, { categories }) => {
        return loadLocalPackages(context, this.getPackagesPath(), categories)
      },
      label: "Loading local packages...",
      reads: { categories: true },
      writes: { localPackages: true },
    })
  }

  protected async loadMaxisContents(): Promise<FileContents> {
    return this.runner.queue("load:maxis", {
      handler: async (context, { categories, settings }) => {
        if (!settings.install?.path) {
          return {}
        }

        return loadMaxisContents(context, this.getManagerPath(), settings.install.path, {
          categories,
          reload: settings.startup?.reloadMaxis,
        })
      },
      label: "Indexing Maxis files...",
      reads: { categories: true, settings: true },
      writes: { maxis: true },
    })
  }

  public async loadPackageFileEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<DBPFInfo> {
    return this.runner.queue(`packages:read:${packageId}#${variantId}/${filePath}`, {
      handler: async (context, { exemplarProperties, packages }) => {
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
      reads: { exemplarProperties: true, packages: [packageId] },
    })
  }

  public async loadPackageFileEntry(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    entryId: TGI,
  ): Promise<DBPFLoadedEntryInfo> {
    return this.runner.queue(`packages:read:${packageId}#${variantId}/${filePath}#${entryId}`, {
      handler: async (context, { exemplarProperties, packages }) => {
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
        const entry = await DBPF.loadEntry(patchedFullPath, entryId)

        // Load original data as needed
        if (originalFullPath !== patchedFullPath) {
          const originalEntry = await DBPF.loadEntryOptional(originalFullPath, entryId, entry.type)
          entry.original = originalEntry?.data
        }

        return entry
      },
      reads: { exemplarProperties: true, packages: [packageId] },
    })
  }

  protected async loadPackages(): Promise<{ features: Features; packages: Packages }> {
    return this.runner.queue("load:packages", {
      handler: async (
        context,
        { assets, categories, db, localPackages, profileOptions, profiles, settings },
      ) => {
        const packages = await loadRemotePackages(
          context,
          db.path,
          categories,
          localPackages,
          assets,
        )

        const profileId = settings.currentProfile

        if (profileId && profiles[profileId]) {
          return this.resolvePackages(packages, profiles[profileId], profileOptions, settings)
        }

        return { features: {}, packages }
      },
      label: "Loading remote packages...",
      reads: {
        assets: true,
        categories: true,
        db: true,
        localPackages: true,
        profileOptions: true,
        profiles: true,
        settings: true,
      },
      writes: { packages: true },
    })
  }

  protected async loadPacks(): Promise<Packs> {
    return this.runner.queue("load:packs", {
      handler: async context => {
        const packs = await loadPacks(context, this.getManagerPath())

        return packs
      },
      writes: { packs: true },
    })
  }

  public async loadPluginFileEntries(pluginPath: string): Promise<DBPFInfo> {
    return this.runner.queue(`plugins:read:${pluginPath}`, {
      handler: async () => {
        const basePath = this.getPluginsPath()
        const fullPath = path.join(basePath, pluginPath)
        if (!isChildPath(fullPath, basePath)) {
          throw Error("Invalid path")
        }

        return DBPF.loadExemplars(fullPath)
      },
      reads: { plugins: true },
    })
  }

  public async loadPluginFileEntry(pluginPath: string, entryId: TGI): Promise<DBPFLoadedEntryInfo> {
    return this.runner.queue(`plugins:read:${pluginPath}#${entryId}`, {
      handler: async () => {
        const basePath = this.getPluginsPath()
        const fullPath = path.join(basePath, pluginPath)
        if (!isChildPath(fullPath, basePath)) {
          throw Error("Invalid path")
        }

        return DBPF.loadEntry(fullPath, entryId)
      },
      reads: { plugins: true },
    })
  }

  protected async loadPlugins(): Promise<{ links: Map<string, string>; plugins: Plugins }> {
    return this.runner.queue("load:plugins", {
      handler: (context, { categories, settings }) => {
        return loadPlugins(context, this.getManagerPath(), this.getPluginsPath(), {
          categories,
          reload: settings.startup?.reloadPlugins,
        })
      },
      label: "Indexing external plugins...",
      reads: { categories: true, settings: true },
      writes: { plugins: true },
    })
  }

  protected async loadProfileOptions(): Promise<OptionInfo[]> {
    return this.runner.queue("load:options", {
      handler: async (context, { db }) => {
        return loadProfileOptions(context, db.path)
      },
      label: "Loading profile options...",
      reads: { db: true },
      writes: { profileOptions: true },
    })
  }

  protected async loadProfileTemplates(): Promise<Profiles> {
    return this.runner.queue("load:templates", {
      handler: async (context, { db }) => {
        return loadProfileTemplates(context, db.path)
      },
      label: "Loading profile templates...",
      reads: { db: true },
      writes: { profileTemplates: true },
    })
  }

  protected async loadProfiles(): Promise<Profiles> {
    return this.runner.queue("load:profiles", {
      handler: async context => {
        return loadProfiles(context, this.getProfilesPath())
      },
      label: "Loading profiles...",
      writes: { profiles: true },
    })
  }

  protected async loadRegions(): Promise<Regions> {
    return this.runner.queue("load:regions", {
      handler: async context => {
        return loadRegions(context, this.getRegionsPath(), this.getBackupsPath())
      },
      label: "Loading regions...",
      writes: { regions: true },
    })
  }

  public async loadSavePreviewPicture(
    regionId: RegionID,
    cityId: CityID,
    file?: string,
  ): Promise<DBPFLoadedEntryInfo<DBPFDataType.PNG>> {
    return this.runner.queue(`regions:preview:${regionId}:${cityId}${file ? `:${file}` : ""}`, {
      handler: async () => {
        const fullPath = file
          ? this.getCityBackupPath(regionId, cityId, file)
          : this.getCityPath(regionId, cityId)

        const entryId = "8a2482b9-4a2482bb-00000000" as TGI // TODO: Constant
        return DBPF.loadEntry(fullPath, entryId, DBPFDataType.PNG)
      },
      reads: { regions: [regionId] },
    })
  }

  protected async loadSettings(): Promise<Settings> {
    return this.runner.queue("load:settings", {
      handler: async (context, { profiles }) => {
        return loadSettings(
          context,
          this.getManagerPath(),
          this.getPluginsPath(),
          this.getRegionsPath(),
          profiles,
        )
      },
      label: "Loading settings...",
      reads: { profiles: true },
      writes: { settings: true },
    })
  }

  protected async loadSimtropolisSession(): Promise<SimtropolisSession | null> {
    return this.runner.queue("simtropolis:init", {
      handler: async context => {
        this.simtropolisSession = await getSimtropolisSession(this.browserSession)

        if (this.simtropolisSession) {
          context.info("Signed in to Simtropolis")
        }

        return this.simtropolisSession
      },
      writes: { simtropolis: true },
    })
  }

  protected async loadTools(): Promise<Tools> {
    return this.runner.queue("load:tools", {
      handler: async (context, { db }) => {
        return loadTools(context, db.path, this.getToolsPath())
      },
      label: "Loading tools...",
      reads: { db: true },
      writes: { tools: true },
    })
  }

  /**
   * Opens an author's URL in browser.
   */
  public async openAuthorUrl(authorId: PackageID, type: "url" = "url"): Promise<void> {
    return this.runner.queue(`open:package:${type}:${authorId}`, {
      handler: async (_, { authors }) => {
        const authorInfo = authors[authorId]
        if (!authorInfo?.[type]) {
          const name = type === "url" ? "homepage" : type
          throw Error(`Variant '${authorId}' does not have a ${name} URL`)
        }

        await this.openInExplorer(authorInfo[type])
      },
      reads: { authors: [authorId] },
    })
  }

  /**
   * Opens the data repository (either local directory in Explorer, or GitHub repository in browser).
   */
  public async openDataRepository(): Promise<void> {
    return this.runner.queue("open:db", {
      handler: async (_, { settings }) => {
        await this.openInExplorer(settings.db.url ?? settings.db.path)
      },
      reads: { settings: true },
    })
  }

  /**
   * Opens the game's executable directory ("Apps") in Explorer.
   */
  public async openExecutableDirectory(): Promise<void> {
    return this.runner.queue("open:install:exe", {
      handler: async (_, { settings }) => {
        if (!settings.install?.path) {
          throw Error("Game installation path is not set")
        }

        const exePath = path.join(settings.install.path, FILENAMES.sc4exe)
        await this.openInExplorer(path.dirname(exePath))
      },
      reads: { settings: true },
    })
  }

  /**
   * Opens a file in the default editor or a directory in Explorer.
   *
   * TODO: Not cross-platform, whatever...
   */
  protected async openInExplorer(fullPath: string): Promise<void> {
    await cmd(`start "" "${fullPath}"`)
  }

  /**
   * Opens the game's installation directory in Explorer.
   */
  public async openInstallationDirectory(): Promise<void> {
    return this.runner.queue("open:install", {
      handler: async (_, { settings }) => {
        if (!settings.install?.path) {
          throw Error("Game installation path is not set")
        }

        await this.openInExplorer(settings.install.path)
      },
      reads: { settings: true },
    })
  }

  /**
   * Opens a package's config file in the default text editor.
   */
  public async openPackageConfig(packageId: PackageID): Promise<void> {
    return this.runner.queue(`open:package:config:${packageId}`, {
      handler: async (_, { packages }) => {
        const packageInfo = packages[packageId]
        if (!packageInfo?.format) {
          throw Error(`Package '${packageId}' is not installed`)
        }

        const configName = FILENAMES.packageConfig + packageInfo.format
        const fullPath = path.join(this.getPackagesPath(), packageId, configName)
        await this.openInExplorer(fullPath)
      },
      reads: { packages: [packageId] },
    })
  }

  /**
   * Opens a package's file in the default text editor.
   */
  public async openPackageDirectory(
    packageId: PackageID,
    variantId: VariantID,
    relativePath = "",
  ): Promise<void> {
    return this.runner.queue(`open:package:dir:${packageId}#${variantId}:${relativePath ?? "*"}`, {
      handler: async (_, { packages }) => {
        const variantInfo = packages[packageId]?.variants[variantId]
        if (!variantInfo?.installed) {
          throw Error(`Variant '${packageId}#${variantId}' is not installed`)
        }

        const fullPath = path.join(this.getPackagesPath(), packageId, variantId, relativePath)
        await this.openInExplorer(fullPath)
      },
      reads: { packages: [packageId] },
    })
  }

  /**
   * Opens a package's URL in browser.
   */
  public async openPackageUrl(
    packageId: PackageID,
    variantId: VariantID,
    type: "repository" | "support" | "url" = "url",
  ): Promise<void> {
    return this.runner.queue(`open:package:${type}:${packageId}#${variantId}`, {
      handler: async (_, { packages }) => {
        const variantInfo = packages[packageId]?.variants[variantId]
        if (!variantInfo?.[type]) {
          const name = type === "url" ? "homepage" : type
          throw Error(`Variant '${packageId}#${variantId}' does not have a ${name} URL`)
        }

        await this.openInExplorer(variantInfo[type])
      },
      reads: { packages: [packageId] },
    })
  }

  /**
   * Opens a Plugins subdirectory in Explorer.
   */
  public async openPluginDirectory(relativePath = ""): Promise<void> {
    return this.runner.queue(`open:plugin:${relativePath ?? "*"}`, {
      handler: async () => {
        const fullPath = path.join(this.getPluginsPath(), relativePath)
        await this.openInExplorer(fullPath)
      },
    })
  }

  /**
   * Opens a profile's config file in the default text editor.
   */
  public async openProfileConfig(profileId: ProfileID): Promise<void> {
    return this.runner.queue(`open:profile:config:${profileId}`, {
      handler: async (_, { profiles }) => {
        const profileInfo = profiles[profileId]
        if (!profileInfo?.format) {
          throw Error(`Profile '${profileId}' does not exist`)
        }

        const configName = profileId + profileInfo.format
        const fullPath = path.join(this.getProfilesPath(), configName)
        await this.openInExplorer(fullPath)
      },
      reads: { profiles: [profileId] },
    })
  }

  /**
   * Opens a region's subdirectory in Explorer.
   */
  public async openRegionDirectory(regionId: RegionID): Promise<void> {
    return this.runner.queue(`open:region:${regionId}`, {
      handler: async () => {
        const fullPath = path.join(this.getRegionsPath(), regionId)
        await this.openInExplorer(fullPath)
      },
    })
  }

  /**
   * Opens a tool's file in the default text editor.
   */
  public async openToolDirectory(toolId: ToolID, relativePath = ""): Promise<void> {
    return this.runner.queue(`open:tool:dir:${toolId}:${relativePath ?? "*"}`, {
      handler: async (_, { tools }) => {
        const toolInfo = tools[toolId]
        if (!toolInfo?.asset || !toolInfo.installed) {
          throw Error(`Variant '${toolId}' is not installed`)
        }

        await this.openInExplorer(this.getToolPath(toolId, relativePath))
      },
      reads: { tools: [toolId] },
    })
  }

  /**
   * Opens a tool's URL in browser.
   */
  public async openToolUrl(
    toolId: ToolID,
    type: "repository" | "support" | "url" = "url",
  ): Promise<void> {
    return this.runner.queue(`open:tool:${type}:${toolId}`, {
      handler: async (_, { tools }) => {
        const toolInfo = tools[toolId]
        if (!toolInfo?.[type]) {
          const name = type === "url" ? "homepage" : type
          throw Error(`Tool '${toolId}' does not have a ${name} URL`)
        }

        await this.openInExplorer(toolInfo[type])
      },
      reads: { tools: [toolId] },
    })
  }

  /**
   * Patches a package's DBPF file.
   */
  public async patchPackageFileEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    patches: ExemplarDataPatches,
  ): Promise<DBPFInfo> {
    return this.runner.queue(`patch:${packageId}#${variantId}/${filePath}`, {
      handler: async (context, { categories, exemplarProperties, packages, settings }) => {
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

        let file: DBPFInfo | undefined

        // For local variants, we apply changes to the file itself
        if (variantInfo.local) {
          const tempFullPath = this.getTempPath(originalFullPath)

          // Generate patched file in temp folder
          const file = await this.generatePatchedFile(
            context,
            originalFullPath,
            tempFullPath,
            patches,
            exemplarProperties,
          )

          // Replace original file with the patched version
          await fsMove(tempFullPath, originalFullPath, { overwrite: true })

          // Unset original field (so renderer will not show a diff)
          forEach(file.entries, entry => {
            entry.original = undefined
          })

          this.refreshPackageFile(packageId, variantInfo, filePath, file, categories, patches)

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

        if (fileInfo.patches) {
          const patchedFullPath = this.getVariantFilePath(
            packageId,
            variantId,
            filePath,
            this.getHash(fileInfo.patches),
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
          file = await DBPF.loadExemplars(originalFullPath)
        }

        this.updateState({
          packages: {
            [packageId]: {
              variants: {
                [variantId]: {
                  $set: variantInfo,
                },
              },
            },
          },
        })

        this.refreshPackageFile(packageId, variantInfo, filePath, file, categories, patches)
        this.writePackageConfig(packageId)
        this.refreshPatches(packageId, variantId)

        // Trigger a relink of this package only if it is included in current profile
        if (settings.currentProfile) {
          const packageStatus = packageInfo.status[settings.currentProfile]
          if (isIncluded(packageStatus) && isSelected(variantInfo, packageStatus)) {
            this.linkPackages(/* { packageId } */)
          }
        }

        return file
      },
      label: "Generating patches...",
      reads: { categories: true, exemplarProperties: true, packages: [packageId], settings: true },
      writes: { packages: [packageId] },
    })
  }

  /**
   * Patches an external DBPF plugin file.
   */
  public async patchPluginFileEntries(
    pluginPath: string,
    patches: ExemplarDataPatches,
  ): Promise<DBPFInfo> {
    return this.runner.queue(`plugins:patch:${pluginPath}`, {
      handler: async (context, { exemplarProperties, plugins }) => {
        const fullPath = path.join(this.getPluginsPath(), pluginPath)
        const tempFullPath = this.getTempPath(fullPath)

        // Generate patched file in temp folder
        const file = await this.generatePatchedFile(
          context,
          fullPath,
          tempFullPath,
          patches,
          exemplarProperties,
        )

        // Replace original file with the patched version
        await fsMove(tempFullPath, fullPath, { overwrite: true })

        // Unset original field (so renderer will not show a diff)
        forEach(file.entries, entry => {
          entry.original = undefined
        })

        const { contents } = await analyzeSC4File(this.getPluginsPath(), pluginPath)
        plugins[pluginPath] = contents
        // TODO: Conflicts

        this.indexPlugins()

        return file
      },
      label: "Generating patches...",
      reads: { exemplarProperties: true, plugins: [pluginPath] },
      writes: { plugins: [pluginPath] },
    })
  }

  /**
   * Cleans up the application before quiting.
   */
  protected async quit(): Promise<void> {
    // Remove anything left in temporary directory
    await fsRemove(this.getTempPath())
  }

  /**
   * Regenerate a variant from local files.
   */
  public async refreshLocalVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    await this.runner.queue(`packages:regenerate:${packageId}#${variantId}`, {
      handler: async (_, { packages }) => {
        const packageInfo = packages[packageId]
        if (!packageInfo) {
          throw Error(`Package ${packageId} does not exist`)
        }

        const variantInfo = packageInfo.variants[variantId]
        if (!variantInfo) {
          throw Error(`Variant ${packageId}#${variantId} does not exist`)
        }

        if (!variantInfo.local) {
          throw Error(`Variant ${packageId}#${variantId} is not local`)
        }

        const variantPath = this.getVariantPath(packageId, variantId)

        const filePaths = await fsQueryFiles(
          variantPath,
          "**/*.{dat,dll,ini,sc4desc,sc4model,sc4lot}",
          {
            exclude: ["~*/**", "**/desktop.ini"],
          },
        )

        variantInfo.files = filePaths.map(path => ({
          ...variantInfo.files?.find(where({ path })),
          path,
        }))

        const docsPath = DIRNAMES.docs
        if (await fsExists(path.join(variantPath, docsPath))) {
          variantInfo.docs = docsPath
        } else {
          variantInfo.docs = undefined
        }

        const { contents } = await analyzeSC4Files(variantPath, filePaths)

        variantInfo.buildings = collect(
          contents,
          fileContents =>
            fileContents.buildings?.map(building => ({
              ...variantInfo.buildings?.find(where({ file: building.file, id: building.id })),
              ...building,
            })) ?? [],
        ).flat()

        variantInfo.buildings = collect(
          contents,
          fileContents =>
            fileContents.buildings?.map(building => ({
              ...variantInfo.buildings?.find(where({ file: building.file, id: building.id })),
              ...building,
            })) ?? [],
        ).flat()

        variantInfo.buildings = collect(
          contents,
          fileContents =>
            fileContents.buildings?.map(building => ({
              ...variantInfo.buildings?.find(where({ file: building.file, id: building.id })),
              ...building,
            })) ?? [],
        ).flat()

        variantInfo.buildingFamilies = collect(
          contents,
          fileContents =>
            fileContents.buildingFamilies?.map(family => ({
              ...variantInfo.buildingFamilies?.find(where({ file: family.file, id: family.id })),
              ...family,
            })) ?? [],
        ).flat()

        variantInfo.lots = collect(
          contents,
          fileContents =>
            fileContents.lots?.map(lot => ({
              ...variantInfo.lots?.find(where({ file: lot.file, id: lot.id })),
              ...lot,
            })) ?? [],
        ).flat()

        variantInfo.mmps = collect(
          contents,
          fileContents =>
            fileContents.mmps?.map(mmp => ({
              ...variantInfo.mmps?.find(where({ file: mmp.file, id: mmp.id })),
              ...mmp,
            })) ?? [],
        ).flat()

        variantInfo.models = mapValues(contents, fileContents => fileContents.models)

        variantInfo.propFamilies = collect(
          contents,
          fileContents =>
            fileContents.propFamilies?.map(family => ({
              ...variantInfo.propFamilies?.find(where({ file: family.file, id: family.id })),
              ...family,
            })) ?? [],
        ).flat()

        variantInfo.props = collect(
          contents,
          fileContents =>
            fileContents.props?.map(prop => ({
              ...variantInfo.props?.find(where({ file: prop.file, id: prop.id })),
              ...prop,
            })) ?? [],
        ).flat()

        variantInfo.textures = mapValues(contents, fileContents => fileContents.textures)

        this.updateState({
          packages: {
            [packageId]: {
              variants: {
                [variantId]: {
                  $set: variantInfo,
                },
              },
            },
          },
        })

        this.writePackageConfig(packageId)
      },
      label: "Regenerating package...",
      reads: { categories: true, packages: [packageId] },
      writes: { packages: [packageId] },
    })
  }

  /**
   * Reanalyze a single package file.
   */
  public async refreshPackageFile(
    packageId: PackageID,
    variantInfo: VariantInfo,
    filePath: string,
    file: DBPFInfo,
    categories: Categories,
    patches?: ExemplarDataPatches,
  ): Promise<void> {
    let updated = false

    forEach(file.entries, (entry, tgi) => {
      if (!patches || patches[tgi] !== undefined) {
        if (entry.data && entry.type === DBPFDataType.EXEMPLAR) {
          const exemplar: Exemplar = { ...entry, data: entry.data, file: filePath }

          switch (getExemplarType(tgi, exemplar.data)) {
            case ExemplarType.Building: {
              const [, group, id] = split(tgi, "-") as [TypeID, GroupID, BuildingID]
              const building = variantInfo.buildings?.find(where({ file: filePath, group, id }))

              if (building) {
                const data = getBuildingInfo(exemplar)
                $merge(building, loadBuildingInfo(filePath, group, id, data, categories))
                updated = true
              }

              break
            }

            case ExemplarType.LotConfig: {
              const [, , id] = split(tgi, "-") as [TypeID, GroupID, LotID]
              const lot = variantInfo.lots?.find(where({ file: filePath, id }))

              if (lot) {
                const data = getLotInfo(exemplar)
                $merge(lot, loadLotInfo(filePath, id, data))
                updated = true
              }

              break
            }

            case ExemplarType.Prop: {
              const [, group, id] = split(tgi, "-") as [TypeID, GroupID, PropID]
              const prop = variantInfo.props?.find(where({ file: filePath, group, id }))

              if (prop) {
                const data = getPropInfo(exemplar)
                $merge(prop, loadPropInfo(filePath, group, id, data))
                updated = true
              }

              break
            }
          }
        }
      }
    })

    if (updated) {
      this.updateState({
        packages: {
          [packageId]: {
            variants: {
              [variantInfo.id]: {
                $set: variantInfo,
              },
            },
          },
        },
      })

      this.writePackageConfig(packageId)
    }
  }

  /**
   * Generates patched files and deletes obsolete patches.
   */
  protected async refreshPatches(packageId: PackageID, variantId: VariantID): Promise<void> {
    return this.runner.queue(`packages:patch:refresh:${packageId}#${variantId}`, {
      handler: async (context, { exemplarProperties, packages }) => {
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
          await fsRemove(patchesPath)
        } else {
          const patchesPaths = await fsQueryFiles(patchesPath)

          // Otherwise, remove only unused files
          for (const relativePath of patchesPaths) {
            const fullPath = path.join(patchesPath, relativePath)
            if (!usefulPatchedFiles.has(fullPath)) {
              await fsRemove(fullPath)
              await fsRemoveIfEmptyRecursive(path.dirname(fullPath), basePath)
            }
          }
        }
      },
      invalidate: true,
      label: "Generating patches...",
      reads: { exemplarProperties: true, packages: [packageId] },
      writes: { packages: [packageId] },
    })
  }

  /**
   * Clears all loaded data and loads it again as if we just opened the application.
   *
   * This is how we can get updates to external files without relaunching the whole application.
   *
   * TODO: Would listening to some important files/directories and partial reloading be possible?
   */
  protected async reload(): Promise<void> {
    this.runner.cancelPendingTasks()
    this.runner.reloadAll()
    return this.load()
  }

  /**
   * Reload plugins.
   */
  public async reloadPlugins(): Promise<void> {
    this.runner.reload(["plugins"])
    this.checkPlugins({ isSilent: true })
    this.indexPlugins()
  }

  /**
   * Removes a backup.
   */
  public async removeBackup(regionId: RegionID, cityId: CityID, file: string): Promise<boolean> {
    return this.runner.queue(`backups:remove:${regionId}:${cityId}:${file}`, {
      handler: async (context, { regions }) => {
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

        const backupPath = this.getCityBackupPath(regionId, cityId, backup.file)

        context.debug(`Deleting backup '${regionId}/${cityId}/${backup.file}'...`)

        await fsRemove(backupPath)
        await fsRemoveIfEmptyRecursive(path.dirname(backupPath), this.getBackupsPath()) // TODO: optimize?

        city.backups = city.backups.filter(backup => backup.file !== file)

        this.updateState({ regions: { [regionId]: { cities: { [cityId]: { $set: city } } } } })
        return true
      },
      reads: { regions: [regionId] },
      writes: { regions: [regionId] },
    })
  }

  /**
   * Remove a file or folder from Plugins (moving it to backup).
   */
  public async removePlugin(pluginPath: string): Promise<void> {
    await this.runner.queue(`plugins:remove:${pluginPath}`, {
      handler: async (_, { plugins }) => {
        const backupPath = this.getPluginsBackupPath()
        const basePath = this.getPluginsPath()
        const fullPath = path.join(basePath, pluginPath)
        if (!isChildPath(fullPath, basePath)) {
          throw Error("Invalid path")
        }

        if (plugins[pluginPath]) {
          await fsMove(fullPath, path.join(backupPath, pluginPath), { overwrite: true })
          delete plugins[pluginPath]
        } else {
          const subpaths = keys(plugins).filter(path => path.startsWith(`${pluginPath}/`))
          for (const subpath of subpaths) {
            await fsMove(path.join(basePath, subpath), path.join(backupPath, subpath), {
              overwrite: true,
            })

            delete plugins[subpath]
          }
        }

        await fsRemoveIfEmptyRecursive(path.dirname(fullPath), basePath)

        this.indexPlugins()
      },
      reads: { plugins: true },
      writes: { plugins: true },
    })
  }

  /**
   * Remove a profile (except the last one).
   */
  public async removeProfile(profileId: ProfileID): Promise<boolean> {
    return this.runner.queue(`profiles:remove:${profileId}`, {
      handler: async (context, { packages, profileOptions, profiles, settings }) => {
        const oldProfileInfo = profiles[profileId]
        if (!oldProfileInfo?.format) {
          throw Error(`Profile '${profileId}' does not exist`)
        }

        const newProfileInfo = values(profiles).find(profile => profile.id !== profileId)
        if (!newProfileInfo) {
          throw Error("Cannot remove last profile")
        }

        // Ask for confirmation
        const { confirmed } = await showConfirmation(
          i18n.t("RemoveProfileModal:title"),
          i18n.t("RemoveProfileModal:confirmation", { profileName: oldProfileInfo.name }),
          i18n.t("RemoveProfileModal:description"),
          false,
          "warning",
        )

        if (!confirmed) {
          return false
        }

        // Checkout another profile if removing the current one
        if (settings.currentProfile === profileId) {
          context.setLabel("Switching profile...")
          settings.currentProfile = newProfileInfo.id

          this.updateState(
            {
              $merge: this.resolvePackages(packages, newProfileInfo, profileOptions, settings),
              settings: { currentProfile: { $set: newProfileInfo.id } },
            },
            true,
          )

          this.writeSettings()
          this.linkPackages()
          this.checkPlugins({ isSilent: true })
        }

        // Remove profile config
        if (oldProfileInfo?.format) {
          context.setLabel("Removing profile...")
          await removeConfig(this.getProfilesPath(), profileId, oldProfileInfo.format)
        }

        delete profiles[profileId]
        this.updateState({ profiles: { $unset: [profileId] } })
        return true
      },
      reads: { packages: true, profileOptions: true, profiles: true, settings: true },
      writes: { settings: true },
    })
  }

  /**
   * Removes an installed tool.
   */
  public async removeTool(toolId: ToolID): Promise<void> {
    await this.runner.queue(`tools:remove:${toolId}`, {
      handler: async (context, { settings, tools }) => {
        const toolInfo = tools[toolId]
        if (!toolInfo?.asset) {
          throw Error(`Unknown tool '${toolId}'`)
        }

        try {
          context.info(`Removing tool '${toolId}'...`)
          toolInfo.action = "removing"
          this.updateState({ tools: { $merge: { [toolId]: toolInfo } } })

          // Hardcoded uninstallation process
          switch (toolId) {
            case ToolID.DgVoodoo: {
              if (!settings.install?.path) {
                throw Error("Missing installation path")
              }

              // Restore SGR backups
              const filesToRestore = await fsQueryFiles(settings.install.path, "*.sgr.backup")

              for (const relativePath of filesToRestore) {
                await fsMove(
                  path.join(settings.install.path, relativePath),
                  path.join(settings.install.path, removeExtension(relativePath)),
                  { overwrite: true },
                )
              }

              // Remove files from SC4 installation directory
              const filesToRemove = await fsQueryFiles(settings.install.path, [
                "Apps/D3*.dll",
                "Apps/DDraw.dll",
                "Apps/dgVoodoo*",
              ])

              for (const relativePath of filesToRemove) {
                await fsRemove(path.join(settings.install.path, relativePath))
              }

              // Unset DgVoodoo in settings
              if (settings.install.voodoo) {
                settings.install.voodoo = undefined
                this.writeSettings()
                this.updateState({ $merge: { settings } })
              }
            }
          }

          const toolPath = this.getToolPath(toolId)
          await fsRemove(toolPath)

          toolInfo.installed = undefined
        } finally {
          toolInfo.action = undefined
          this.updateState({ tools: { $merge: { [toolId]: toolInfo } } })
        }
      },
      reads: { settings: true, tools: [toolId] },
      writes: { tools: [toolId] },
    })
  }

  /**
   * Removes all non-local variants not used by any profile.
   */
  public async removeUnusedPackages(): Promise<boolean> {
    return this.runner.queue("packages:purge", {
      handler: async (context, { packages, profiles, profileOptions, settings }) => {
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

        if (!unusedVariants.length) {
          await showSuccess(
            i18n.t("RemoveUnusedPackagesModal:title"),
            i18n.t("RemoveUnusedPackagesModal:description", { count: 0 }),
          )

          return false
        }

        const { confirmed } = await showConfirmation(
          i18n.t("RemoveUnusedPackagesModal:title"),
          i18n.t("RemoveUnusedPackagesModal:confirmation"),
          i18n.t("RemoveUnusedPackagesModal:description", {
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

        if (!confirmed) {
          return false
        }

        try {
          let nVariants = 0
          for (const { packageId, variantId } of unusedVariants) {
            context.setProgress(nVariants++, unusedVariants.length)
            const packageInfo = packages[packageId]
            const variantInfo = packageInfo?.variants[variantId]
            if (!packageInfo || !variantInfo?.installed) {
              continue
            }

            const installedVariants = values(packageInfo.variants).filter(isInstalled)
            const isOnlyInstalledVariant = installedVariants.length === 1

            if (isOnlyInstalledVariant) {
              await fsRemove(this.getPackagePath(packageId))
            } else {
              await fsRemove(this.getVariantPath(packageId, variantId))
              this.writePackageConfig(packageId)
            }

            variantInfo.files = undefined
            variantInfo.installed = undefined
          }

          await showSuccess(
            i18n.t("RemoveUnusedPackagesModal:title"),
            i18n.t("RemoveUnusedPackagesModal:success"),
          )
        } finally {
          this.updateState(
            {
              packages: {
                $merge: indexBy(
                  mapDefined(unusedVariants, ({ packageId }) => packages[packageId]),
                  packageInfo => packageInfo.id,
                ),
              },
            },
            true,
          )
        }

        return true
      },
      label: "Removing unused packages...",
      reads: { packages: true, profiles: true, profileOptions: true, settings: true },
      writes: { packages: true },
    })
  }

  /**
   * Remove an installed variant.
   *
   * TODO: ATM this does not clean obsolete files from Downloads sub-folder!
   */
  public async removeVariant(packageId: PackageID, variantId: VariantID): Promise<boolean> {
    return this.runner.queue(`packages:remove:${packageId}#${variantId}`, {
      handler: async (context, { packages }) => {
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
            i18n.t(`${namespace}:confirmation`),
            i18n.t(`${namespace}:description`, {
              packageName: packageInfo.name,
              variantName: variantInfo.name,
            }),
          )

          if (!confirmed) {
            return false
          }
        }

        try {
          context.info(`Removing variant '${packageId}#${variantId}'...`)

          variantInfo.action = "removing"

          this.updateState({
            packages: {
              [packageId]: {
                variants: {
                  [variantId]: {
                    action: {
                      $set: "removing",
                    },
                  },
                },
              },
            },
          })

          variantInfo.files = undefined
          variantInfo.installed = undefined

          // Upon removing the only installed variant, remove the whole package directory
          if (isOnlyInstalledVariant) {
            await fsRemove(this.getPackagePath(packageId))
          } else {
            await fsRemove(this.getVariantPath(packageId, variantId))
            this.writePackageConfig(packageId)
          }

          // TODO: This assumes that package is disabled in other profiles!
          if (variantInfo.local) {
            if (allVariants.length === 1) {
              delete packages[packageId]
            } else {
              delete packageInfo.variants[variantId]

              // Unselect the removed variant
              forEach(packageInfo.status, packageStatus => {
                if (packageStatus.variantId === variantId) {
                  const defaultVariant = getDefaultVariant(packageInfo, packageStatus)
                  packageStatus.variantId = defaultVariant.id
                }
              })
            }
          }
        } finally {
          variantInfo.action = undefined

          this.updateState(
            {
              packages: {
                [packageId]: {
                  $set: packages[packageId],
                },
              },
            },
            true,
          )
        }

        return true
      },
      reads: { packages: [packageId] },
      writes: { packages: [packageId] },
    })
  }

  public resolvePackages(
    packages: Packages,
    profileInfo: ProfileInfo,
    profileOptions: OptionInfo[],
    settings: Settings,
  ): {
    features: Features
    packages: Packages
  } {
    const { resultingFeatures, resultingStatus } = resolvePackages(
      packages,
      profileInfo,
      profileOptions,
      settings,
    )

    forEach(packages, (packageInfo, packageId) => {
      packageInfo.status[profileInfo.id] = resultingStatus[packageId]
    })

    return { features: resultingFeatures, packages }
  }

  /**
   * Restores a backup. THIS PERMANENTLY OVERWRITES THE CURRENT SAVE!
   */
  public async restoreBackup(regionId: RegionID, cityId: CityID, file: string): Promise<boolean> {
    return this.runner.queue(`backups:restore:${regionId}:${cityId}:${file}`, {
      handler: async (context, { regions }) => {
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

        // Ask for confirmation if current save is not backed up (will be permanently overwritten)
        if (!hasBackup(city)) {
          const { confirmed } = await showConfirmation(
            `${region.name} - ${city.name}`,
            i18n.t("RestoreBackupModal:confirmation"),
            i18n.t("RestoreBackupModal:description"),
            false,
            "warning",
          )

          if (!confirmed) {
            return false
          }
        }

        const backupPath = this.getCityBackupPath(regionId, cityId, backup.file)

        context.debug(`Restoring backup '${region}/${cityId}/${file}'...`)

        await fsCopy(backupPath, this.getCityPath(regionId, cityId), { overwrite: true })

        city.save = undefined // may now be outdated, clear to lazy-reload later
        city.version = backup.version

        this.updateState({ regions: { [regionId]: { cities: { [cityId]: { $set: city } } } } })
        return true
      },
      reads: { regions: [regionId] },
      writes: { regions: [regionId] },
    })
  }

  /**
   * Runs an installed tool.
   */
  public async runTool(toolId: ToolID): Promise<void> {
    await this.runner.queue(`tools:run:${toolId}`, {
      handler: async (context, { settings, tools }) => {
        const toolInfo = tools[toolId]
        if (!toolInfo) {
          throw Error(`Unknown tool '${toolId}'`)
        }

        if (!toolInfo.installed) {
          throw Error(`Tool '${toolId}' is not installed`)
        }

        try {
          context.info(`Running tool '${toolId}'...`)
          toolInfo.action = "running"
          this.updateState({ tools: { $merge: { [toolId]: toolInfo } } })

          // Hardcoded override for DgVoodoo
          switch (toolId) {
            case ToolID.DgVoodoo: {
              if (!settings.install?.path) {
                throw Error("Missing installation path")
              }

              const exePath = path.join(settings.install.path, toolInfo.exe)
              await runFile(exePath, { logger: context })
              break
            }

            default: {
              const exePath = this.getToolPath(toolId, toolInfo.exe)
              await runFile(exePath, { logger: context })
            }
          }
        } catch (error) {
          console.error(error)
        } finally {
          toolInfo.action = undefined
          this.updateState({ tools: { $merge: { [toolId]: toolInfo } } })
        }
      },
      reads: { settings: true, tools: [toolId] },
    })
  }

  /**
   * Initiates a login to Simtropolis.
   */
  public async simtropolisLogin(): Promise<void> {
    return this.runner.queue("simtropolis:login", {
      handler: async context => {
        this.updateState({ $unset: ["simtropolis"] })

        this.simtropolisSession = await simtropolisLogin(this.browserSession)
        if (this.simtropolisSession?.sessionId) {
          context.info("Signed in to Simtropolis")
        }

        this.updateState({
          simtropolis: {
            $set: this.simtropolisSession && {
              displayName: this.simtropolisSession.displayName,
              sessionId: isDev() ? this.simtropolisSession.sessionId : undefined,
              userId: this.simtropolisSession.userId,
            },
          },
        })
      },
      label: "Signing in to Simtropolis...",
      writes: { simtropolis: true },
    })
  }

  /**
   * Logs out of Simtropolis.
   */
  public async simtropolisLogout(): Promise<void> {
    return this.runner.queue("simtropolis:logout", {
      handler: async context => {
        await simtropolisLogout(this.browserSession)
        context.info("Signed out of Simtropolis")
        this.simtropolisSession = null
        this.updateState({ simtropolis: { $set: null } })
      },
      label: "Signing out of Simtropolis...",
      writes: { simtropolis: true },
    })
  }

  /**
   * Checks out a profile by ID.
   */
  public async switchProfile(profileId: ProfileID): Promise<void> {
    await this.runner.queue(`profiles:select:${profileId}`, {
      handler: async (_, { packages, profileOptions, profiles, settings }) => {
        if (settings.currentProfile === profileId) {
          return
        }

        const profileInfo = profiles[profileId]
        if (!profileInfo) {
          throw Error(`Profile '${profileId}' does not exist`)
        }

        settings.currentProfile = profileId

        this.updateState(
          {
            $merge: this.resolvePackages(packages, profileInfo, profileOptions, settings),
            settings: { currentProfile: { $set: profileId } },
          },
          true,
        )

        this.writeSettings()
        this.linkPackages()
        this.checkPlugins({ isSilent: true })
      },
      invalidate: true,
      label: "Switching profile...",
      reads: { packages: true, profileOptions: true, profiles: [profileId], settings: true },
      writes: { features: true, packages: true, settings: true },
    })
  }

  /**
   * Updates a city savegame.
   */
  public async updateCity(
    regionId: RegionID,
    cityId: CityID,
    action: UpdateSaveAction,
  ): Promise<boolean> {
    return this.runner.queue(`regions:update:${regionId}:${cityId}:${action.action}`, {
      handler: async (context, { regions }) => {
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

        const fullPath = this.getCityPath(regionId, cityId)

        if (action.backup) {
          const description = `(${action.action})`
          const backupTime = new Date()
          const backupFile = getBackupFileName(backupTime, description)
          backupFullPath = this.getCityBackupPath(regionId, cityId, backupFile)

          await fsCopy(fullPath, backupFullPath)

          backup = {
            description,
            file: backupFile,
            time: backupTime,
            version: city.version,
          }
        }

        const tempPath = this.getTempPath(fullPath)

        let updated: boolean

        switch (action.action) {
          case "fix": {
            updated = await fixSave(context, fullPath, { ...action, tempPath })
            break
          }

          case "growify": {
            updated = await growify(context, fullPath, { ...action, tempPath })
            break
          }

          case "historical": {
            updated = await makeHistorical(context, fullPath, { ...action, tempPath })
            break
          }
        }

        if (updated) {
          if (backup) {
            city.backups.push(backup)
          }

          // File was updated - update the version
          city.version = await getFileVersion(fullPath)

          this.updateState({
            regions: {
              [regionId]: {
                cities: {
                  [cityId]: {
                    $set: city,
                  },
                },
              },
            },
          })
        } else if (backupFullPath) {
          // File was not updated - automatic backup no longer needed
          await fsRemove(backupFullPath)
        }

        return updated
      },
      reads: { regions: [regionId] },
      writes: { regions: [regionId] },
    })
  }

  /**
   * Fetches database updates from Git. Does nothing if a local database is used.
   */
  protected async updateDatabase(): Promise<DatabaseSettings> {
    return this.runner.queue("db:update", {
      handler: async (context, { settings }) => {
        if (settings.db.url) {
          await updateDatabase(
            context,
            settings.db.path,
            settings.db.url,
            settings.db.branch || "main",
          )
        }

        return settings.db
      },
      label: "Updating database...",
      reads: { settings: true },
      writes: { db: true },
    })
  }

  /**
   * Edits a profile's settings.
   * @param profileId Profile ID
   * @param update Data to update
   */
  public async updateProfile(profileId: ProfileID, update: ProfileUpdate): Promise<boolean> {
    const key = Date.now()

    const isSimpleEdit =
      (!update.features || isEmpty(update.features)) &&
      (!update.options || isEmpty(update.options)) &&
      (!update.packages || isEmpty(update.packages))

    // Updating only simple fields, no need for recalculations
    if (isSimpleEdit) {
      await this.runner.queue(`profiles:update:${profileId}@${key}`, {
        handler: async (_, { profiles }) => {
          const profileInfo = profiles[profileId]
          if (!profileInfo) {
            throw Error(`Profile '${profileId}' does not exist`)
          }

          $merge(profileInfo, { name: update.name })
          this.updateState({ profiles: { [profileId]: { $set: profileInfo } } })
          this.writeProfileConfig(profileId)
        },
        reads: { profiles: [profileId] },
        writes: { profiles: [profileId] },
      })

      return true
    }

    const confirmedWarnings: Record<string, PackageID[]> = {}

    update.features ??= {}
    update.packages ??= {}

    const affectedPackages: Packages = {}
    const featureUpdates = update.features
    const packageUpdates = update.packages

    try {
      while (true) {
        const { installingVariants, success } = await this.runner.queue(
          `profiles:update:${profileId}@${key}`,
          {
            handler: async (
              context,
              { assets, features, packages, profileOptions, profiles, regions, settings },
            ) => {
              const profileInfo = profiles[profileId]
              if (!profileInfo) {
                throw Error(`Profile '${profileId}' does not exist`)
              }

              forEach(packageUpdates, (packageUpdate, packageId) => {
                const packageStatus = packages[packageId]?.status[profileId]
                if (packageStatus) {
                  if (
                    packageUpdate.enabled !== undefined &&
                    packageUpdate.enabled !== packageStatus.enabled
                  ) {
                    packageStatus.action = packageUpdate.enabled ? "enabling" : "disabling"
                    affectedPackages[packageId] = packages[packageId]
                  } else if (
                    packageUpdate.variant !== undefined &&
                    packageUpdate.variant !== packageStatus.variantId
                  ) {
                    packageStatus.action = "switching"
                    affectedPackages[packageId] = packages[packageId]
                  }
                }
              })

              this.updateState({ packages: { $merge: affectedPackages } })

              const {
                disablingLots,
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

              if (shouldRecalculate) {
                // Apply implicit variant changes automatically
                if (!isEmpty(implicitVariantChanges)) {
                  for (const [packageId, variantIds] of entries(implicitVariantChanges)) {
                    packageUpdates[packageId] ??= {}
                    packageUpdates[packageId].variant = variantIds.new
                  }

                  // Recalculate
                  return {}
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
                    ignoreLabel: i18n.t("ReplaceExternalPackagesModal:ignore"),
                    message: i18n.t("ReplaceExternalPackagesModal:confirmation"),
                    title: i18n.t("ReplaceExternalPackagesModal:title"),
                  })

                  if (response === ConflictConfirmationResponse.CANCEL) {
                    return { success: false }
                  }

                  const ignore = response === ConflictConfirmationResponse.IGNORE
                  for (const feature of incompatibleExternals) {
                    featureUpdates[feature] = ignore
                  }

                  // Recalculate
                  return {}
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
                    ignoreLabel: i18n.t("DisableIncompatiblePackagesModal:ignore"),
                    message: i18n.t("DisableIncompatiblePackagesModal:confirmation"),
                    title: i18n.t("DisableIncompatiblePackagesModal:title"),
                  })

                  if (response === ConflictConfirmationResponse.CANCEL) {
                    return { success: false }
                  }

                  const ignore = response === ConflictConfirmationResponse.IGNORE
                  for (const packageId of incompatiblePackages) {
                    packageUpdates[packageId] ??= {}
                    packageUpdates[packageId].enabled = ignore
                  }

                  // Recalculate
                  return {}
                }

                // Confirm explicit variant changes
                if (!isEmpty(explicitVariantChanges)) {
                  const variants = collect(explicitVariantChanges, (variants, packageId) => {
                    const packageInfo = packages[packageId]
                    const oldVariant = packageInfo?.variants[variants.old]
                    const newVariant = packageInfo?.variants[variants.new]
                    return i18n.t("InstallCompatibleVariantsModal:variant", {
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
                    ignoreLabel: i18n.t("InstallCompatibleVariantsModal:ignore"),
                    message: i18n.t("InstallCompatibleVariantsModal:confirmation"),
                    title: i18n.t("InstallCompatibleVariantsModal:title"),
                  })

                  if (response === ConflictConfirmationResponse.CANCEL) {
                    return { success: false }
                  }

                  const ignore = response === ConflictConfirmationResponse.IGNORE
                  for (const [packageId, variantIds] of entries(explicitVariantChanges)) {
                    packageUpdates[packageId] ??= {}
                    packageUpdates[packageId].variant = ignore ? variantIds.old : variantIds.new
                  }

                  // Recalculate
                  return {}
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
                      i18n.t("EnableFeatures:confirmation"),
                      i18n.t("EnableFeatures:description", {
                        dependencies: dependencyNames.sort(),
                        packageName: packageInfo.name,
                      }),
                    )

                    if (!confirmed) {
                      return { success: false }
                    }

                    for (const dependencyId of dependencyIds) {
                      packageUpdates[dependencyId] ??= {}
                      packageUpdates[dependencyId].enabled = true
                    }

                    // Recalculate
                    return {}
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
                      i18n.t("EnableOptionalDependencies:confirmation"),
                      i18n.t("EnableOptionalDependencies:description", {
                        dependencies: dependencyNames.sort(),
                        packageName: packageInfo.name,
                      }),
                    )

                    for (const dependencyId of dependencyIds) {
                      packageUpdates[dependencyId] ??= {}
                      packageUpdates[dependencyId].enabled = confirmed
                    }

                    // Recalculate
                    return {}
                  }
                }

                // Apply implicit option changes automatically
                if (!isEmpty(implicitOptionChanges)) {
                  for (const [packageId, options] of entries(implicitOptionChanges)) {
                    packageUpdates[packageId] ??= {}
                    packageUpdates[packageId].options = {
                      ...packageUpdates[packageId].options,
                      ...options.new,
                    }
                  }

                  // Recalculate
                  return {}
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
                    return { success: false }
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
                      i18n.t("DownloadAssetsModal:title"),
                      i18n.t("DownloadAssetsModal:confirmation"),
                      missingDependencyIds.length
                        ? [
                            i18n.t("DownloadAssetsModal:descriptionDependencies", {
                              dependencies: dependencyNames.sort(),
                              count: missingDependencyIds.length,
                            }),
                            i18n.t("DownloadAssetsModal:descriptionAssetsWithDependencies", {
                              assets: missingAssets.map(asset => asset.id).sort(),
                              count: missingAssets.length,
                              totalSize,
                            }),
                          ].join("\n\n")
                        : i18n.t("DownloadAssetsModal:descriptionAssets", {
                            assets: missingAssets.map(asset => asset.id).sort(),
                            count: missingAssets.length,
                            totalSize,
                          }),
                    )

                    if (!confirmed) {
                      return { success: false }
                    }
                  }

                  // Install all packages before recalculating
                  return { installingVariants }
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

                      this.updateState({ $merge: { regions } })
                    } catch (_) {
                      // Rollback - Restore from automatic backups
                      for (const backup of backups) {
                        if (await fsExists(backup.backupPath)) {
                          await fsMove(backup.backupPath, backup.cityPath, { overwrite: true })
                        }
                      }

                      return { success: false }
                    }
                  }
                }
              }

              // Apply profile changes
              $merge(profileInfo, resultingProfile)
              this.writeProfileConfig(profileId)

              // Apply package status changes
              forEach(packages, (packageInfo, packageId) => {
                packageInfo.status[profileId] = resultingStatus[packageId]
              })

              if (shouldRecalculate && profileId === settings.currentProfile) {
                // Apply feature changes
                forEach(features, (_, feature) => {
                  if (!resultingFeatures[feature]?.length) {
                    features[feature] = undefined
                  }
                })

                forEach(resultingFeatures, (packageIds, feature) => {
                  features[feature] = packageIds
                })

                this.updateState(
                  {
                    features: {
                      $set: features,
                    },
                    packages: {
                      $set: packages,
                    },
                    profiles: {
                      [profileId]: { $set: profileInfo },
                    },
                  },
                  true,
                )

                this.linkPackages()
                this.checkPlugins({ isSilent: true })
              } else {
                this.updateState(
                  {
                    packages: {
                      $merge: filterValues(packages, (_, id) => !!packageUpdates[id]), // TODO: pick
                    },
                    profiles: {
                      [profileId]: { $set: profileInfo },
                    },
                  },
                  true,
                )
              }

              return { success: true }
            },
            label: "Resolving packages...",
            reads: {
              assets: true,
              features: true,
              packages: true,
              profileOptions: true,
              profiles: [profileId],
              regions: true,
              settings: true,
            },
            writes: {
              features: true,
              packages: true,
              profiles: [profileId],
              regions: true,
            },
          },
        )

        if (success !== undefined) {
          return success
        }

        // Install all packages
        if (installingVariants) {
          await Promise.all(
            collect(installingVariants, async (variantId, packageId) => {
              await this.installVariant(packageId, variantId)
            }),
          )
        }
      }
    } finally {
      await this.runner.queue(`profiles:update:${profileId}:cancel@${key}`, {
        handler: async () => {
          forEach(affectedPackages, packageInfo => {
            const packageStatus = packageInfo.status[profileId]
            if (packageStatus) {
              packageStatus.action = undefined
            }
          })

          this.updateState({ packages: { $merge: affectedPackages } })
        },
        writes: { packages: keys(affectedPackages) },
      })
    }
  }

  /**
   * Edits global settings.
   * @param update Data to update
   */
  public async updateSettings(update: SettingsUpdate): Promise<boolean> {
    const key = Date.now()

    const confirmed = await this.runner.queue(`settings:update:check@${key}`, {
      handler: async (_, { profiles, regions, settings }) => {
        const newSettings = { ...settings, ...update }

        // Warn about changing the linked profile of established cities
        if (update.regions && !this.ignoredWarnings.has("relinkEstablishedCities")) {
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

          if (relinkedCities?.length) {
            const { confirmed, doNotAskAgain } = await showConfirmation(
              i18n.t("RelinkEstablishedCitiesModal:title", {
                city: relinkedCities[0].name,
                count: relinkedCities.length,
              }),
              i18n.t("RelinkEstablishedCitiesModal:confirmation", {
                city: relinkedCities[0].name,
                count: relinkedCities.length,
              }),
              i18n.t("RelinkEstablishedCitiesModal:description", {
                cities: relinkedCities.map(city => city.name).sort(),
                count: relinkedCities.length,
              }),
              true,
              "warning",
              i18n.t("RelinkEstablishedCitiesModal:confirm"),
              i18n.t("RelinkEstablishedCitiesModal:cancel"),
            )

            if (!confirmed) {
              return false
            }

            if (doNotAskAgain) {
              this.ignoredWarnings.add("relinkEstablishedCities")
            }
          }
        }

        return true
      },
      pools: ["dialogs"],
      reads: { profiles: true, regions: true, settings: true },
    })

    if (!confirmed) {
      return false
    }

    // Apply update
    await this.runner.queue(`settings:update@${key}`, {
      handler: async (_, { settings }) => {
        $merge(settings, update)
        this.updateState({ $merge: { settings } })
        this.writeSettings()
      },
      reads: { settings: true },
      writes: { settings: true },
    })

    return true
  }

  protected updateState(data: Spec<ApplicationState>, recompute?: boolean): void {
    this.state = update(this.state, data)
    this.mainWindow?.webContents.postMessage("updateState", { data, recompute: recompute ?? false })
  }

  protected updateStatus(data: Partial<ApplicationStatus>): void {
    this.mainWindow?.webContents.postMessage("updateStatus", data)
  }

  protected async writePacks(): Promise<void> {
    return this.runner.queue("packs:write", {
      handler: async (context, { packs }) => {
        await writePacks(context, this.getManagerPath(), packs)
      },
      invalidate: true,
      reads: { packs: true },
    })
  }

  protected async writePackageConfig(packageId: PackageID): Promise<void> {
    return this.runner.queue(`packages:write:${packageId}`, {
      handler: async (_, { categories, packages }) => {
        const packageInfo = packages[packageId]
        if (!packageInfo) {
          throw Error(`Profile '${packageId}' does not exist.`)
        }

        await writeConfig<PackageData>(
          this.getPackagePath(packageInfo.id),
          FILENAMES.packageConfig,
          writePackageInfo(packageInfo, true, categories),
          ConfigFormat.YAML,
          packageInfo.format,
        )

        packageInfo.format = ConfigFormat.YAML
      },
      invalidate: true,
      label: "Saving package...",
      reads: { categories: true, packages: [packageId] },
    })
  }

  protected async writeProfileConfig(profileId: ProfileID): Promise<void> {
    return this.runner.queue(`profiles:write:${profileId}`, {
      handler: async (_, { profiles }) => {
        const profileInfo = profiles[profileId]
        if (!profileInfo) {
          throw Error(`Profile '${profileId}' does not exist.`)
        }

        compactProfileConfig(profileInfo) // TODO: Remove mutation here

        await writeConfig<ProfileData>(
          this.getProfilesPath(),
          profileInfo.id,
          toProfileData(profileInfo),
          ConfigFormat.YAML,
          profileInfo.format,
        )

        profileInfo.format = ConfigFormat.YAML
      },
      invalidate: true,
      label: "Saving profile...",
      reads: { profiles: [profileId] },
      writes: { profiles: [profileId] },
    })
  }

  protected async writeSettings(): Promise<void> {
    return this.runner.queue("settings:write", {
      handler: async (_, { settings }) => {
        await writeConfig<SettingsData>(
          this.getManagerPath(),
          FILENAMES.settings,
          toSettingsData(settings),
          ConfigFormat.YAML,
          settings.format,
        )

        settings.format = ConfigFormat.YAML
      },
      invalidate: true,
      label: "Saving settings...",
      reads: { settings: true },
    })
  }
}
