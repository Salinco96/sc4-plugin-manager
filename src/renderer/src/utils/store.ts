import update, { Spec } from "immutability-helper"
import { SnackbarKey, closeSnackbar, enqueueSnackbar } from "notistack"
import { create } from "zustand"

import { AuthorID, Authors } from "@common/authors"
import { CategoryID } from "@common/categories"
import { DBPFEntry, DBPFEntryData, DBPFFile } from "@common/dbpf"
import { ModalData, ModalID } from "@common/modals"
import { OptionID, OptionInfo, OptionValue } from "@common/options"
import { PackageID } from "@common/packages"
import { ProfileID, ProfileInfo, ProfileUpdate } from "@common/profiles"
import { Settings } from "@common/settings"
import { ApplicationState, ApplicationStateUpdate, getInitialState } from "@common/state"
import { Features, PackageInfo, PackageState } from "@common/types"
import { compact, keys } from "@common/utils/objects"
import { VariantID } from "@common/variants"

import { computePackageList, getPackageListItemSize } from "./packages"
import { SnackbarProps, SnackbarType } from "./snackbar"

export interface PackageUi {
  itemSize: number
  variantId: VariantID
  variantIds: VariantID[]
}

export interface PackageFilters {
  authors: AuthorID[]
  categories: CategoryID[]
  dependencies: boolean
  experimental: boolean
  incompatible: boolean
  onlyErrors: boolean
  onlyNew: boolean
  onlyUpdates: boolean
  search: string
  state: PackageState | null
  states: PackageState[]
}

export interface StoreActions {
  addPackage(packageId: PackageID, variantId: VariantID, data?: ProfileUpdate): Promise<boolean>
  check4GBPatch(): Promise<void>
  cleanVariant(packageId: PackageID, variantId: VariantID): Promise<void>
  closeSnackbar(type: SnackbarType): void
  createProfile(name: string, templateProfileId?: ProfileID): Promise<boolean>
  disablePackage(packageId: PackageID): Promise<boolean>
  enablePackage(packageId: PackageID): Promise<boolean>
  getPackageReadme(
    packageId: PackageID,
    variantId: VariantID,
  ): Promise<{ html?: string; md?: string }>
  installPackage(packageId: PackageID, variantId: VariantID): Promise<boolean>
  listFileContents(packageId: PackageID, variantId: VariantID, filePath: string): Promise<DBPFFile>
  loadDBPFEntry(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    entry: DBPFEntry,
  ): Promise<DBPFEntryData>
  openAuthorURL(authorId: AuthorID): Promise<boolean>
  openExecutableDirectory(): Promise<boolean>
  openInstallationDirectory(): Promise<boolean>
  openPackageConfig(packageId: PackageID): Promise<boolean>
  openPackageFile(packageId: PackageID, variantId: VariantID, filePath: string): Promise<boolean>
  openProfileConfig(profileId: ProfileID): Promise<boolean>
  openSnackbar<T extends SnackbarType>(type: T, props: SnackbarProps<T>): void
  openVariantRepository(packageId: PackageID, variantId: VariantID): Promise<boolean>
  openVariantURL(packageId: PackageID, variantId: VariantID): Promise<boolean>
  removePackage(packageId: PackageID, variantId: VariantID): Promise<boolean>
  resetPackageOptions(packageId: PackageID): Promise<boolean>
  resetState(): void
  setPackageOption(
    packageId: PackageID,
    optionId: OptionID,
    optionValue: OptionValue,
  ): Promise<boolean>
  setPackageVariant(packageId: PackageID, variantId: VariantID): Promise<boolean>
  setPackageFilters(filters: Partial<PackageFilters>): void
  setProfileOption(optionId: OptionID, optionValue: OptionValue): Promise<boolean>
  showErrorToast(message: string): void
  showModal<T extends ModalID>(id: T, data: ModalData<T>): Promise<boolean>
  showSuccessToast(message: string): void
  simtropolisLogin(): Promise<void>
  simtropolisLogout(): Promise<void>
  switchProfile(profileId: ProfileID): Promise<boolean>
  updatePackage(packageId: PackageID, variantId: VariantID): Promise<boolean>
  updateProfile(profileId: ProfileID, data: ProfileUpdate): Promise<boolean>
  updateState(update: ApplicationStateUpdate): void
}

export interface Store extends ApplicationState {
  actions: StoreActions
  modal?: {
    action: (result: boolean) => void
    data: ModalData<ModalID>
    id: ModalID
  }
  packageFilters: PackageFilters
  filteredPackages: PackageID[]
  packageUi: {
    [packageId in PackageID]?: PackageUi
  }
  snackbars: {
    [type in SnackbarType]?: SnackbarKey
  }
}

export const useStore = create<Store>()((set, get): Store => {
  function updateState(data: Spec<Store>): void {
    set(store => update(store, data))
    console.debug(get())
  }

  return {
    ...getInitialState(),
    actions: {
      async addPackage(packageId, variantId, data) {
        const store = get()
        const profileInfo = getCurrentProfile(store)
        if (!profileInfo) {
          return false
        }

        try {
          return await window.api.updateProfile(profileInfo.id, {
            ...data,
            packages: {
              [packageId]: { enabled: true, variant: variantId },
              ...data?.packages,
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
        const store = get()
        const profileInfo = getCurrentProfile(store)
        if (!profileInfo) {
          return false
        }

        try {
          return await window.api.updateProfile(profileInfo.id, {
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
        const store = get()
        const profileInfo = getCurrentProfile(store)
        if (!profileInfo) {
          return false
        }

        try {
          return await window.api.updateProfile(profileInfo.id, {
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
      async listFileContents(packageId, variantId, filePath) {
        return window.api.listFileContents(packageId, variantId, filePath)
      },
      async loadDBPFEntry(packageId, variantId, filePath, entry) {
        return window.api.loadDBPFEntry(packageId, variantId, filePath, entry)
      },
      async openAuthorURL(authorId) {
        return window.api.openAuthorURL(authorId)
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
      async resetPackageOptions(packageId) {
        const store = get()
        const profileInfo = getCurrentProfile(store)
        if (!profileInfo) {
          return false
        }

        try {
          return await window.api.updateProfile(profileInfo.id, {
            packages: {
              [packageId]: { options: null },
            },
          })
        } catch (error) {
          console.error(`Failed to reset options`, error)
          this.showErrorToast(`Failed to reset options`)
          return false
        }
      },
      resetState() {
        console.debug("Reset state")

        updateState({
          $merge: {
            ...getInitialState(),
            filteredPackages: [],
            packageUi: {},
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
        updateState({ simtropolis: { $set: null } })
        return window.api.simtropolisLogin()
      },
      async simtropolisLogout(): Promise<void> {
        updateState({ simtropolis: { $set: null } })
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
        const profileInfo = getProfileInfo(get(), profileId)
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
          if (data.status) {
            updateState({ status: { $set: data.status } })
            if (keys(data).length === 1) {
              return
            }
          }

          console.debug(data)

          if (data.authors) {
            updateState({ authors: { $set: data.authors } })
          }

          if (data.categories) {
            updateState({ categories: { $set: data.categories } })
          }

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

          if (data.settings) {
            updateState({ settings: { $set: data.settings } })
          }

          if (data.simtropolis) {
            updateState({ simtropolis: { $set: data.simtropolis } })
          }

          if (data.templates) {
            updateState({ templates: { $set: data.templates } })
          }
        } catch (error) {
          console.error(error)
        }
      },
    },
    filteredPackages: [],
    packageFilters: {
      authors: [],
      categories: [],
      dependencies: true,
      experimental: true,
      incompatible: true,
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
      state: null,
      states: [],
    },
    packageUi: {},
    snackbars: {},
  }
})

export function getAuthors(store: Store): Authors {
  return store.authors
}

export function getCurrentProfile(store: Store): ProfileInfo | undefined {
  const profileId = getSettings(store)?.currentProfile
  return profileId ? getProfileInfo(store, profileId) : undefined
}

export function getFeatures(store: Store): Features {
  return store.features
}

export function getGlobalOptions(store: Store): OptionInfo[] {
  return store.options
}

export function getPackageFilters(store: Store): PackageFilters {
  return store.packageFilters
}

export function getPackageInfo(store: Store, packageId: PackageID): PackageInfo | undefined {
  return store.packages?.[packageId]
}

export function getPackageName(store: Store, packageId: PackageID): string {
  return store.packages?.[packageId]?.name ?? packageId
}

export function getProfileInfo(store: Store, profileId: ProfileID): ProfileInfo | undefined {
  return store.profiles?.[profileId]
}

export function getSettings(store: Store): Settings | undefined {
  return store.settings
}

export function getStoreActions(store: Store): StoreActions {
  return store.actions
}

export function useAuthors(): Authors {
  return useStore(getAuthors)
}

export function useCurrentProfile(): ProfileInfo | undefined {
  return useStore(getCurrentProfile)
}

export function useFeatures(): Features {
  return useStore(getFeatures)
}

export function useGlobalOptions(): OptionInfo[] {
  return useStore(getGlobalOptions)
}

export function usePackageFilters(): PackageFilters {
  return useStore(getPackageFilters)
}

export function useSettings(): Settings | undefined {
  return useStore(getSettings)
}

export function useStoreActions(): StoreActions {
  return useStore(getStoreActions)
}
