import update, { Spec } from "immutability-helper"
import { SnackbarKey, closeSnackbar, enqueueSnackbar } from "notistack"
import { create } from "zustand"

import { PackageCategory } from "@common/categories"
import { ModalData, ModalID } from "@common/modals"
import { ProfileUpdate } from "@common/profiles"
import { ApplicationState, ApplicationStatus } from "@common/state"
import {
  Feature,
  OptionInfo,
  OptionValue,
  PackageInfo,
  PackageState,
  ProfileInfo,
  Settings,
} from "@common/types"
import { compact } from "@common/utils/objects"

import { computePackageList, getPackageListItemSize } from "./packages"
import { SnackbarProps, SnackbarType } from "./snackbar"

export interface PackageUi {
  itemSize: number
  variantId: string
  variantIds: string[]
}

export interface PackageFilters {
  authors: string[]
  categories: PackageCategory[]
  dependencies: boolean
  experimental: boolean
  incompatible: boolean
  onlyErrors: boolean
  onlyUpdates: boolean
  search: string
  state: PackageState | null
  states: PackageState[]
}

export interface StoreActions {
  addPackage(packageId: string, variantId: string, data?: ProfileUpdate): Promise<boolean>
  check4GBPatch(): Promise<void>
  cleanVariant(packageId: string, variantId: string): Promise<void>
  closeSnackbar(type: SnackbarType): void
  createProfile(name: string, templateProfileId?: string): Promise<boolean>
  disablePackage(packageId: string): Promise<boolean>
  enablePackage(packageId: string): Promise<boolean>
  getPackageReadme(packageId: string, variantId: string): Promise<{ html?: string; md?: string }>
  installPackage(packageId: string, variantId: string): Promise<boolean>
  openExecutableDirectory(): Promise<boolean>
  openInstallationDirectory(): Promise<boolean>
  openPackageConfig(packageId: string): Promise<boolean>
  openPackageFile(packageId: string, variantId: string, filePath: string): Promise<boolean>
  openProfileConfig(profileId: string): Promise<boolean>
  openSnackbar<T extends SnackbarType>(type: T, props: SnackbarProps<T>): void
  openVariantRepository(packageId: string, variantId: string): Promise<boolean>
  openVariantURL(packageId: string, variantId: string): Promise<boolean>
  removePackage(packageId: string, variantId: string): Promise<boolean>
  resetState(): void
  setPackageOption(
    packageId: string,
    optionId: string,
    optionValue: OptionValue | ReadonlyArray<OptionValue>,
  ): Promise<boolean>
  setPackageVariant(packageId: string, variantId: string): Promise<boolean>
  setPackageFilters(filters: Partial<PackageFilters>): void
  setProfileOption(
    optionId: string,
    optionValue: OptionValue | ReadonlyArray<OptionValue>,
  ): Promise<boolean>
  showErrorToast(message: string): void
  showModal<T extends ModalID>(id: T, data: ModalData<T>): Promise<boolean>
  showSuccessToast(message: string): void
  simtropolisLogin(): Promise<void>
  simtropolisLogout(): Promise<void>
  switchProfile(profileId: string): Promise<boolean>
  updatePackage(packageId: string, variantId: string): Promise<boolean>
  updateProfile(profileId: string, data: ProfileUpdate): Promise<boolean>
  updateState(update: Partial<ApplicationState>): void
}

export interface Store {
  actions: StoreActions
  authors: string[]
  features: Partial<Record<Feature, string[]>>
  modal?: {
    action: (result: boolean) => void
    data: ModalData<ModalID>
    id: ModalID
  }
  options?: OptionInfo[]
  packageFilters: PackageFilters
  filteredPackages: string[]
  packageUi: {
    [packageId: string]: PackageUi
  }
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
      async addPackage(packageId, variantId, data) {
        const profileId = get().settings?.currentProfile
        if (!profileId) {
          return false
        }

        try {
          return await window.api.updateProfile(profileId, {
            ...data,
            packages: {
              ...data?.packages,
              [packageId]: { enabled: true, variant: variantId },
            },
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
      async cleanVariant(packageId, variantId) {
        await window.api.cleanVariant(packageId, variantId)
        this.showSuccessToast("No conflicting files detected")
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
        if (!profileId) {
          return false
        }

        try {
          return await window.api.updateProfile(profileId, {
            packages: {
              [packageId]: { enabled: false },
            },
          })
        } catch (error) {
          console.error(`Failed to disable ${packageId}`, error)
          this.showErrorToast(`Failed to disable ${packageId}`)
          return false
        }
      },
      async enablePackage(packageId) {
        const profileId = get().settings?.currentProfile
        if (!profileId) {
          return false
        }

        try {
          return await window.api.updateProfile(profileId, {
            packages: {
              [packageId]: { enabled: true },
            },
          })
        } catch (error) {
          console.error(`Failed to enable ${packageId}`, error)
          this.showErrorToast(`Failed to enable ${packageId}`)
          return false
        }
      },
      async getPackageReadme(packageId, variantId) {
        return window.api.getPackageReadme(packageId, variantId)
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
      async openPackageConfig(packageId) {
        return window.api.openPackageConfig(packageId)
      },
      async openPackageFile(packageId, variantId, filePath) {
        return window.api.openPackageFile(packageId, variantId, filePath)
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
      async openVariantRepository(packageId, variantId) {
        return window.api.openVariantRepository(packageId, variantId)
      },
      async openVariantURL(packageId, variantId) {
        return window.api.openVariantURL(packageId, variantId)
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
      resetState() {
        console.debug("Reset state")

        updateState({
          $merge: {
            authors: [],
            features: {},
            filteredPackages: [],
            options: undefined,
            packageUi: {},
            packages: undefined,
            profiles: undefined,
            sessions: {
              simtropolis: {},
            },
            settings: undefined,
            status: {
              linker: null,
              loader: null,
              ongoingDownloads: [],
              ongoingExtracts: [],
            },
          },
        })
      },
      setPackageFilters(filters) {
        set(store => {
          const packageFilters = { ...store.packageFilters, ...filters }
          return { packageFilters, ...computePackageList({ ...store, packageFilters }, true) }
        })
      },
      async setPackageOption(packageId, optionId, optionValue) {
        const store = get()
        const profileInfo = getCurrentProfile(store)
        if (!profileInfo) {
          return false
        }

        try {
          return await window.api.updateProfile(profileInfo.id, {
            packages: {
              [packageId]: { options: { [optionId]: optionValue } },
            },
          })
        } catch (error) {
          console.error(`Failed to change option ${packageId}#${optionId}`, error)
          this.showErrorToast(`Failed to change option ${packageId}#${optionId}`)
          return false
        }
      },
      async setPackageVariant(packageId, variantId) {
        const store = get()
        const packageInfo = getPackageInfo(store, packageId)
        const profileInfo = getCurrentProfile(store)
        const variantInfo = packageInfo?.variants[variantId]
        if (!packageInfo || !variantInfo) {
          return false
        }

        if (!profileInfo) {
          updateState({
            packageUi: {
              [packageId]: {
                $merge: {
                  itemSize: getPackageListItemSize(variantInfo),
                  variantId,
                },
              },
            },
          })

          return true
        }

        try {
          return await window.api.updateProfile(profileInfo.id, {
            packages: {
              [packageId]: { variant: variantId },
            },
          })
        } catch (error) {
          console.error(`Failed to select variant ${packageId}#${variantId}`, error)
          this.showErrorToast(`Failed to select variant ${packageId}#${variantId}`)
          return false
        }
      },
      async setProfileOption(optionId, optionValue) {
        const store = get()
        const profileInfo = getCurrentProfile(store)
        if (!profileInfo) {
          return false
        }

        try {
          return await window.api.updateProfile(profileInfo.id, {
            options: { [optionId]: optionValue },
          })
        } catch (error) {
          console.error(`Failed to change option ${optionId}`, error)
          this.showErrorToast(`Failed to change option ${optionId}`)
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
      showSuccessToast(message) {
        enqueueSnackbar(message, { variant: "success" })
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
      async updatePackage(packageId, variantId) {
        try {
          return await window.api.installPackages({ [packageId]: variantId })
        } catch (error) {
          console.error(`Failed to update ${packageId}`, error)
          this.showErrorToast(`Failed to update ${packageId}`)
          return false
        }
      },
      async updateProfile(profileId, data) {
        const profileInfo = get().profiles?.[profileId]
        if (!profileInfo) {
          return false
        }

        try {
          return await window.api.updateProfile(profileId, data)
        } catch (error) {
          console.error(`Failed to update profile ${profileInfo.name}`, error)
          this.showErrorToast(`Failed to update profile ${profileInfo.name}`)
          return false
        }
      },
      updateState(data) {
        try {
          if (data.features) {
            updateState({ features: { $set: data.features } })
          }

          if (data.options) {
            updateState({ options: { $set: data.options } })
          }

          if (data.packages) {
            set(store => {
              const packages = compact({ ...store.packages, ...data.packages })
              return { packages, ...computePackageList({ ...store, packages }, false) }
            })
          }

          if (data.profiles) {
            updateState({ profiles: profiles => compact({ ...profiles, ...data.profiles }) })
          }

          if (data.sessions) {
            updateState({ sessions: sessions => compact({ ...sessions, ...data.sessions }) })
          }

          if (data.settings) {
            updateState({ settings: { $set: data.settings } })
          }

          if (data.status) {
            updateState({ status: { $set: data.status } })
          }
        } catch (error) {
          console.error(error)
        }
      },
    },
    authors: [],
    features: {},
    filteredPackages: [],
    packageFilters: {
      authors: [],
      categories: [],
      dependencies: false,
      experimental: false,
      incompatible: false,
      onlyErrors: false,
      onlyUpdates: false,
      search: "",
      state: null,
      states: [],
    },
    packageUi: {},
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

export function getAuthors(store: Store): string[] {
  return store.authors
}

export function getCurrentProfile(store: Store): ProfileInfo | undefined {
  const profileId = store.settings?.currentProfile
  return profileId ? store.profiles?.[profileId] : undefined
}

export function getPackageFilters(store: Store): PackageFilters {
  return store.packageFilters
}

export function getPackageInfo(store: Store, packageId: string): PackageInfo | undefined {
  return store.packages?.[packageId]
}

export function getProfileInfo(store: Store, profileId: string): ProfileInfo | undefined {
  return store.profiles?.[profileId]
}

export function getStoreActions(store: Store): StoreActions {
  return store.actions
}

export function useAuthors(): string[] {
  return useStore(getAuthors)
}

export function useCurrentProfile(): ProfileInfo | undefined {
  return useStore(getCurrentProfile)
}

export function usePackageFilters(): PackageFilters {
  return useStore(getPackageFilters)
}

export function useStoreActions(): StoreActions {
  return useStore(getStoreActions)
}
