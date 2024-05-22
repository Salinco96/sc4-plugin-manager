// import fs from "fs/promises"
// import path from "path"

// import { parse as yamlParse, stringify as yamlStringify } from "yaml"

// import { ApplicationData } from "@common/state"
// import { PackageConfig, PackageStatus, ProfileData, ProfileInfo, Settings } from "@common/types"
// import { parsePackageId } from "@common/utils/packages"
// import { assert, isBoolean, isObject, isString } from "@common/utils/types"

// import childProcessPath from "../child?modulePath"
// import { createChildProcess } from "../process"
// import { getRootPath } from "../utils/paths"

// import { loadLocalPackages, loadRemotePackages } from "./packages"

// const formats = [".json", ".yaml", ".yml"]

// export enum ConfigFormat {
//   JSON = ".json",
//   YAML = ".yaml",
// }

// const dirnames = {
//   downloads: "Downloads",
//   packages: "Packages",
//   profiles: "Profiles",
// }

// const filenames = {
//   packageConfig: "package",
//   settings: "settings",
// }

// export class DataManager {
//   databaseUpdatePromise?: Promise<boolean>
//   data: Partial<ApplicationData> = {}
//   defaultFormat: string = ".json"
//   rootPath: string = getRootPath()
//   status: string | null = null

//   getDownloadsPath() {
//     return path.join(this.rootPath, dirnames.downloads)
//   }

//   getPackagesPath() {
//     return path.join(this.rootPath, dirnames.packages)
//   }

//   getProfilesPath() {
//     return path.join(this.rootPath, dirnames.profiles)
//   }

//   async load(
//     onProgressData: (data: Partial<ApplicationData>) => void,
//     onProgressStatus: (status: string | null) => void,
//   ): Promise<void> {
//     await fs.mkdir(this.rootPath, { recursive: true })

//     const databaseUpdatePromise = this.tryUpdateDatabase()

//     // Load settings
//     onProgressStatus("Loading settings...")
//     const settings = await this.loadSettings()
//     this.data.settings = settings

//     // Load profiles
//     onProgressStatus("Loading profiles...")
//     const profiles = await this.loadProfiles()
//     this.data.profiles = profiles

//     // Check that current profile exists and fixes if not
//     let currentProfile: ProfileInfo | undefined
//     if (settings.currentProfile) {
//       currentProfile = profiles[settings.currentProfile]
//       if (!currentProfile) {
//         currentProfile = Object.values(profiles)[0]
//         settings.currentProfile = currentProfile.id
//         await this.writeSettings(settings)
//       }
//     } else {
//       currentProfile = Object.values(profiles)[0]
//       if (currentProfile) {
//         settings.currentProfile = currentProfile.id
//         await this.writeSettings(settings)
//       }
//     }

//     onProgressData({ profiles, settings })

//     // Load local packages
//     onProgressStatus("Loading packages...")
//     const localPackages = await loadLocalPackages()
//     this.data.packages = localPackages
//     onProgressData({ packages: localPackages })

//     // Wait for database update to finish
//     onProgressStatus("Updating database...")
//     await databaseUpdatePromise

//     // Load remote packages
//     onProgressStatus("Loading packages...")
//     const { assets: remoteAssets, packages: remotePackages } = await loadRemotePackages()
//     this.data.assets = remoteAssets
//     this.data.packages = remotePackages
//     for (const packageId in localPackages) {
//       const localPackage = localPackages[packageId]
//       if (localPackage) {
//         const remotePackage = (remotePackages[packageId] ??= localPackage)

//         for (const variantId in localPackage.variants) {
//           const localVariant = localPackage.variants[variantId]
//           if (localVariant) {
//             const remoteVariant = remotePackage.variants[variantId]
//             if (remoteVariant) {
//               remoteVariant.installed = localVariant.version
//             } else {
//               remotePackage.variants[variantId] = {
//                 ...localVariant,
//                 installed: localVariant.version,
//                 local: true,
//               }
//             }
//           }
//         }
//       }
//     }

//     onProgressData({ assets: remoteAssets, packages: remotePackages })

//     if (currentProfile) {
//       onProgressStatus("Resolving dependencies...")

//       const enabledPackages = new Map<string, PackageStatus>()
//       for (const packageId in currentProfile.packageConfig) {
//         if (remotePackages[packageId]) {
//           const config = currentProfile.packageConfig[packageId]
//           if (config?.enabled) {
//             enabledPackages.set(packageId, {
//               dependency: false,
//               enabled: true,
//               requiredBy: [],
//               variant: config.variant ?? Object.keys(remotePackages[packageId]!.variants)[0],
//             })
//           }
//         } else {
//           console.warn(`Unknown package '${packageId}'`)
//         }
//       }

//       enabledPackages.forEach(({ variant }, packageId) => {
//         const packageInfo = remotePackages[packageId]
//         const variantInfo = packageInfo.variants[variant]
//         variantInfo?.dependencies?.forEach(dependencyId => {
//           let dependencyPackageInfo = enabledPackages.get(dependencyId)
//           if (dependencyPackageInfo) {
//             dependencyPackageInfo.enabled = true
//             dependencyPackageInfo.requiredBy.push(packageId)
//           } else {
//             dependencyPackageInfo = {
//               dependency: true,
//               enabled: true,
//               requiredBy: [packageId],
//               variant: Object.keys(remotePackages[dependencyId]!.variants)[0],
//             }

//             enabledPackages.set(dependencyId, dependencyPackageInfo)
//             currentProfile.packageStatus[dependencyId] = dependencyPackageInfo
//           }
//         })
//       })

//       onProgressData({ profiles: { [currentProfile.id]: currentProfile } })
//     }

//     onProgressStatus(null)
//   }

//   protected async loadProfiles(): Promise<{ [profileId: string]: ProfileInfo }> {
//     console.debug("Loading profiles...")

//     let nProfiles = 0
//     const profiles: { [profileId: string]: ProfileInfo } = {}

//     const profilesPath = this.getProfilesPath()
//     await fs.mkdir(profilesPath, { recursive: true })

//     const entries = await fs.readdir(profilesPath, { withFileTypes: true })
//     for (const entry of entries) {
//       const format = path.extname(entry.name)
//       if (entry.isFile() && formats.includes(format)) {
//         const profileId = path.basename(entry.name, format)
//         const profilePath = path.join(profilesPath, entry.name)

//         try {
//           const profileConfig = await this.readConfig(profilePath)
//           assert(isObject(profileConfig), "Not an object")

//           const profileInfo: ProfileInfo = {
//             id: profileId,
//             name: profileId,
//             packageConfig: {},
//             packageStatus: {},
//           }

//           if (isString(profileConfig.name)) {
//             profileInfo.name = profileConfig.name
//           }

//           if (isObject(profileConfig.packages)) {
//             for (const packageId in profileConfig.packages) {
//               if (!parsePackageId(packageId)) {
//                 console.warn(`Invalid package ID '${packageId}'`)
//                 continue
//               }

//               const packageConfig = profileConfig.packages[packageId]
//               if (isBoolean(packageConfig)) {
//                 profileInfo.packageConfig[packageId] = {
//                   enabled: packageConfig,
//                 }
//               } else if (isObject(packageConfig)) {
//                 const config: PackageConfig = {
//                   enabled: true,
//                 }

//                 if (isBoolean(packageConfig.enabled)) {
//                   config.enabled = packageConfig.enabled
//                 }

//                 if (isString(packageConfig.variant)) {
//                   config.variant = packageConfig.variant
//                 }

//                 profileInfo.packageConfig[packageId] = config
//               } else if (packageConfig !== null) {
//                 console.warn(`Invalid package configuration for '${packageId}'`)
//               }
//             }
//           }

//           profiles[profileId] = profileInfo
//           nProfiles++
//         } catch (error) {
//           console.warn(`Invalid profile configuration '${entry.name}'`, error)
//         }
//       } else {
//         console.warn(`Unsupported file '${entry.name}' inside ${dirnames.profiles} folder`)
//       }
//     }

//     console.debug(`Loaded ${nProfiles} profiles`)

//     return profiles
//   }

//   protected async loadSettings(): Promise<Settings> {
//     console.debug("Loading settings...")

//     const config = await this.loadConfig(this.rootPath, filenames.settings)

//     const settings: Settings = {
//       useYaml: this.defaultFormat !== ConfigFormat.JSON,
//     }

//     if (!isObject(config?.data)) {
//       await this.writeConfig(this.rootPath, filenames.settings, settings)
//       return settings
//     }

//     if (isString(config.data.currentProfile)) {
//       settings.currentProfile = config.data.currentProfile
//     }

//     if (isBoolean(config.data.useYaml)) {
//       settings.useYaml = config.data.useYaml
//     }

//     console.debug("Loaded settings")

//     return settings
//   }

//   async writeProfile(profile: ProfileInfo): Promise<void> {
//     console.debug(`Saving profile ${profile.id}...`)

//     await this.writeConfig<ProfileData>(this.getProfilesPath(), profile.id, {
//       name: profile.name,
//       packages: profile.packageConfig,
//     })

//     console.debug(`Saved profile ${profile.id}`)
//   }

//   async writeSettings(settings: Settings): Promise<void> {
//     console.debug("Saving settings...")

//     await this.writeConfig<RawSettings>(this.rootPath, filenames.settings, {
//       currentProfile: settings.currentProfile,
//       useYaml: settings.useYaml ? true : undefined,
//     })

//     console.debug("Saved settings")
//   }

//   protected async loadConfig(
//     directory: string,
//     basename: string,
//   ): Promise<{ data: unknown; format: string } | null> {
//     for (const format of formats) {
//       const fullPath = path.join(directory, basename + format)
//       try {
//         const data = await this.readConfig(fullPath)
//         return { data, format }
//       } catch (error) {
//         console.debug(error)
//       }
//     }

//     return null
//   }

//   protected async readConfig(fullPath: string): Promise<unknown> {
//     const raw = await fs.readFile(fullPath, "utf8")
//     return fullPath.endsWith(ConfigFormat.JSON) ? JSON.parse(raw) : yamlParse(raw)
//   }

//   protected async writeConfig<T>(
//     directory: string,
//     basename: string,
//     data: T,
//     format: string = this.defaultFormat,
//   ): Promise<void> {
//     const fullPath = path.join(directory, basename + format)
//     const raw =
//       format === ConfigFormat.JSON ? JSON.stringify(data, undefined, 2) : yamlStringify(data)
//     await fs.writeFile(fullPath, raw, "utf8")
//   }

//   protected async tryUpdateDatabase(force?: boolean): Promise<boolean> {
//     if (!this.databaseUpdatePromise || force) {
//       this.databaseUpdatePromise = new Promise(resolve => {
//         console.log("Updating database...")
//         createChildProcess<unknown, { success?: boolean; error?: Error }>(childProcessPath, {
//           onClose() {
//             console.log("Failed updating database:", "closed")
//             resolve(false)
//           },
//           onMessage({ success, error }) {
//             if (success) {
//               console.log("Updated database")
//               resolve(true)
//             } else {
//               console.log("Failed updating database:", error)
//               resolve(false)
//             }
//           },
//         })
//       })
//     }

//     return this.databaseUpdatePromise
//   }
// }

// export type RawSettings = Settings
