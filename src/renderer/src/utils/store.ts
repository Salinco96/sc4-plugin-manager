import { enqueueSnackbar } from "notistack"
import { create } from "zustand"

import { ApplicationState, initialState } from "@common/state"
import {
  AssetInfo,
  PackageCategory,
  PackageInfo,
  PackageState,
  ProfileInfo,
  Settings,
} from "@common/types"

export interface StoreActions {
  createProfile(data: ProfileInfo): Promise<void>
  disablePackage(packageId: string): Promise<void>
  editCurrentProfile(data: Partial<Omit<ProfileInfo, "id">>): Promise<void>
  editProfile(profileId: string, data: Partial<Omit<ProfileInfo, "id">>): Promise<void>
  editSettings(settings: Partial<Settings>): Promise<void>
  enablePackage(packageId: string): Promise<void>
  installPackage(packageId: string, variantId?: string): Promise<void>
  setPackageFilters(filters: {
    categories?: PackageCategory[]
    search?: string
    states?: PackageState[]
  }): void
  switchProfile(profileId: string): Promise<void>
  updateState(update: Partial<ApplicationState>): void
}

export interface Store {
  actions: StoreActions
  localPackages?: { [id: string]: PackageInfo }
  packageFilters: {
    categories: PackageCategory[]
    search: string
    states: PackageState[]
  }
  profiles?: { [id: string]: ProfileInfo }
  remoteAssets?: { [id: string]: AssetInfo }
  remotePackages?: { [id: string]: PackageInfo }
  settings?: Settings
  state: ApplicationState
}

export const useStore = create<Store>()((set, get) => ({
  actions: {
    async disablePackage(packageId) {
      const store = get()
      const profile = getCurrentProfile(store)
      if (profile && profile.packages[packageId]?.enabled) {
        await this.editProfile(profile.id, {
          packages: {
            ...profile.packages,
            [packageId]: {
              ...profile.packages[packageId],
              enabled: false,
            },
          },
        })
      }
    },
    async enablePackage(packageId) {
      const store = get()
      const profile = getCurrentProfile(store)
      if (profile && !profile.packages[packageId]?.enabled) {
        await this.editProfile(profile.id, {
          packages: {
            ...profile.packages,
            [packageId]: {
              ...profile.packages[packageId],
              enabled: true,
            },
          },
        })
      }
    },
    async installPackage(packageId, variantId = "default") {
      const { remoteAssets, remotePackages } = get()
      const packageInfo = remotePackages?.[packageId]
      if (packageInfo?.assets && remoteAssets && !packageInfo.installing) {
        const assets = packageInfo.assets.map(asset => remoteAssets[asset.assetId])
        if (assets.length && assets.every(Boolean)) {
          set(store => ({
            remotePackages: {
              ...store.remotePackages,
              [packageId]: {
                ...packageInfo,
                installing: true,
              },
            },
          }))

          try {
            await window.api.installFiles(
              assets.map(asset => ({
                ...asset,
                packages: [
                  {
                    packageId,
                    variantId,
                  },
                ],
              })),
            )

            set(store => ({
              remotePackages: {
                ...store.remotePackages,
                [packageId]: {
                  ...packageInfo,
                  installed: packageInfo.version,
                },
              },
            }))
          } catch (error) {
            console.error(error)
            enqueueSnackbar(`Failed to install ${packageInfo.name}`, {
              autoHideDuration: 2000,
              variant: "error",
            })

            set(store => ({
              remotePackages: {
                ...store.remotePackages,
                [packageId]: packageInfo,
              },
            }))
          }
        }
      }
    },
    async createProfile(data) {
      const { profiles } = get()
      if (profiles) {
        set({ profiles: { [data.id]: data } })
        await window.api.writeProfile(data)
        await this.switchProfile(data.id)
      }
    },
    async editCurrentProfile(data) {
      const { settings } = get()
      if (settings?.currentProfile) {
        await this.editProfile(settings.currentProfile, data)
      }
    },
    async editProfile(id, data) {
      const { profiles } = get()
      const profile = profiles?.[id]
      if (profile) {
        const edited = { ...profile, ...data }
        set({ profiles: { ...profiles, [id]: edited } })
        await window.api.writeProfile(edited)
      }
    },
    async editSettings(data) {
      const { settings } = get()
      const edited = { ...settings, ...data }
      set({ settings: edited })
      await window.api.writeSettings(edited)
    },
    setPackageFilters(filters) {
      set(store => ({ packageFilters: { ...store.packageFilters, ...filters } }))
    },
    async switchProfile(profileId) {
      await this.editSettings({ currentProfile: profileId })
    },
    updateState({ data, ...state }) {
      console.log("updateState2", { data, ...state })
      set(store => ({
        localPackages: data?.localPackages
          ? {
              ...store.localPackages,
              ...data.localPackages,
            }
          : store.localPackages,
        profiles: data?.profiles
          ? {
              ...store.profiles,
              ...data.profiles,
            }
          : store.profiles,
        remoteAssets: data?.remoteAssets
          ? {
              ...store.remoteAssets,
              ...data.remoteAssets,
            }
          : store.remoteAssets,
        remotePackages: data?.remotePackages
          ? {
              ...store.remotePackages,
              ...data.remotePackages,
            }
          : store.remotePackages,
        settings: data?.settings ?? store.settings,
        state: {
          ...store.state,
          ...state,
        },
      }))
    },
  },
  packageFilters: {
    categories: [],
    search: "",
    states: [],
  },
  state: initialState,
}))

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
