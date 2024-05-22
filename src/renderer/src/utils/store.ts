import update, { Spec } from "immutability-helper"
// import { enqueueSnackbar } from "notistack"
import { create } from "zustand"

import { ApplicationState, initialState } from "@common/state"
import {
  AssetInfo,
  PackageCategory,
  PackageInfo,
  PackageState,
  ProfileInfo,
  PackageStatus,
  Settings,
} from "@common/types"

export interface PackageFilters {
  categories: PackageCategory[]
  search: string
  states: PackageState[]
}

export interface StoreActions {
  createProfile(name: string, templateProfileId?: string): Promise<boolean>
  disablePackages(packageIds: string[]): Promise<boolean>
  editProfile(
    profileId: string,
    data: { name?: string; settings?: { cam?: boolean; darknite?: boolean } },
  ): Promise<boolean>
  enablePackages(packageIds: string[]): Promise<boolean>
  installPackages(packageIds: string[]): Promise<boolean>
  openPackageFileInExplorer(packageId: string, variantId: string, filePath: string): Promise<void>
  removePackages(packageIds: string[]): Promise<boolean>
  setPackageVariant(packageId: string, variantId: string): Promise<boolean>
  setPackageFilters(filters: Partial<PackageFilters>): void
  showModal(
    id: "missing-packages",
    data: {
      packageIds: string[]
    },
  ): Promise<boolean>
  switchProfile(profileId: string): Promise<boolean>
  updateState(update: Partial<ApplicationState>): void
}

export interface Store {
  actions: StoreActions
  assets?: { [id: string]: AssetInfo }
  loadStatus: string | null
  modal?: {
    action: (result: boolean) => void
    data: {
      packageIds: string[]
    }
    id: "missing-packages"
  }
  ongoingDownloads: string[]
  packageFilters: PackageFilters
  packages?: {
    [packageId: string]: PackageInfo
  }
  profiles?: {
    [profileId: string]: ProfileInfo
  }
  settings?: Settings
}

export const useStore = create<Store>()(set => {
  function updateState(data: Spec<Store>): void {
    set(store => update(store, data))
  }

  return {
    actions: {
      async createProfile(name, templateProfileId) {
        return window.api.createProfile(name, templateProfileId)
      },
      async disablePackages(packageIds) {
        return window.api.disablePackages(packageIds)
      },
      async editProfile(profileId, data) {
        return window.api.editProfile(profileId, data)
      },
      async enablePackages(packageIds) {
        return window.api.enablePackages(packageIds)
      },
      async installPackages(packageIds) {
        return window.api.installPackages(packageIds)
      },
      async openPackageFileInExplorer(packageId, variantId, filePath): Promise<void> {
        return window.api.openPackageFileInExplorer(packageId, variantId, filePath)
      },
      async removePackages(packageIds) {
        return window.api.removePackages(packageIds)
      },
      setPackageFilters(filters) {
        set(store => ({ packageFilters: { ...store.packageFilters, ...filters } }))
      },
      async setPackageVariant(packageId, variantId) {
        return window.api.setPackageVariant(packageId, variantId)
      },
      async showModal(_id, _data) {
        return true
      },
      async switchProfile(profileId) {
        return window.api.switchProfile(profileId)
      },
      updateState(data) {
        if (data.loadStatus !== undefined) {
          updateState({ loadStatus: { $set: data.loadStatus } })
        }

        if (data.ongoingDownloads) {
          updateState({ ongoingDownloads: { $set: data.ongoingDownloads } })
        }

        if (data.packages) {
          updateState({ packages: packages => ({ ...packages, ...data.packages }) })
        }

        if (data.profiles) {
          updateState({ profiles: profiles => ({ ...profiles, ...data.profiles }) })
        }

        if (data.settings) {
          updateState({ settings: { $set: data.settings } })
        }
      },
      // async enablePackages(packageIds) {
      //   const store = get()
      //   const currentProfile = getCurrentProfile(store)
      //   if (!currentProfile) {
      //     return
      //   }

      //   const explicitPackages = new Map<string, PackageConfig>()

      //   const enabledPackages = new Map<
      //     string,
      //     {
      //       explicit: boolean
      //       requiredBy: string[]
      //     }
      //   >()

      //   const missingPackages = new Set<string>()
      //   for (const packageId of packageIds) {
      //     const config = currentProfile.packages?.[packageId]
      //     const status = store.packageStatus?.[packageId]
      //     if (status && !config?.enabled) {
      //       explicitPackages.set(packageId, {
      //         enabled: true,
      //         variant: status.variant,
      //       })

      //       enabledPackages.set(packageId, {
      //         explicit: true,
      //         requiredBy: [],
      //       })
      //     }
      //   }

      //   enabledPackages.forEach((data, packageId) => {
      //     const config = currentProfile.packages?.[packageId]
      //     const info = store.packages?.[packageId]
      //     const status = store.packageStatus?.[packageId]
      //     if (info && status && !config?.enabled) {
      //       const variant = info.variants[status.variant]
      //       if (variant) {
      //         if (!variant.installed) {
      //           missingPackages.add(packageId)
      //         }

      //         for (const dependencyId of variant.dependencies) {
      //           const dependencyStatus = enabledPackages.get(dependencyId)
      //           if (dependencyStatus) {
      //             dependencyStatus.requiredBy.push(dependencyId)
      //           } else {
      //             enabledPackages.set(dependencyId, {
      //               explicit: false,
      //               requiredBy: [dependencyId],
      //             })
      //           }
      //         }
      //       }
      //     }
      //   })

      //   if (missingPackages.size) {
      //     console.error("Missing packages:", missingPackages)
      //   }

      //   if (explicitPackages.size) {
      //     this.editCurrentProfile({
      //       packages: {
      //         $merge: Array.from(explicitPackages).reduce(
      //           (result, [id, config]) => {
      //             result[id] = config
      //             return result
      //           },
      //           {} as { [id: string]: PackageConfig },
      //         ),
      //       },
      //     })
      //   }

      //   if (enabledPackages.size) {
      //     updateState({
      //       packageStatus: Array.from(enabledPackages).reduce(
      //         (result, [id, spec]) => {
      //           result[id] = {
      //             enabled: { $set: true },
      //             explicit: explicit => explicit || spec.explicit,
      //             requiredBy: { $push: spec.requiredBy },
      //           }
      //           return result
      //         },
      //         {} as { [id: string]: Spec<PackageStatus> },
      //       ),
      //     })
      //   }
      // },
      // async enablePackage(packageId) {
      //   const store = get()
      //   const profile = getCurrentProfile(store)
      //   const info = store.packages?.[packageId]
      //   if (profile && info) {
      //     const missingPackageIds = new Set<string>()
      //     const dependencies = new Map<string, PackageStatus>()
      //     dependencies.set(packageId, {
      //       requiredBy: [],
      //       variant: Object.keys(info.variants)[0],
      //       ...profile.packageStatus[packageId],
      //       dependency: false,
      //       enabled: true,
      //     })
      //     dependencies.forEach(({ variant }, id) => {
      //       const info = store.packages?.[id]?.variants[variant]
      //       if (!info?.installed) {
      //         missingPackageIds.add(id)
      //       }
      //       if (!profile.packageStatus[id]?.enabled) {
      //         info?.dependencies?.forEach(dependencyId => {
      //           const dependencyInfo = store.packages?.[dependencyId]
      //           if (dependencyInfo) {
      //             const current = profile.packageStatus[dependencyId]
      //             if (current) {
      //               dependencies.set(dependencyId, {
      //                 ...current,
      //                 enabled: true,
      //                 requiredBy: current.requiredBy.concat(id),
      //               })
      //             } else {
      //               dependencies.set(dependencyId, {
      //                 dependency: true,
      //                 enabled: true,
      //                 requiredBy: [id],
      //                 variant: Object.keys(dependencyInfo.variants)[0],
      //               })
      //             }
      //           } else {
      //             missingPackageIds.add(dependencyId)
      //           }
      //         })
      //       }
      //     })
      //     console.log("Missing:", missingPackageIds)
      //     console.log("Dependencies:", dependencies)
      //     if (missingPackageIds.size) {
      //       const confirmed = await this.showModal("missing-packages", {
      //         packageIds: Array.from(missingPackageIds),
      //       })
      //       console.log(confirmed)
      //       if (!confirmed) {
      //         return
      //       }
      //       for (const missingPackageId of missingPackageIds) {
      //         await this.installPackage(missingPackageId)
      //       }
      //     }
      //     if (dependencies.size) {
      //       await this.editProfile(profile.id, {
      //         packageStatus: Array.from(dependencies).reduce(
      //           (packages, [id, info]) => {
      //             packages[id] = info
      //             return packages
      //           },
      //           {
      //             ...profile.packageStatus,
      //           },
      //         ),
      //       })
      //     }
      //   }
      // },
      // async createProfile(data) {
      //   const { profiles } = get()
      //   if (profiles) {
      //     set({ profiles: { [data.id]: data } })
      //     await window.api.writeProfile(data)
      //     await this.switchProfile(data.id)
      //   }
      // },
      // async showModal(id, data) {
      //   try {
      //     const result = await new Promise<boolean>(resolve => {
      //       set({ modal: { action: resolve, data, id } })
      //     })
      //     return result
      //   } catch (error) {
      //     console.error(error)
      //     return false
      //   } finally {
      //     set({ modal: undefined })
      //   }
      // },
    },
    loadStatus: null,
    ongoingDownloads: [],
    packageFilters: {
      categories: [],
      search: "",
      states: [],
    },
    packageStatus: {},
    state: initialState,
  }
})

export function getStoreActions(store: Store): StoreActions {
  return store.actions
}

export function useStoreActions(): StoreActions {
  return useStore(getStoreActions)
}

export function getCurrentProfile(store: Store): ProfileInfo | undefined {
  const profileId = store.settings?.currentProfile
  return profileId ? store.profiles?.[profileId] : undefined
}

export function useCurrentProfile(): ProfileInfo | undefined {
  return useStore(getCurrentProfile)
}

export function usePackageFilters(): PackageFilters | undefined {
  return useStore(store => store.packageFilters)
}

export function usePackageInfo(packageId: string): PackageInfo | undefined {
  return useStore(store => store.packages?.[packageId])
}

export function usePackageStatus(packageId: string): PackageStatus | undefined {
  return useStore(store => store.packages?.[packageId]?.status)
}
