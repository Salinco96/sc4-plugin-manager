import { exec as cmd } from "child_process"
import { app, ipcMain, net, protocol } from "electron/main"
import fs from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"

import log, { LogLevel } from "electron-log"
import escapeHtml from "escape-html"
import { glob } from "glob"

import { formatCategory } from "@common/categories"
import {
  ProfileSettings,
  ProfileUpdate,
  createUniqueProfileId,
  defaultProfileSettings,
} from "@common/profiles"
import { ApplicationState } from "@common/state"
import {
  AssetInfo,
  ConfigFormat,
  PackageInfo,
  ProfileInfo,
  Settings,
  getDefaultVariant,
} from "@common/types"

import {
  calculatePackageCompatibility,
  checkoutPackages,
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
import { DIRNAMES, DOCEXTENSIONS, FILENAMES, SC4EXTENSIONS } from "./utils/constants"
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
  public loadStatus: string | null = null
  public conflictGroups?: { [groupId: string]: string[] }
  public packages?: { [packageId: string]: PackageInfo }
  public profiles?: { [profileId: string]: ProfileInfo }
  public settings?: Settings

  public update: {
    packages: boolean | string[]
    profiles: string[]
    settings: boolean
  } = {
    packages: false,
    profiles: [],
    settings: false,
  }

  public mainWindow?: MainWindow
  public splashScreen?: SplashScreen

  public readonly gamePath: string
  public readonly rootPath: string

  public readonly links: { [from: string]: string } = {}

  public readonly tasks: {
    readonly download: TaskManager
    readonly extract: TaskManager
    readonly getAsset: TaskManager
    readonly install: TaskManager
    readonly linker: TaskManager
    readonly writeProfiles: Task
    readonly writeSettings: Task
  } = {
    download: new TaskManager(6, this.onDownloadTaskUpdate.bind(this)),
    extract: new TaskManager(3, this.onExtractTaskUpdate.bind(this)),
    getAsset: new TaskManager(6),
    install: new TaskManager(6),
    linker: new TaskManager(1, this.onLinkTaskUpdate.bind(this)),
    writeProfiles: {},
    writeSettings: {},
  }

  protected databaseUpdatePromise?: Promise<boolean>

  public constructor() {
    this.gamePath = env.GAME_DIR || path.join(app.getPath("documents"), "SimCity 4")
    this.rootPath = env.ROOT_DIR || path.join(this.gamePath, "Manager")

    this.initialize()

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
    this.handle("createProfile")
    this.handle("disablePackages")
    this.handle("editProfile")
    this.handle("enablePackages")
    this.handle("getPackageDocsAsHtml")
    this.handle("getState")
    this.handle("installPackages")
    this.handle("openPackageFileInExplorer")
    this.handle("removePackages")
    this.handle("setPackageVariant")
    this.handle("switchProfile")

    // Create main window
    this.createMainWindow()
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

  public async getState(): Promise<ApplicationState> {
    return {
      linking: false,
      loadStatus: this.loadStatus,
      ongoingDownloads: this.tasks.download.ongoingTasks,
      ongoingExtracts: this.tasks.extract.ongoingTasks,
      conflictGroups: this.conflictGroups,
      packages: this.packages,
      profiles: this.profiles,
      settings: this.settings,
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
    this.loadStatus = "Loading profiles..."
    this.processUpdates()
    const profiles = await this.loadProfiles()

    // Load settings...
    this.loadStatus = "Loading settings..."
    this.processUpdates()
    const settings = await this.loadSettings()

    const currentProfile = settings.currentProfile ? profiles[settings.currentProfile] : undefined

    // Load local packages...
    this.loadStatus = "Loading packages..."
    this.processUpdates()
    const localPackages = await loadLocalPackages(this.getPackagesPath())
    this.packages = localPackages
    this.markPackagesForUpdate()

    // Wait for database update...
    this.loadStatus = "Updating database..."
    this.processUpdates()
    await databaseUpdatePromise

    // Load remote packages...
    this.loadStatus = "Loading packages..."
    this.processUpdates()
    const { assets, packages } = await loadRemotePackages(this.getDatabasePath())
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

    this.markPackagesForUpdate()

    if (currentProfile) {
      this.loadStatus = "Resolving dependencies..."
      this.processUpdates()

      checkoutPackages(this.packages, currentProfile)
      this.markPackagesForUpdate()
      this.processUpdates()

      calculatePackageCompatibility(this.packages, currentProfile.settings)
      this.markPackagesForUpdate()
    }

    // Done
    this.loadStatus = null
    this.processUpdates()
  }

  public async createProfile(name: string, templateProfileId?: string): Promise<boolean> {
    if (!this.profiles || !this.settings) {
      return false
    }

    const profile: ProfileInfo = {
      id: createUniqueProfileId(name, Object.keys(this.profiles)),
      name,
      packages: {},
      settings: defaultProfileSettings,
    }

    const templateProfile = templateProfileId ? this.getProfileInfo(templateProfileId) : undefined
    if (templateProfile) {
      for (const packageId in templateProfile.packages) {
        profile.packages[packageId] = {
          ...templateProfile.packages[packageId],
        }
      }

      profile.settings = {
        ...templateProfile.settings,
      }
    }

    this.profiles[profile.id] = profile
    this.markProfileForUpdate(profile)

    return this.switchProfile(profile.id)
  }

  public async disablePackages(packageIds: string[]): Promise<boolean> {
    const currentProfile = this.getCurrentProfile()
    if (!this.packages || !currentProfile) {
      return false
    }

    // TODO: Check if valid

    const disabledPackageIds = new Set<string>()
    const disableRecursively = (packageId: string) => {
      const config = currentProfile.packages[packageId]
      const info = this.getPackageInfo(packageId)
      if (info?.status.enabled && !config?.enabled && !info.status.requiredBy?.length) {
        info.status.enabled = false
        disabledPackageIds.add(packageId)

        const variantInfo = info.variants[info.status.variantId]
        if (variantInfo.dependencies) {
          for (const dependencyId of variantInfo.dependencies) {
            const dependencyInfo = this.getPackageInfo(dependencyId)
            if (dependencyInfo) {
              if (dependencyInfo.status.requiredBy.length) {
                const index = dependencyInfo.status.requiredBy.indexOf(packageId)
                if (index >= 0) {
                  dependencyInfo.status.requiredBy.splice(index, 1)
                }
              }
            }

            disableRecursively(dependencyId)
          }
        }
      }
    }

    for (const packageId of packageIds) {
      this.setPackageEnabledInConfig(packageId, false)
      disableRecursively(packageId)
    }

    calculatePackageCompatibility(this.packages, currentProfile.settings)
    this.markPackagesForUpdate()
    this.processUpdates()

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

    if (data.settings) {
      Object.assign(profile.settings, data.settings)
      if (this.packages) {
        calculatePackageCompatibility(this.packages, profile.settings)
        this.markPackagesForUpdate()
      }
    }

    this.markProfileForUpdate(profile)
    this.processUpdates()

    return true
  }

  public async enablePackages(packageIds: string[]): Promise<boolean> {
    const currentProfile = this.getCurrentProfile()
    if (!this.packages || !currentProfile) {
      return false
    }

    // TODO: Check if valid

    const enabledPackageIds = new Set<string>()
    const enableRecursively = (packageId: string) => {
      const config = currentProfile.packages[packageId]
      const info = this.getPackageInfo(packageId)
      if (info && !info?.status.enabled) {
        info.status.enabled = true
        enabledPackageIds.add(packageId)

        const variantId = info.status.variantId
        const variant = info.variants[variantId]
        if (variant) {
          if (variant !== getDefaultVariant(info)) {
            if (config) {
              config.variant = variantId
            } else {
              currentProfile.packages[packageId] = { variant: variantId }
            }
          } else if (config) {
            delete config.variant
            if (Object.keys(config).length === 0) {
              delete currentProfile.packages[packageId]
            }
          }

          if (variant.dependencies) {
            for (const dependencyId of variant.dependencies) {
              const dependencyInfo = this.getPackageInfo(dependencyId)
              if (dependencyInfo) {
                dependencyInfo.status.requiredBy ??= []
                dependencyInfo.status.requiredBy.push(packageId)
              }

              enableRecursively(dependencyId)
            }
          }
        }
      }
    }

    for (const packageId of packageIds) {
      this.setPackageEnabledInConfig(packageId, true)
      enableRecursively(packageId)
    }

    calculatePackageCompatibility(this.packages, currentProfile.settings)
    this.markPackagesForUpdate()
    this.processUpdates()

    return true
  }

  public async installPackages(packageIds: string[]): Promise<boolean> {
    if (!this.assets || !this.packages) {
      return false
    }

    try {
      // Find missing dependencies recursively
      const checkedPackages = new Set(packageIds)
      const missingPackages = new Map<string, string>()
      checkedPackages.forEach((packageId: string) => {
        const packageInfo = this.getPackageInfo(packageId)
        if (!packageInfo) {
          throw Error(`Unknown package '${packageId}'`)
        }

        const variantId = packageInfo.status.variantId
        const variantInfo = packageInfo.variants[variantId]
        if (!variantInfo) {
          throw Error(`Unknown variant '${packageId}#${variantId}'`)
        }

        const isInstalled = !!variantInfo.installed
        const isOutdated = !!variantInfo.update
        if (!isInstalled || (isOutdated && packageIds.includes(packageId))) {
          missingPackages.set(packageId, variantInfo.id)
        }

        if (variantInfo.dependencies) {
          for (const dependencyId of variantInfo.dependencies) {
            checkedPackages.add(dependencyId)
          }
        }
      })

      // TODO: Calculate missing assets
      // TODO: Confirmation dialog

      // Install individual packages in reverse order (dependencies first)
      await Promise.all(
        Array.from(missingPackages)
          .reverse()
          .map(([packageId, variantId]) => this.installSinglePackage(packageId, variantId)),
      )

      this.linkPackages()
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  protected async installSinglePackage(packageId: string, variantId: string): Promise<void> {
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
      this.sendPackageUpdate(packageInfo)

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

            // Find all included files
            const filePaths = await glob(asset.include?.map(file => file.path) ?? ["**"], {
              cwd: downloadPath,
              dot: true,
              ignore: asset.exclude?.map(file => file.path),
              matchBase: true,
              nodir: true,
            })

            // Create links
            for (const filePath of filePaths) {
              const fullPath = path.join(downloadPath, filePath)
              const ext = path.extname(filePath)
              if (SC4EXTENSIONS.includes(ext)) {
                const targetPath = path.join(variantPath, filePath)
                await createIfMissing(path.dirname(targetPath))
                await fs.symlink(fullPath, targetPath)
                files.push({ path: filePath })
              } else if (!DOCEXTENSIONS.includes(ext)) {
                console.warn(`File ${fullPath} has unsupported extension ${ext}`)
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

          variantInfo.files = files
          variantInfo.installed = true

          // Rewrite config
          await this.writePackageConfig(packageInfo)

          if (variantInfo.update) {
            Object.assign(variantInfo, variantInfo.update)
            delete variantInfo.update
          }
        } catch (error) {
          delete variantInfo.files
          delete variantInfo.installed
          throw error
        }
      })
    } finally {
      delete variantInfo.action
      this.sendPackageUpdate(packageInfo)
    }
  }

  protected async getAsset(assetInfo: AssetInfo): Promise<void> {
    const key = `${assetInfo.id}@${assetInfo.version}`

    return this.tasks.getAsset.queue(key, async () => {
      const downloadPath = this.getDownloadPath(key)

      const downloaded = await exists(downloadPath)
      if (!downloaded) {
        await this.tasks.download.queue(key, () => download(key, assetInfo.url, downloadPath))
      }

      await this.tasks.extract.queue(key, () => extract(downloadPath))
    })
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

        this.markPackagesForUpdate()
        this.processUpdates()
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

    // TODO: Check if compatible

    info.status.variantId = variantId

    if (currentProfile) {
      calculatePackageCompatibility(this.packages!, currentProfile.settings)
    }

    this.markPackagesForUpdate()
    this.setPackageVariantInConfig(packageId, variantId)
    this.processUpdates()

    return true
  }

  public async switchProfile(profileId: string): Promise<boolean> {
    const profile = this.getProfileInfo(profileId)
    if (!this.settings || !this.packages || !profile) {
      return false
    }

    this.settings.currentProfile = profileId
    this.markSettingsForUpdate()
    checkoutPackages(this.packages, profile)
    calculatePackageCompatibility(this.packages, profile.settings)
    // this.calculatePackages()
    this.processUpdates()

    return true
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
      let changed = false

      const config = profile.packages[packageId]
      const defaultVariant = getDefaultVariant(info)
      if (variantId !== defaultVariant.id) {
        if (config) {
          changed = variantId !== config.variant
          config.variant = variantId
        } else {
          changed = true
          profile.packages[packageId] = { variant: variantId }
        }
      } else if (config) {
        changed = true
        delete config.variant
        if (Object.keys(config).length === 0) {
          delete profile.packages[packageId]
        }
      }

      if (changed) {
        this.markProfileForUpdate(profile)
      }
    }
  }

  protected setPackageEnabledInConfig(packageId: string, enabled: boolean): void {
    const profile = this.getCurrentProfile()
    const info = this.getPackageInfo(packageId)
    if (info && profile) {
      let changed = false

      const config = profile.packages[packageId]
      if (enabled) {
        if (config) {
          changed = !config.enabled
          config.enabled = true
        } else {
          changed = true
          profile.packages[packageId] = { enabled: true }
        }
      } else if (config) {
        changed = true
        delete config.enabled
        if (Object.keys(config).length === 0) {
          delete profile.packages[packageId]
        }
      }

      if (changed) {
        this.markProfileForUpdate(profile)
      }
    }
  }

  protected setProfileSetting(setting: keyof ProfileSettings, value: boolean): boolean {
    const profile = this.getCurrentProfile()
    if (profile && profile.settings[setting] !== value) {
      profile.settings[setting] = value
      this.markProfileForUpdate(profile)
      return true
    } else {
      return false
    }
  }

  protected markPackagesForUpdate(packageIds?: string[]): void {
    if (packageIds) {
      if (this.update.packages) {
        if (this.update.packages !== true) {
          this.update.packages.push(...packageIds)
        }
      } else {
        this.update.packages = packageIds
      }
    } else {
      this.update.packages = true
    }
  }

  protected markProfileForUpdate(profile: ProfileInfo): void {
    this.update.profiles.push(profile.id)
  }

  protected markSettingsForUpdate(): void {
    this.update.settings = true
  }

  protected sendPackageUpdate(packageInfo: PackageInfo): void {
    this.mainWindow?.webContents.postMessage("updateState", {
      packages: {
        [packageInfo.id]: packageInfo,
      },
    })
  }

  protected sendStatusUpdate(status: string | null): void {
    this.mainWindow?.webContents.postMessage("updateState", { loadStatus: status })
  }

  protected onDownloadTaskUpdate(ongoingDownloads: string[]): void {
    this.mainWindow?.webContents.postMessage("updateState", { ongoingDownloads })
  }

  protected onExtractTaskUpdate(ongoingExtracts: string[]): void {
    this.mainWindow?.webContents.postMessage("updateState", { ongoingExtracts })
  }

  protected onLinkTaskUpdate(ongoingTasks: string[]): void {
    this.mainWindow?.webContents.postMessage("updateState", {
      linking: !!ongoingTasks.length,
      loadStatus:
        {
          link: "Linking packages...",
          init: "Initializing...",
        }[ongoingTasks[0]] ?? null,
    })
  }

  protected processUpdates(): void {
    const update: Partial<ApplicationState> = { loadStatus: this.loadStatus }

    if (this.update.packages) {
      update.conflictGroups = this.conflictGroups
      update.packages = this.packages
      this.update.packages = false
      this.linkPackages()
    }

    if (this.update.profiles.length) {
      update.profiles = {}
      for (const profileId of this.update.profiles) {
        const profile = this.getProfileInfo(profileId)
        if (profile) {
          update.profiles[profileId] = profile
          this.writeProfile(profile)
        }
      }
      this.update.profiles = []
    }

    if (this.update.settings) {
      update.settings = this.settings
      this.update.settings = false
      this.writeSettings()
    }

    this.mainWindow?.webContents.postMessage("updateState", update)
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
          profile.settings = { ...defaultProfileSettings, ...profile.settings }
          this.profiles[profileId] = profile
          this.markProfileForUpdate(profile)
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

    this.markSettingsForUpdate()

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
    this: { [key in Event]: (...args: Args) => Promise<unknown> },
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
