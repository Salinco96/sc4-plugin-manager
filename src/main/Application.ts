import { ipcMain } from "electron/main"
import fs from "fs/promises"
import path from "path"

import { ApplicationState } from "@common/state"
import {
  AssetInfo,
  PackageInfo,
  ProfileInfo,
  Settings,
  VariantInfo,
  getDefaultVariant,
} from "@common/types"

import { exec as cmd } from "child_process"
import childProcessPath from "./child?modulePath"
import { loadLocalPackages, loadRemotePackages } from "./data/packages"
import { MainWindow } from "./MainWindow"
import { createChildProcess } from "./process"
import { download } from "./utils/download"
import { getRootPath } from "./utils/paths"
import { createUniqueProfileId } from "@common/utils/profiles"
import {
  createIfMissing,
  deserializeConfig,
  readFile,
  readFileIfPresent,
  removeIfPresent,
  serializeConfig,
  writeFile,
} from "./utils/files"

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
  public packages?: { [packageId: string]: PackageInfo }
  public profiles?: { [profileId: string]: ProfileInfo }
  public settings?: Settings

  public update: {
    packages: boolean
    profiles: string[]
    settings: boolean
  } = {
    packages: false,
    profiles: [],
    settings: false,
  }

  public mainWindow?: MainWindow

  public readonly initializingDownloads: Promise<void>
  public readonly downloads: { [key: string]: Promise<DownloadResult> | true } = {}
  public readonly configFormats: string[] = [".json", ".yaml", ".yml"]
  public readonly maxParallelDownloads: number = 3
  public readonly ongoingDownloads: OngoingDownload[] = []
  public readonly pendingDownloads: PendingDownload[] = []
  public readonly rootPath: string = getRootPath()

  public readonly tasks: {
    readonly writeProfiles: Task
    readonly writeSettings: Task
  } = {
    writeProfiles: {},
    writeSettings: {},
  }

  protected databaseUpdatePromise?: Promise<boolean>

  public constructor() {
    this.initializingDownloads = this.initializeDownloads()

    this.initialize()

    this.handle("createProfile")
    this.handle("disablePackages")
    this.handle("editProfile")
    this.handle("enablePackages")
    this.handle("getState")
    this.handle("installPackages")
    this.handle("openPackageFileInExplorer")
    this.handle("removePackages")
    this.handle("setPackageVariant")
    this.handle("switchProfile")

    this.createMainWindow()
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

  public getPackageInfo(packageId: string): PackageInfo | undefined {
    return this.packages?.[packageId]
  }

  public getProfileInfo(profileId: string): ProfileInfo | undefined {
    return this.profiles?.[profileId]
  }

  public async getState(): Promise<ApplicationState> {
    return {
      loadStatus: this.loadStatus,
      ongoingDownloads: this.ongoingDownloads.map(download => download.key),
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

  protected async initializeDownloads(): Promise<void> {
    let nDownloads = 0
    // Read downloaded assets
    const entries = await fs.readdir(this.getDownloadsPath(), { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        this.downloads[entry.name] = true
        nDownloads++
      }
    }

    console.debug(`Found ${nDownloads} downloaded assets`)
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

    if (currentProfile) {
      // TODO: Link packages for current profile
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
      settings: { cam: false, darknite: false },
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

    const disableRecursively = (packageId: string) => {
      const config = currentProfile.packages[packageId]
      const info = this.getPackageInfo(packageId)
      if (info?.status.enabled && !config?.enabled && !info.status.requiredBy?.length) {
        info.status.enabled = false

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

    this.markPackagesForUpdate()
    this.processUpdates()

    return true
  }

  public async editProfile(
    profileId: string,
    data: { name?: string; settings?: { darknite?: boolean } },
  ): Promise<boolean> {
    const profile = this.getProfileInfo(profileId)
    if (!profile) {
      return false
    }

    if (data.name) {
      profile.name = data.name
    }

    if (data.settings) {
      Object.assign(profile.settings, data.settings)
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

    const enableRecursively = (packageId: string) => {
      const config = currentProfile.packages[packageId]
      const info = this.getPackageInfo(packageId)
      if (info && !info?.status.enabled) {
        info.status.enabled = true

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

    this.markPackagesForUpdate()
    this.processUpdates()

    return true
  }

  public async installPackages(packageIds: string[]): Promise<boolean> {
    if (!this.assets || !this.packages) {
      return false
    }

    // Calculate missing packages
    const checkedPackages = new Set(packageIds)
    const missingPackages = new Map<string, VariantInfo>()
    checkedPackages.forEach((packageId: string) => {
      const info = this.getPackageInfo(packageId)
      if (!info) {
        return
      }

      const variant = info.variants[info.status.variant]
      if (!variant) {
        return
      }

      console.log(info, variant)

      if ((!variant.installed || variant.installed !== variant.version) && !variant.installing) {
        variant.installing = true
        missingPackages.set(packageId, variant)
      }

      for (const dependencyId of variant.dependencies) {
        checkedPackages.add(dependencyId)
      }
    })

    this.markPackagesForUpdate()
    this.processUpdates()

    await this.initializingDownloads

    // Calculate missing assets
    const missingAssets = new Set<AssetInfo>()
    missingPackages.forEach(variant => {
      for (const asset of variant.assets) {
        const assetInfo = this.assets?.[asset.assetId]
        if (assetInfo) {
          const key = `${assetInfo.id}@${assetInfo.version}`
          if (!this.downloads[key]) {
            missingAssets.add(assetInfo)
          }
        } else {
          console.warn(`Unknown asset '${asset.assetId}'`)
        }
      }
    })

    console.log(missingPackages)
    console.log(missingAssets)

    const promises = Array.from(missingPackages).map(async ([id, variant]) => {
      const variantPath = this.getVariantPath(id, variant.id)
      const docsPath = this.getPackageDocsPath(id)

      try {
        await removeIfPresent(variantPath)

        const assetIds = Array.from(new Set(variant.assets.map(asset => asset.assetId)))

        const files: typeof variant.files = []

        const results = await Promise.all(
          assetIds.map(async assetId => {
            const assetInfo = this.assets?.[assetId]
            if (!assetInfo) {
              return false
            }

            const key = `${assetInfo.id}@${assetInfo.version}`
            const result = await this.download(key, assetInfo.url)
            if (!result.success) {
              return false
            }

            const recursive = async (dir: string) => {
              const fullPath = path.join(result.path, dir)
              const entries = await fs.readdir(fullPath, { withFileTypes: true })
              for (const entry of entries) {
                const entryPath = path.join(dir, entry.name)

                if (entry.isDirectory()) {
                  await recursive(entryPath)
                } else {
                  const ext = path.extname(entry.name)
                  if (
                    [".SC4Desc", ".SC4Lot", ".SC4Model", "._LooseDesc", ".dat", ".jar"].includes(
                      ext,
                    )
                  ) {
                    const targetPath = path.join(variantPath, entryPath)
                    await createIfMissing(path.dirname(targetPath))
                    await fs.symlink(path.join(fullPath, entry.name), targetPath)
                    files.push({ path: entryPath })
                  } else {
                    const targetPath = path.join(docsPath, entryPath)
                    await createIfMissing(path.dirname(targetPath))
                    await removeIfPresent(targetPath)
                    await fs.symlink(path.join(fullPath, entry.name), targetPath)
                  }
                }
              }
            }

            try {
              await recursive(".")
              return true
            } catch (error) {
              console.error(error)
              return false
            }
          }),
        )

        if (results.includes(false)) {
          return false
        }

        variant.files = files
        variant.installed = variant.version

        const info = this.getPackageInfo(id)
        if (info) {
          await this.writePackageConfig(info)
        }

        return true
      } catch (error) {
        console.error(error)
        return false
      } finally {
        variant.installing = false
        this.markPackagesForUpdate()
        this.processUpdates()
      }
    })

    const results = await Promise.all(promises)
    return !results.includes(false)
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

    this.markPackagesForUpdate()
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

  protected markPackagesForUpdate(): void {
    this.update.packages = true
  }

  protected markProfileForUpdate(profile: ProfileInfo): void {
    this.update.profiles.push(profile.id)
  }

  protected markSettingsForUpdate(): void {
    this.update.settings = true
  }

  protected processUpdates(): void {
    const update: Partial<ApplicationState> = {
      loadStatus: this.loadStatus,
      ongoingDownloads: this.ongoingDownloads.map(download => download.key),
    }

    if (this.update.packages) {
      update.packages = this.packages
      this.update.packages = false
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
          profile.settings ??= { cam: false, darknite: false }
          profile.settings.darknite ??= false
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
      this.mainWindow = new MainWindow()
      this.mainWindow.on("close", () => {
        this.mainWindow = undefined
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
        console.log("Updating database...")
        createChildProcess<unknown, { success?: boolean; error?: Error }>(childProcessPath, {
          onClose() {
            console.log("Failed updating database:", "closed")
            resolve(false)
          },
          onMessage({ success, error }) {
            if (success) {
              console.log("Updated database")
              resolve(true)
            } else {
              console.log("Failed updating database:", error)
              resolve(false)
            }
          },
        })
      })
    }

    return this.databaseUpdatePromise
  }

  protected async download(
    key: string,
    url: string,
    ignoreQueue?: boolean,
  ): Promise<DownloadResult> {
    const status = this.downloads[key]

    if (status === true) {
      console.log("Already downloaded " + key)
      return {
        path: this.getDownloadPath(key),
        success: true,
      }
    }

    if (status) {
      return status
    }

    let promise: Promise<DownloadResult>

    if (ignoreQueue || this.ongoingDownloads.length < this.maxParallelDownloads) {
      // Start immediately
      promise = this.startDownload(key, url)
      this.processUpdates()
    } else {
      // Push to end of queue
      promise = new Promise(resolve => this.pendingDownloads.push({ key, resolve, url }))
    }

    this.downloads[key] = promise
    return promise
  }

  protected async startDownload(key: string, url: string): Promise<DownloadResult> {
    const promise = download(key, url, this.getDownloadPath(key))
    const ongoing = { key, promise, url }

    this.ongoingDownloads.push(ongoing)

    try {
      await promise
      this.downloads[key] = true
      return {
        path: this.getDownloadPath(key),
        success: true,
      }
    } catch (error) {
      console.error(error)
      delete this.downloads[key]
      return {
        error: error instanceof Error ? error : Error(),
        path: this.getDownloadPath(key),
        success: false,
      }
    } finally {
      // No longer downloading
      const index = this.ongoingDownloads.indexOf(ongoing)
      if (index >= 0) {
        this.ongoingDownloads.splice(index, 1)
      }

      // Start next queued download
      if (this.ongoingDownloads.length < this.maxParallelDownloads) {
        const pending = this.pendingDownloads.shift()
        if (pending) {
          this.startDownload(pending.key, pending.url).then(pending.resolve)
        }
      }

      this.processUpdates()
    }
  }
}
