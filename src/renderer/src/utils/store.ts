import update, { Spec } from "immutability-helper"
import { SnackbarKey, enqueueSnackbar, closeSnackbar } from "notistack"
import { create } from "zustand"

import { ProfileUpdate } from "@common/profiles"
import { ApplicationState } from "@common/state"
import {
  AssetInfo,
  PackageCategory,
  PackageInfo,
  PackageState,
  ProfileInfo,
  PackageStatus,
  Settings,
} from "@common/types"
import { SnackbarProps, SnackbarType } from "@renderer/providers/SnackbarProvider"

export interface PackageFilters {
  categories: PackageCategory[]
  dependencies: boolean
  incompatible: boolean
  onlyErrors: boolean
  onlyUpdates: boolean
  search: string
  state: PackageState | null
  // states: PackageState[]
}

export interface StoreActions {
  closeSnackbar(type: SnackbarType): void
  createProfile(name: string, templateProfileId?: string): Promise<boolean>
  disablePackages(packageIds: string[]): Promise<boolean>
  editProfile(profileId: string, data: ProfileUpdate): Promise<boolean>
  enablePackages(packageIds: string[]): Promise<boolean>
  installPackages(packageIds: string[]): Promise<boolean>
  getPackageDocsAsHtml(packageId: string): Promise<string>
  openPackageFileInExplorer(packageId: string, variantId: string, filePath: string): Promise<void>
  openSnackbar<T extends SnackbarType>(type: T, props: SnackbarProps<T>): void
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
  ongoingExtracts: string[]
  packageFilters: PackageFilters
  packageGroups?: {
    [groupId: string]: string[]
  }
  packages?: {
    [packageId: string]: PackageInfo
  }
  profiles?: {
    [profileId: string]: ProfileInfo
  }
  settings?: Settings
  snackbars: {
    [type in SnackbarType]?: SnackbarKey
  }
}

export const useStore = create<Store>()((set, get): Store => {
  function updateState(data: Spec<Store>): void {
    set(store => update(store, data))
  }

  return {
    actions: {
      closeSnackbar(type) {
        const id = get().snackbars[type]
        if (id !== undefined) {
          closeSnackbar(id)
          updateState({ snackbars: { $unset: [type] } })
        }
      },
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
      async getPackageDocsAsHtml(packageId) {
        return window.api.getPackageDocsAsHtml(packageId)
      },
      async installPackages(packageIds) {
        return window.api.installPackages(packageIds)
      },
      async openPackageFileInExplorer(packageId, variantId, filePath) {
        return window.api.openPackageFileInExplorer(packageId, variantId, filePath)
      },
      openSnackbar(type, props) {
        if (get().snackbars[type] === undefined) {
          const id = enqueueSnackbar({ persist: true, variant: type, ...props })
          updateState({ snackbars: { [type]: { $set: id } } })
        }
      },
      async removePackages(packageIds) {
        return window.api.removePackages(packageIds)
      },
      setPackageFilters(filters) {
        updateState({ packageFilters: { $merge: filters } })
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
        console.debug("Update state", data)

        if (data.loadStatus !== undefined) {
          updateState({ loadStatus: { $set: data.loadStatus } })
        }

        if (data.ongoingDownloads) {
          updateState({ ongoingDownloads: { $set: data.ongoingDownloads } })
        }

        if (data.ongoingExtracts) {
          updateState({ ongoingExtracts: { $set: data.ongoingExtracts } })
        }

        if (data.packageGroups) {
          updateState({ packageGroups: { $set: data.packageGroups } })
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
    ongoingExtracts: [],
    packageFilters: {
      categories: [],
      dependencies: false,
      incompatible: false,
      onlyErrors: false,
      onlyUpdates: false,
      search: "",
      state: null,
    },
    snackbars: {},
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
