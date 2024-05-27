import { exec as cmd } from "child_process"
import { ipcMain, net, protocol } from "electron/main"
import fs from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"

import escapeHtml from "escape-html"
import { glob } from "glob"

import { packageGroups } from "@common/packageGroups"
import {
  ProfileSettings,
  ProfileUpdate,
  createUniqueProfileId,
  defaultProfileSettings,
} from "@common/profiles"
import { ApplicationState } from "@common/state"
import { AssetInfo, PackageInfo, ProfileInfo, Settings, getDefaultVariant } from "@common/types"

import childProcessPath from "./child?modulePath"
import { loadLocalPackages, loadRemotePackages, toGlobPattern } from "./data/packages"
import { MainWindow } from "./MainWindow"
import { createChildProcess } from "./process"
import { SplashScreen } from "./SplashScreen"
import { download, extract } from "./utils/download"
import {
  createIfMissing,
  deserializeConfig,
  exists,
  readFile,
  readFileIfPresent,
  removeIfEmpty,
  removeIfPresent,
  serializeConfig,
  writeFile,
} from "./utils/files"
import { getPluginsPath, getRootPath } from "./utils/paths"
import { TaskManager } from "./utils/tasks"

const DOCEXTENSIONS = [".css", ".htm", ".html", ".jpeg", ".jpg", ".md", ".png", ".svg", ".txt"]
const SC4EXTENSIONS = [".dll", ".SC4Desc", ".SC4Lot", ".SC4Model", "._LooseDesc", ".dat"]

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
  public dirnames = {
    downloads: "Downloads",
    packageDocs: "Packages",
    packages: "Packages",
    profiles: "Profiles",
  }

  public filenames = {
    packageConfig: "package",
    settings: "settings",
  }

  public assets?: { [assetId: string]: AssetInfo }
  public loadStatus: string | null = null
  public packageGroups?: { [groupId: string]: string[] }
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

  public readonly configFormats: string[] = [".json", ".yaml", ".yml"]
  public readonly maxParallelDownloads: number = 3
  public readonly ongoingDownloads: OngoingDownload[] = []
  public readonly pendingDownloads: PendingDownload[] = []
  public readonly rootPath: string = getRootPath()

  public readonly links: { [from: string]: string } = {}

  public readonly tasks: {
    readonly download: TaskManager
    readonly extract: TaskManager
    readonly getAsset: TaskManager
    readonly install: TaskManager
    readonly linker: TaskManager

    readonly downloading: Map<string, Promise<void>>
    readonly installing: Map<string, Promise<void>>
    readonly writeProfiles: Task
    readonly writeSettings: Task
  } = {
    download: new TaskManager(6, this.onDownloadTaskUpdate.bind(this)),
    extract: new TaskManager(3, this.onExtractTaskUpdate.bind(this)),
    getAsset: new TaskManager(6),
    install: new TaskManager(6),
    linker: new TaskManager(1, this.onLinkTaskUpdate.bind(this)),

    downloading: new Map(),
    installing: new Map(),
    writeProfiles: {},
    writeSettings: {},
  }

  protected databaseUpdatePromise?: Promise<boolean>

  public constructor() {
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

    this.createMainWindow()
  }

  public async getPackageDocsAsHtml(packageId: string): Promise<string> {
    const packageInfo = this.getPackageInfo(packageId)
    if (!packageInfo) {
      throw Error(`Unknown package '${packageId}'`)
    }

    if (!packageInfo.docs) {
      throw Error(`Package '${packageId}' does not have documentation`)
    }

    const docPath = path.join(this.getPackageDocsPath(packageId), packageInfo.docs)
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

  public getDefaultConfigFormat(): string {
    return this.settings?.useYaml === false ? ".json" : ".yaml"
  }

  public getDownloadsPath(): string {
    return path.join(this.rootPath, this.dirnames.downloads)
  }

  public getDownloadPath(key: string): string {
    return path.join(this.rootPath, this.dirnames.downloads, key)
  }

  public getPackagesPath(): string {
    return path.join(this.rootPath, this.dirnames.packages)
  }

  public getPackagePath(packageId: string): string {
    return path.join(this.rootPath, this.dirnames.packages, packageId)
  }

  public getPackageDocsPath(packageId: string): string {
    return path.join(this.rootPath, this.dirnames.packages, packageId, "~docs")
  }

  public getVariantPath(packageId: string, variantId: string): string {
    return path.join(this.rootPath, this.dirnames.packages, packageId, variantId)
  }

  public getProfilesPath(): string {
    return path.join(this.rootPath, this.dirnames.profiles)
  }

  public getAssetInfo(assetId: string): AssetInfo | undefined {
    return this.assets?.[assetId]
  }

  public getPackageInfo(packageId: string): PackageInfo | undefined {
    return this.packages?.[packageId]
  }

  public getProfileInfo(profileId: string): ProfileInfo | undefined {
    return this.profiles?.[profileId]
  }

  public getDefaultCategoryName(category: number): string {
    if (category < 100) {
      return "Mods"
    }

    if (category < 200) {
      return "Dependencies"
    }

    if (category < 300) {
      return "Residential"
    }

    if (category === 360) {
      return "Landmarks"
    }

    if (category < 400) {
      return "Commercial"
    }

    if (category < 500) {
      return "Industrial"
    }

    if (category < 600) {
      return "Energy"
    }

    if (category === 660) {
      return "Parks"
    }

    if (category < 700) {
      return "Civics"
    }

    if (category < 800) {
      return "Transport"
    }

    if (category >= 900) {
      return "Overrides"
    }

    return "Custom"
  }

  public async getState(): Promise<ApplicationState> {
    return {
      linking: false,
      loadStatus: this.loadStatus,
      ongoingDownloads: this.tasks.download.ongoingTasks,
      ongoingExtracts: this.tasks.extract.ongoingTasks,
      packageGroups: this.packageGroups,
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
    const localPackages = await loadLocalPackages()
    this.packages = localPackages
    this.markPackagesForUpdate()

    // Wait for database update...
    this.loadStatus = "Updating database..."
    this.processUpdates()
    await databaseUpdatePromise

    // Load remote packages...
    this.loadStatus = "Loading packages..."
    this.processUpdates()
    const { assets, packages } = await loadRemotePackages()
    this.assets = assets
    this.packages = packages

    // Merge local and remote package definitions...
    for (const packageId in localPackages) {
      const localPackage = localPackages[packageId]
      this.packages[packageId] ??= localPackage
      const info = this.packages[packageId]
      info.docs = localPackage.docs
      info.format = localPackage.format

      for (const variantId in localPackage.variants) {
        const localVariant = localPackage.variants[variantId]
        if (localVariant) {
          const variant = info.variants[variantId]
          if (variant) {
            variant.files = localVariant.files
            variant.installed = localVariant.version
          } else {
            info.variants[variantId] = {
              ...localVariant,
              installed: localVariant.version,
              local: true,
            }
          }
        }
      }
    }

    this.markPackagesForUpdate()

    if (currentProfile) {
      this.loadStatus = "Resolving dependencies..."
      this.processUpdates()

      this.calculatePackages()
    }

    // TODO: Initialize fetcher

    this.loadStatus = "Synchronizing..."
    this.processUpdates()
    // TODO: Initialize linker

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

        const variant = info.variants[info.status.variant]
        if (variant) {
          for (const dependencyId of variant.dependencies) {
            const dependencyInfo = this.getPackageInfo(dependencyId)
            if (dependencyInfo) {
              if (dependencyInfo.status.requiredBy) {
                const index = dependencyInfo.status.requiredBy.indexOf(packageId)
                if (index >= 0) {
                  if (dependencyInfo.status.requiredBy.length > 1) {
                    dependencyInfo.status.requiredBy.splice(index, 1)
                  } else {
                    delete dependencyInfo.status.requiredBy
                  }
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

    // Check package groups
    this.packageGroups ??= {}
    for (const packageId of disabledPackageIds) {
      if (packageGroups[packageId]) {
        for (const groupId of packageGroups[packageId]) {
          const index = this.packageGroups[groupId].indexOf(packageId)
          if (index >= 0) {
            this.packageGroups[groupId].splice(index, 1)

            if (this.packageGroups[groupId].length === 0) {
              delete this.packageGroups[groupId]

              if (groupId === "cam") {
                this.setProfileSetting("cam", false)
              }

              if (groupId === "darknite") {
                this.setProfileSetting("darknite", false)
              }
            }
          }
        }
      }
    }

    this.calculatePackageCompatibility()
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
      this.calculatePackageCompatibility()
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

        const variant = info.variants[info.status.variant]
        if (variant) {
          if (info.status.variant !== getDefaultVariant(info)) {
            if (config) {
              config.variant = info.status.variant
            } else {
              currentProfile.packages[packageId] = { variant: info.status.variant }
            }
          } else if (config) {
            delete config.variant
            if (Object.keys(config).length === 0) {
              delete currentProfile.packages[packageId]
            }
          }

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

    for (const packageId of packageIds) {
      this.setPackageEnabledInConfig(packageId, true)
      enableRecursively(packageId)
    }

    // Check package groups
    this.packageGroups ??= {}
    for (const packageId of enabledPackageIds) {
      if (packageGroups[packageId]) {
        for (const groupId of packageGroups[packageId]) {
          this.packageGroups[groupId] ??= []
          this.packageGroups[groupId].push(packageId)

          if (groupId === "cam") {
            this.setProfileSetting("cam", true)
          }

          if (groupId === "darknite") {
            this.setProfileSetting("darknite", true)
          }
        }
      }
    }

    this.calculatePackageCompatibility()
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

        const variantId = packageInfo.status.variant
        const variantInfo = packageInfo.variants[variantId]
        if (!variantInfo) {
          throw Error(`Unknown variant '${packageId}#${variantId}'`)
        }

        const isInstalled = !!variantInfo.installed
        const isOutdated = variantInfo.installed !== variantInfo.version
        if (!isInstalled || (isOutdated && packageIds.includes(packageId))) {
          missingPackages.set(packageId, variantInfo.id)
        }

        for (const dependencyId of variantInfo.dependencies) {
          checkedPackages.add(dependencyId)
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

      variantInfo.installing = true
      this.sendPackageUpdate(packageInfo)

      await this.tasks.install.queue(variantKey, async () => {
        const variantPath = this.getVariantPath(packageId, variantId)
        const docsPath = this.getPackageDocsPath(packageId)

        const assetInfos = variantInfo.assets.map(asset => {
          const assetInfo = this.getAssetInfo(asset.assetId)
          if (assetInfo) {
            return assetInfo
          } else {
            throw Error(`Unknown asset '${asset.assetId}'`)
          }
        })

        // Download and extract all assets
        await Promise.all(assetInfos.map(this.getAsset.bind(this)))

        // Remove any previous installation files
        await removeIfPresent(variantPath)

        try {
          const files: typeof variantInfo.files = []

          for (const asset of variantInfo.assets) {
            const assetInfo = this.getAssetInfo(asset.assetId)!
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
            const filePaths = await glob(asset.include?.map(toGlobPattern) ?? "**", {
              cwd: downloadPath,
              dot: true,
              ignore: asset.exclude?.map(toGlobPattern),
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
            packageInfo.docs =
              docsPaths.find(file => path.basename(file).match(/^index\.html?$/i)) ??
              docsPaths.find(file => path.basename(file).match(/readme/i)) ??
              docsPaths[0]
          }

          variantInfo.files = files
          variantInfo.installed = variantInfo.version

          // Rewrite config
          await this.writePackageConfig(packageInfo)
        } catch (error) {
          delete variantInfo.files
          delete variantInfo.installed
          throw error
        }
      })
    } finally {
      delete variantInfo.installing
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

        const variantId = info.status.variant
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
          info.status.variant = defaultVariant
          this.setPackageVariantInConfig(packageId, defaultVariant)
          delete info.variants[info.status.variant]
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
    const info = this.getPackageInfo(packageId)
    if (!info) {
      return false
    }

    const variant = info.variants[variantId]
    if (!variant) {
      return false
    }

    // TODO: Check if compatible

    info.status.variant = variantId

    // TODO: Apply dependency changes

    this.markPackagesForUpdate()
    this.setPackageVariantInConfig(packageId, variantId)
    this.processUpdates()

    return true
  }

  public async switchProfile(profileId: string): Promise<boolean> {
    const profile = this.getProfileInfo(profileId)
    if (!this.settings || !profile) {
      return false
    }

    this.settings.currentProfile = profileId
    this.markSettingsForUpdate()
    this.calculatePackages()
    this.processUpdates()

    return true
  }

  protected async linkPackages(): Promise<void> {
    if (!this.packages || !this.assets) {
      return
    }

    const pluginsPath = getPluginsPath()

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

          const categoryPaths = new Map<number, string>()

          await createIfMissing(pluginsPath)
          const entries = await fs.readdir(pluginsPath, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.match(/^\d{3}(?!\d)/)) {
              const category = Number.parseInt(entry.name.slice(0, 3), 10)
              categoryPaths.set(category, entry.name)
            }
          }

          const oldLinks = new Set(Object.keys(this.links))

          const getCategoryPath = (category: number) => {
            const existingPath = categoryPaths.get(category)
            if (existingPath) {
              return existingPath
            }

            const categoryName = this.getDefaultCategoryName(category)
            const newPath = `${category.toString(10).padStart(3, "0")} - ${categoryName}`
            categoryPaths.set(category, newPath)
            return newPath
          }

          const makeLink = async (from: string, to: string) => {
            await removeIfPresent(to)
            await createIfMissing(path.dirname(to))
            await fs.symlink(from, to)
            this.links[to] = from
          }

          for (const packageId in this.packages) {
            const packageInfo = this.packages[packageId]
            if (packageInfo.status.enabled) {
              const variantId = packageInfo.status.variant
              const variantInfo = packageInfo.variants[variantId]
              if (variantInfo) {
                const variantPath = this.getVariantPath(packageId, variantId)
                if (variantInfo.files?.length) {
                  for (const file of variantInfo.files) {
                    const fullPath = path.join(variantPath, file.path)
                    const categoryPath = getCategoryPath(file.category ?? packageInfo.category)

                    // DLL files must be in Plugins root
                    const targetPath = file.path.match(/\.dll$/i)
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
            while (parentPath !== pluginsPath && (await removeIfEmpty(parentPath))) {
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

  protected calculatePackages(initial: boolean = false): void {
    const currentProfile = this.getCurrentProfile()
    if (!this.packages) {
      return
    }

    if (!initial) {
      for (const info of Object.values(this.packages)) {
        delete info.status.enabled
        delete info.status.requiredBy
      }
    }

    if (currentProfile) {
      // Set package variants
      for (const packageId in currentProfile.packages) {
        const config = currentProfile.packages[packageId]
        const info = this.getPackageInfo(packageId)
        if (info && config?.variant) {
          if (info.variants[config.variant]) {
            info.status.variant = config.variant
          } else {
            console.warn(`Unknown package variant '${packageId}#${config.variant}'`)
          }
        }
      }

      const enableRecursively = (packageId: string) => {
        const info = this.getPackageInfo(packageId)
        if (info && !info.status.enabled) {
          info.status.enabled = true
          const variant = info.variants[info.status.variant]

          if (variant) {
            for (const dependencyId of variant.dependencies) {
              const dependencyInfo = this.getPackageInfo(dependencyId)
              if (dependencyInfo) {
                dependencyInfo.status.requiredBy ??= []
                dependencyInfo.status.requiredBy.push(packageId)
                enableRecursively(dependencyId)
              } else {
                console.warn(`Unknown package  '${dependencyId}'`)
              }
            }
          }
        }
      }

      // Enable packages and dependencies recursively
      for (const packageId in currentProfile.packages) {
        const config = currentProfile.packages[packageId]
        const info = this.getPackageInfo(packageId)
        if (config?.enabled) {
          if (info) {
            enableRecursively(packageId)
          } else {
            console.warn(`Unknown package '${packageId}'`)
          }
        }
      }
    }

    this.calculatePackageGroups()
  }

  protected calculatePackageGroups(): void {
    const profile = this.getCurrentProfile()
    // Check package groups
    this.packageGroups = {}
    for (const packageId in packageGroups) {
      if (this.getPackageInfo(packageId)?.status.enabled) {
        for (const groupId of packageGroups[packageId]) {
          this.packageGroups[groupId] ??= []
          this.packageGroups[groupId].push(packageId)

          if (profile) {
            if (groupId === "cam" && !profile.settings.cam) {
              profile.settings.cam = true
              this.markProfileForUpdate(profile)
            }

            if (groupId === "darknite" && !profile.settings.darknite) {
              profile.settings.darknite = true
              this.markProfileForUpdate(profile)
            }
          }
        }
      }
    }

    this.calculatePackageCompatibility()
  }

  protected calculatePackageCompatibility(): void {
    const profile = this.getCurrentProfile()
    if (!profile) {
      return
    }

    this.packageGroups ??= {}

    // Check package compatibility
    for (const packageId in this.packages) {
      const info = this.packages[packageId]
      for (const variantId in info.variants) {
        const variant = info.variants[variantId]
        if (variant) {
          if (variantId === "nightmode=standard") {
            variant.compatible =
              !profile.settings.darknite && !packageGroups[packageId]?.includes("darknite")
          } else if (variantId === "nightmode=dark") {
            variant.compatible =
              !!profile.settings.darknite || !!packageGroups[packageId]?.includes("darknite")
          } else if (variantId === "CAM=yes") {
            variant.compatible =
              !!profile.settings.cam || !!packageGroups[packageId]?.includes("cam")
          } else if (variantId === "CAM=no") {
            variant.compatible = !profile.settings.cam && !packageGroups[packageId]?.includes("cam")
          } else {
            variant.compatible = true
          }
        }
      }

      if (!info.variants[info.status.variant]?.compatible) {
        info.status.variant = getDefaultVariant(info)
        this.setPackageVariantInConfig(info.id, info.status.variant)
      }
    }

    this.markPackagesForUpdate()
    this.processUpdates()
  }

  protected setPackageVariantInConfig(packageId: string, variantId: string): void {
    const profile = this.getCurrentProfile()
    const info = this.getPackageInfo(packageId)
    if (info && profile) {
      let changed = false

      const config = profile.packages[packageId]
      const defaultVariant = getDefaultVariant(info)
      if (variantId !== defaultVariant) {
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
      update.packageGroups = this.packageGroups
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
      const format = path.extname(entry.name)
      if (entry.isFile() && this.configFormats.includes(format)) {
        const profileId = path.basename(entry.name, format)
        const profilePath = path.join(profilesPath, entry.name)
        if (this.profiles[profileId]) {
          console.warn(`Duplicate profile configuration '${entry.name}'`)
          continue
        }

        try {
          const profile = await this.readConfig<ProfileInfo>(profilePath)
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

    const config = await this.loadConfig<Settings>(this.rootPath, this.filenames.settings)

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

  // protected async updateSettings(update: Partial<Settings>): Promise<void> {
  //   if (!this.settings) {
  //     return
  //   }

  //   Object.assign(this.settings, update)

  //   this.markSettingsForUpdate()

  //   return this.writeSettings()
  // }

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
    this.tasks.writeProfiles.current = this.writeConfig(
      this.getProfilesPath(),
      id,
      data,
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
    this.tasks.writeSettings.current = this.writeConfig(
      this.rootPath,
      this.filenames.settings,
      data,
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
  ): Promise<{ data: T; format: string } | undefined> {
    for (const format of this.configFormats) {
      const fullPath = path.join(basePath, filename + format)
      const raw = await readFileIfPresent(fullPath)
      if (raw) {
        const data = deserializeConfig<T>(raw, fullPath.endsWith(".json") ? "json" : "yaml")
        return { data, format }
      }
    }
  }

  protected async readConfig<T>(fullPath: string): Promise<T> {
    const raw = await readFile(fullPath)
    return deserializeConfig<T>(raw, fullPath.endsWith(".json") ? "json" : "yaml")
  }

  protected async writeConfig<T>(
    basePath: string,
    filename: string,
    data: T,
    oldFormat?: string,
  ): Promise<void> {
    const newFormat = this.getDefaultConfigFormat()
    const newPath = path.join(basePath, filename + newFormat)
    const raw = serializeConfig(data, newFormat === ".json" ? "json" : "yaml")
    await createIfMissing(path.dirname(newPath))
    await writeFile(newPath, raw)
    if (oldFormat && oldFormat !== newFormat) {
      const oldPath = path.join(basePath, filename + oldFormat)
      await removeIfPresent(oldPath)
    }
  }

  protected async writePackageConfig(packageInfo: PackageInfo): Promise<void> {
    await this.writeConfig(
      this.getPackagePath(packageInfo.id),
      this.filenames.packageConfig,
      {
        name: packageInfo.name,
        category: packageInfo.category,
        docs: packageInfo.docs,
        variants: Object.fromEntries(
          Object.entries(packageInfo.variants)
            .filter(([_, variant]) => !!variant?.installed)
            .map(([id, variant]) => [
              id,
              {
                dependencies: variant?.dependencies?.length ? variant.dependencies : undefined,
                files: variant?.files?.length ? variant.files : undefined,
                name: variant?.name,
                version: variant?.installed,
              },
            ]),
        ),
      },
      packageInfo.format,
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
      this.databaseUpdatePromise = new Promise(resolve => {
        console.info("Updating database...")
        createChildProcess<unknown, { success?: boolean; error?: Error }>(childProcessPath, {
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
        })
      })
    }

    return this.databaseUpdatePromise
  }
}
