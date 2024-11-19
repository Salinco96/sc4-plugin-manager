import update, { Spec } from "immutability-helper"
import { SnackbarKey, closeSnackbar, enqueueSnackbar } from "notistack"
import { create } from "zustand"

import { AuthorID, Authors } from "@common/authors"
import { CategoryID } from "@common/categories"
import { DBPFEntry, DBPFFile, TGI } from "@common/dbpf"
import { ExemplarDataPatch } from "@common/exemplars"
import { ModalData, ModalID } from "@common/modals"
import { OptionID, OptionValue } from "@common/options"
import { PackageID, getPackageStatus, isIncluded } from "@common/packages"
import { ProfileID, ProfileInfo, ProfileUpdate } from "@common/profiles"
import { Settings } from "@common/settings"
import { ApplicationState, ApplicationStateUpdate, getInitialState } from "@common/state"
import { Features, PackageInfo, VariantState } from "@common/types"
import { compact, isEmpty } from "@common/utils/objects"
import { VariantID } from "@common/variants"

import { computePackageList } from "./packages"
import { SnackbarProps, SnackbarType } from "./snackbar"

export interface PackageUi {
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
  state: VariantState | null
  states: VariantState[]
}

export interface StoreActions {
  addPackage(packageId: PackageID, variantId: VariantID, data?: ProfileUpdate): Promise<boolean>
  check4GBPatch(): Promise<void>
  clearPackageLogs(packageId: PackageID, variantId: VariantID): Promise<void>
  clearUnusedPackages(): Promise<void>
  closeSnackbar(type: SnackbarType): void
  createProfile(name: string, templateProfileId?: ProfileID): Promise<void>
  createVariant(packageId: PackageID, name: string, templateVariantId: VariantID): Promise<void>
  disablePackage(packageId: PackageID): Promise<boolean>
  enablePackage(packageId: PackageID): Promise<boolean>
  getPackageLogs(
    packageId: PackageID,
    variantId: VariantID,
  ): Promise<{ size: number; text: string } | null>
  getPackageReadme(
    packageId: PackageID,
    variantId: VariantID,
  ): Promise<{ html?: string; md?: string }>
  installVariant(packageId: PackageID, variantId: VariantID): Promise<void>
  loadDBPFEntries(packageId: PackageID, variantId: VariantID, filePath: string): Promise<DBPFFile>
  loadDBPFEntry(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    entryId: TGI,
  ): Promise<DBPFEntry>
  openAuthorURL(authorId: AuthorID): Promise<void>
  openExecutableDirectory(): Promise<void>
  openInstallationDirectory(): Promise<void>
  openPackageConfig(packageId: PackageID): Promise<void>
  openPackageFile(packageId: PackageID, variantId: VariantID, filePath: string): Promise<void>
  openProfileConfig(profileId: ProfileID): Promise<void>
  openSnackbar<T extends SnackbarType>(type: T, props: SnackbarProps<T>): void
  openVariantURL(
    packageId: PackageID,
    variantId: VariantID,
    type: "repository" | "support" | "url",
  ): Promise<void>
  patchDBPFEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    patches: {
      [entryId in TGI]?: ExemplarDataPatch | null
    },
  ): Promise<DBPFFile>
  removeProfile(profileId: ProfileID): Promise<boolean>
  removeVariant(packageId: PackageID, variantId: VariantID): Promise<void>
  resetPackageOptions(packageId: PackageID): Promise<void>
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
  switchProfile(profileId: ProfileID): Promise<void>
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
      async clearPackageLogs(packageId, variantId) {
        return window.api.clearPackageLogs(packageId, variantId)
      },
      async clearUnusedPackages() {
        return window.api.clearUnusedPackages()
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
      async createVariant(packageId, name, templateVariantId) {
        return window.api.createVariant(packageId, name, templateVariantId)
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
      async getPackageLogs(packageId, variantId) {
        return window.api.getPackageLogs(packageId, variantId)
      },
      async getPackageReadme(packageId, variantId) {
        return window.api.getPackageReadme(packageId, variantId)
      },
      async installVariant(packageId, variantId) {
        try {
          await window.api.installVariant(packageId, variantId)
        } catch (error) {
          console.error(`Failed to install ${packageId}`, error)
          this.showErrorToast(`Failed to install ${packageId}`)
        }
      },
      async loadDBPFEntries(packageId, variantId, filePath) {
        return window.api.loadDBPFEntries(packageId, variantId, filePath)
      },
      async loadDBPFEntry(packageId, variantId, filePath, entryId) {
        return window.api.loadDBPFEntry(packageId, variantId, filePath, entryId)
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
      async openVariantURL(packageId, variantId, type) {
        return window.api.openVariantURL(packageId, variantId, type)
      },
      async patchDBPFEntries(packageId, variantId, filePath, patches) {
        return window.api.patchDBPFEntries(packageId, variantId, filePath, patches)
      },
      async removeProfile(profileId) {
        try {
          return await window.api.removeProfile(profileId)
        } catch (error) {
          console.error(`Failed to remove ${profileId}`, error)
          this.showErrorToast(`Failed to remove ${profileId}`)
          return false
        }
      },
      async removeVariant(packageId, variantId) {
        try {
          await window.api.removeVariant(packageId, variantId)
        } catch (error) {
          console.error(`Failed to remove ${packageId}`, error)
          this.showErrorToast(`Failed to remove ${packageId}`)
        }
      },
      async resetPackageOptions(packageId) {
        const store = get()
        const profileInfo = getCurrentProfile(store)
        if (!profileInfo) {
          return
        }

        try {
          await window.api.updateProfile(profileInfo.id, {
            packages: {
              [packageId]: { options: null },
            },
          })
        } catch (error) {
          console.error(`Failed to reset options`, error)
          this.showErrorToast(`Failed to reset options`)
        }
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
        try {
          await window.api.switchProfile(profileId)
        } catch (error) {
          console.error("Failed to change profile", error)
          this.showErrorToast("Failed to change profile")
        }
      },
      async updatePackage(packageId, variantId) {
        const store = get()
        const packageInfo = getPackageInfo(store, packageId)
        const profileInfo = getCurrentProfile(store)
        const variantInfo = packageInfo?.variants[variantId]
        if (!packageInfo || !variantInfo?.update) {
          return false
        }

        try {
          // If the variant to update is included in the current profile, then the update may cause
          // changes in files/conflicts/dependencies. Thus we need to trigger package resolution as
          // if the profile was changed.
          if (profileInfo && isIncluded(variantInfo, getPackageStatus(packageInfo, profileInfo))) {
            return await window.api.updateProfile(profileInfo.id, {
              packages: {
                [packageId]: {
                  version: variantInfo.update.version,
                },
              },
            })
          }

          return await window.api.installVariant(packageId, variantId)
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
        const { downloads, linker, loader, ...dataToLog } = data

        if (!isEmpty(dataToLog)) {
          console.debug(dataToLog)
        }

        set(store => {
          const { downloads, packages, profiles, ...others } = data

          const updates: Partial<Store> = others

          if (downloads) {
            updates.downloads = compact({ ...store.downloads, ...downloads })
          }

          if (packages) {
            updates.packages = compact({ ...store.packages, ...packages })
          }

          if (profiles) {
            updates.profiles = compact({ ...store.profiles, ...profiles })
          }

          if (packages) {
            Object.assign(updates, computePackageList({ ...store, ...updates }, false))
          }

          return updates
        })
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

function getAuthors(store: Store): Authors {
  return store.authors
}

export function getCurrentProfile(store: Store): ProfileInfo | undefined {
  const profileId = getSettings(store)?.currentProfile
  return profileId ? getProfileInfo(store, profileId) : undefined
}

function getFeatures(store: Store): Features {
  return store.features
}

function getPackageFilters(store: Store): PackageFilters {
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

function getSettings(store: Store): Settings | undefined {
  return store.settings
}

function getStoreActions(store: Store): StoreActions {
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

export function usePackageFilters(): PackageFilters {
  return useStore(getPackageFilters)
}

export function useSettings(): Settings | undefined {
  return useStore(getSettings)
}

export function useStoreActions(): StoreActions {
  return useStore(getStoreActions)
}
