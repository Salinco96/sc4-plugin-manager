import update, { Spec } from "immutability-helper"
import { SnackbarKey, enqueueSnackbar, closeSnackbar } from "notistack"
import { create } from "zustand"

import { ModalData, ModalID } from "@common/modals"
import { ProfileUpdate } from "@common/profiles"
import { ApplicationState, ApplicationStatus } from "@common/state"
import {
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
  experimental: boolean
  incompatible: boolean
  onlyErrors: boolean
  onlyUpdates: boolean
  search: string
  state: PackageState | null
}

export interface StoreActions {
  addPackage(packageId: string, variantId: string): Promise<boolean>
  check4GBPatch(): Promise<void>
  closeSnackbar(type: SnackbarType): void
  createProfile(name: string, templateProfileId?: string): Promise<boolean>
  disablePackage(packageId: string): Promise<boolean>
  editProfile(profileId: string, data: ProfileUpdate): Promise<boolean>
  enablePackage(packageId: string): Promise<boolean>
  getPackageDocsAsHtml(packageId: string, variantId: string): Promise<string>
  installPackage(packageId: string, variantId: string): Promise<boolean>
  openExecutableDirectory(): Promise<void>
  openInstallationDirectory(): Promise<void>
  openPackageFileInExplorer(packageId: string, variantId: string, filePath: string): Promise<void>
  openProfileConfig(profileId: string): Promise<void>
  openSnackbar<T extends SnackbarType>(type: T, props: SnackbarProps<T>): void
  removePackage(packageId: string, variantId: string): Promise<boolean>
  setPackageVariant(packageId: string, variantId: string): Promise<boolean>
  setPackageFilters(filters: Partial<PackageFilters>): void
  showErrorToast(message: string): void
  showModal<T extends ModalID>(id: T, data: ModalData<T>): Promise<boolean>
  simtropolisLogin(): Promise<void>
  simtropolisLogout(): Promise<void>
  switchProfile(profileId: string): Promise<boolean>
  updatePackage(packageId: string): Promise<boolean>
  updateState(update: Partial<ApplicationState>): void
}

export interface Store {
  actions: StoreActions
  modal?: {
    action: (result: boolean) => void
    data: ModalData<ModalID>
    id: ModalID
  }
  packageFilters: PackageFilters
  packages?: {
    [packageId: string]: PackageInfo
  }
  profiles?: {
    [profileId: string]: ProfileInfo
  }
  sessions: {
    simtropolis: {
      userId?: string | null
    }
  }
  settings?: Settings
  snackbars: {
    [type in SnackbarType]?: SnackbarKey
  }
  status: ApplicationStatus
}

export const useStore = create<Store>()((set, get): Store => {
  function updateState(data: Spec<Store>): void {
    set(store => update(store, data))
  }

  return {
    actions: {
      async addPackage(packageId, variantId) {
        const profileId = get().settings?.currentProfile
        const packageInfo = get().packages?.[packageId]
        if (!packageInfo || !profileId) {
          return false
        }

        try {
          return await window.api.updatePackages(profileId, {
            [packageId]: { enabled: true, variant: variantId },
          })
        } catch (error) {
          console.error(`Failed to add ${packageId}`, error)
          this.showErrorToast(`Failed to add ${packageId}`)
          return false
        }
      },
      async check4GBPatch() {
        return window.api.check4GBPatch()
      },
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
      async disablePackage(packageId) {
        const profileId = get().settings?.currentProfile
        const packageInfo = get().packages?.[packageId]
        if (!packageInfo || !profileId) {
          return false
        }

        try {
          return await window.api.updatePackages(profileId, {
            [packageId]: { enabled: false },
          })
        } catch (error) {
          console.error(`Failed to disable ${packageId}`, error)
          this.showErrorToast(`Failed to disable ${packageId}`)
          return false
        }
      },
      async editProfile(profileId, data) {
        return window.api.editProfile(profileId, data)
      },
      async enablePackage(packageId) {
        const profileId = get().settings?.currentProfile
        const packageInfo = get().packages?.[packageId]
        if (!packageInfo || !profileId) {
          return false
        }

        try {
          return await window.api.updatePackages(profileId, {
            [packageId]: { enabled: true },
          })
        } catch (error) {
          console.error(`Failed to enable ${packageId}`, error)
          this.showErrorToast(`Failed to enable ${packageId}`)
          return false
        }
      },
      async getPackageDocsAsHtml(packageId, variantId) {
        return window.api.getPackageDocsAsHtml(packageId, variantId)
      },
      async installPackage(packageId, variantId) {
        try {
          return await window.api.installPackages({ [packageId]: variantId })
        } catch (error) {
          console.error(`Failed to install ${packageId}`, error)
          this.showErrorToast(`Failed to install ${packageId}`)
          return false
        }
      },
      async openInstallationDirectory() {
        return window.api.openInstallationDirectory()
      },
      async openExecutableDirectory() {
        return window.api.openExecutableDirectory()
      },
      async openPackageFileInExplorer(packageId, variantId, filePath) {
        return window.api.openPackageFileInExplorer(packageId, variantId, filePath)
      },
      async openProfileConfig(profileId) {
        return window.api.openProfileConfig(profileId)
      },
      openSnackbar(type, props) {
        if (get().snackbars[type] === undefined) {
          const id = enqueueSnackbar({ persist: true, variant: type, ...props })
          updateState({ snackbars: { [type]: { $set: id } } })
        }
      },
      async removePackage(packageId, variantId) {
        try {
          return await window.api.removePackages({ [packageId]: variantId })
        } catch (error) {
          console.error(`Failed to remove ${packageId}`, error)
          this.showErrorToast(`Failed to remove ${packageId}`)
          return false
        }
      },
      setPackageFilters(filters) {
        updateState({ packageFilters: { $merge: filters } })
      },
      async setPackageVariant(packageId, variantId) {
        const profileId = get().settings?.currentProfile
        const variantInfo = get().packages?.[packageId]?.variants[variantId]
        if (!profileId || !variantInfo) {
          return false
        }

        try {
          return await window.api.updatePackages(profileId, {
            [packageId]: { variant: variantId },
          })
        } catch (error) {
          console.error(`Failed to select variant ${packageId}#${variantId}`, error)
          this.showErrorToast(`Failed to select variant ${packageId}#${variantId}`)
          return false
        }
      },
      showErrorToast(message) {
        enqueueSnackbar(message, { variant: "error" })
      },
      async showModal(id, data) {
        try {
          const result = await new Promise<boolean>(resolve => {
            set({ modal: { action: resolve, data, id } })
          })
          return result
        } catch (error) {
          console.error(error)
          return false
        } finally {
          set({ modal: undefined })
        }
      },
      async simtropolisLogin(): Promise<void> {
        updateState({ sessions: { simtropolis: { $set: {} } } })
        return window.api.simtropolisLogin()
      },
      async simtropolisLogout(): Promise<void> {
        updateState({ sessions: { simtropolis: { $set: {} } } })
        return window.api.simtropolisLogout()
      },
      async switchProfile(profileId) {
        return window.api.switchProfile(profileId)
      },
      async updatePackage(packageId) {
        const profileId = get().settings?.currentProfile
        const packageInfo = get().packages?.[packageId]
        if (!packageInfo || !profileId) {
          return false
        }

        const variantId = packageInfo.status[profileId]?.variantId
        if (!variantId) {
          return false
        }

        try {
          return await window.api.installPackages({ [packageId]: variantId })
        } catch (error) {
          console.error(`Failed to update ${packageId}`, error)
          this.showErrorToast(`Failed to update ${packageId}`)
          return false
        }
      },
      updateState(data) {
        console.info("Update state", data)

        if (data.packages) {
          updateState({
            packages: packages =>
              Object.entries(data.packages!).reduce(
                (packages, [id, info]) => {
                  if (info) {
                    packages[id] = info
                  } else {
                    delete packages[id]
                  }

                  return packages
                },
                {
                  ...packages,
                },
              ),
          })
        }

        if (data.profiles) {
          updateState({
            profiles: profiles =>
              Object.entries(data.profiles!).reduce(
                (profiles, [id, info]) => {
                  if (info) {
                    profiles[id] = info
                  } else {
                    delete profiles[id]
                  }

                  return profiles
                },
                {
                  ...profiles,
                },
              ),
          })
        }

        if (data.sessions) {
          updateState({ sessions: sessions => ({ ...sessions, ...data.sessions }) })
        }

        if (data.settings) {
          updateState({ settings: { $set: data.settings } })
        }

        if (data.status) {
          updateState({ status: { $set: data.status } })
        }
      },
    },
    packageFilters: {
      categories: [],
      dependencies: true,
      experimental: true,
      incompatible: true,
      onlyErrors: false,
      onlyUpdates: false,
      search: "",
      state: null,
    },
    sessions: {
      simtropolis: {},
    },
    status: {
      linker: null,
      loader: null,
      ongoingDownloads: [],
      ongoingExtracts: [],
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
  return useStore(store => {
    const currentProfile = getCurrentProfile(store)
    return currentProfile && store.packages?.[packageId]?.status[currentProfile.id]
  })
}
