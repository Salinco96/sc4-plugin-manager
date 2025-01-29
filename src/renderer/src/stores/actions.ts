import type { AuthorID } from "@common/authors"
import type { CollectionID } from "@common/collections"
import type { DBPFDataType, DBPFEntry, DBPFFile, TGI } from "@common/dbpf"
import type { ExemplarDataPatch } from "@common/exemplars"
import type { OptionID, OptionValue } from "@common/options"
import { type PackageID, isEnabled, isIncluded, isIncompatible, isSelected } from "@common/packages"
import type { ProfileID, ProfileUpdate } from "@common/profiles"
import type { CityID, RegionID, UpdateSaveAction } from "@common/regions"
import type { Settings } from "@common/settings"
import type { ToolID } from "@common/tools"
import type { VariantID } from "@common/variants"
import { computePackageList } from "@utils/packages"

import { type PackageFilters, store } from "./main"
import { showErrorToast, showInfoToast, showSuccessToast } from "./ui"

export async function addPackage(
  packageId: PackageID,
  variantId: VariantID,
  data: ProfileUpdate = {},
): Promise<boolean> {
  const profileInfo = store.api.getCurrentProfile()
  if (!profileInfo) {
    return false
  }

  store.api.updateState({
    packages: {
      [packageId]: {
        status: {
          [profileInfo.id]: {
            $merge: {
              action: "enabling",
            },
          },
        },
      },
    },
  })

  try {
    return await window.api.updateProfile(profileInfo.id, {
      ...data,
      packages: {
        [packageId]: { enabled: true, variant: variantId },
        ...data.packages,
      },
    })
  } catch (error) {
    console.error(`Failed to add ${packageId}`, error)
    showErrorToast(`Failed to add ${packageId}`)
    return false
  }
}

export async function check4GBPatch(): Promise<void> {
  return window.api.check4GBPatch()
}

export async function checkDgVoodoo(): Promise<void> {
  return window.api.checkDgVoodoo()
}

export async function cleanPlugins(): Promise<void> {
  return window.api.cleanPlugins()
}

export async function clearPackageLogs(packageId: PackageID, variantId: VariantID): Promise<void> {
  return window.api.clearPackageLogs(packageId, variantId)
}

export async function clearUnusedPackages(): Promise<void> {
  return window.api.clearUnusedPackages()
}

export async function createBackup(
  regionId: RegionID,
  cityId: CityID,
  description?: string,
): Promise<void> {
  return window.api.createBackup(regionId, cityId, description)
}

export async function createProfile(name: string, templateProfileId?: ProfileID): Promise<void> {
  return window.api.createProfile(name, templateProfileId)
}

export async function createVariant(
  packageId: PackageID,
  name: string,
  templateVariantId: VariantID,
): Promise<void> {
  return window.api.createVariant(packageId, name, templateVariantId)
}

export async function disableCollection(collectionId: CollectionID): Promise<boolean> {
  const profileInfo = store.api.getCurrentProfile()
  if (!profileInfo) {
    return false
  }

  const collectionInfo = store.api.getCollectionInfo(collectionId)

  const update: ProfileUpdate = {}

  for (const packageId of collectionInfo.packages) {
    const packageStatus = store.api.getPackageStatus(packageId, profileInfo.id)
    if (isEnabled(packageStatus)) {
      update.packages ??= {}
      update.packages[packageId] = { enabled: false }
    }
  }

  if (!update.packages) {
    return false
  }

  try {
    return await window.api.updateProfile(profileInfo.id, update)
  } catch (error) {
    console.error(`Failed to disable ${collectionId}`, error)
    showErrorToast(`Failed to disable ${collectionId}`)
    return false
  }
}

export async function disablePackage(packageId: PackageID): Promise<boolean> {
  const profileInfo = store.api.getCurrentProfile()
  if (!profileInfo) {
    return false
  }

  store.api.updateState({
    packages: {
      [packageId]: {
        status: {
          [profileInfo.id]: {
            $merge: {
              action: "disabling",
            },
          },
        },
      },
    },
  })

  try {
    return await window.api.updateProfile(profileInfo.id, {
      packages: {
        [packageId]: { enabled: false },
      },
    })
  } catch (error) {
    console.error(`Failed to disable ${packageId}`, error)
    showErrorToast(`Failed to disable ${packageId}`)
    return false
  }
}

export async function enableCollection(collectionId: CollectionID): Promise<boolean> {
  const profileInfo = store.api.getCurrentProfile()
  if (!profileInfo) {
    return false
  }

  const collectionInfo = store.api.getCollectionInfo(collectionId)

  const update: ProfileUpdate = {}

  for (const packageId of collectionInfo.packages) {
    const packageStatus = store.api.getPackageStatus(packageId, profileInfo.id)
    const variantInfo = store.api.getCurrentVariant(packageId)
    if (!isEnabled(packageStatus) && !isIncompatible(variantInfo, packageStatus)) {
      update.packages ??= {}
      update.packages[packageId] = { enabled: true, variant: variantInfo.id }
    }
  }

  if (!update.packages) {
    return false
  }

  try {
    return await window.api.updateProfile(profileInfo.id, update)
  } catch (error) {
    console.error(`Failed to enable ${collectionId}`, error)
    showErrorToast(`Failed to enable ${collectionId}`)
    return false
  }
}

export async function enablePackage(packageId: PackageID): Promise<boolean> {
  const profileInfo = store.api.getCurrentProfile()
  if (!profileInfo) {
    return false
  }

  store.api.updateState({
    packages: {
      [packageId]: {
        status: {
          [profileInfo.id]: {
            $merge: {
              action: "enabling",
            },
          },
        },
      },
    },
  })

  try {
    return await window.api.updateProfile(profileInfo.id, {
      packages: {
        [packageId]: { enabled: true },
      },
    })
  } catch (error) {
    console.error(`Failed to enable ${packageId}`, error)
    showErrorToast(`Failed to enable ${packageId}`)
    return false
  }
}

export async function getPackageLogs(
  packageId: PackageID,
  variantId: VariantID,
): Promise<{ size: number; text: string } | null> {
  return window.api.getPackageLogs(packageId, variantId)
}

export async function getPackageReadme(
  packageId: PackageID,
  variantId: VariantID,
  filePath: string,
): Promise<{ html?: string; md?: string }> {
  return window.api.getPackageReadme(packageId, variantId, filePath)
}

export async function installTool(toolId: ToolID): Promise<boolean> {
  try {
    return await window.api.installTool(toolId)
  } catch (error) {
    console.error(`Failed to install ${toolId}`, error)
    showErrorToast(`Failed to install ${toolId}`)
    return false
  }
}

export async function installVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
  store.api.updateState({
    packages: {
      [packageId]: {
        variants: {
          [variantId]: {
            $merge: {
              action: "installing",
            },
          },
        },
      },
    },
  })

  try {
    await window.api.installVariant(packageId, variantId)
  } catch (error) {
    console.error(`Failed to install ${packageId}#${variantId}`, error)
    showErrorToast(`Failed to install ${packageId}#${variantId}`)
  }
}

export async function linkCity(
  regionId: RegionID,
  cityId: CityID,
  profileId: ProfileID | null,
): Promise<boolean> {
  const settings = store.api.getSettings()

  return updateSettings({
    regions: {
      ...settings?.regions,
      [regionId]: {
        ...settings?.regions?.[regionId],
        cities: {
          ...settings?.regions?.[regionId]?.cities,
          [cityId]: profileId ? { profile: profileId } : undefined,
        },
      },
    },
  })
}

export async function linkRegion(regionId: RegionID, profileId: ProfileID): Promise<boolean> {
  const settings = store.api.getSettings()

  return updateSettings({
    regions: {
      ...settings?.regions,
      [regionId]: {
        ...settings?.regions?.[regionId],
        profile: profileId,
      },
    },
  })
}

export async function loadPluginFileEntries(pluginPath: string): Promise<DBPFFile> {
  return window.api.loadPluginFileEntries(pluginPath)
}

export async function loadPluginFileEntry(pluginPath: string, entryId: TGI): Promise<DBPFEntry> {
  return window.api.loadPluginFileEntry(pluginPath, entryId)
}

export async function loadSavePreviewPicture(
  regionId: RegionID,
  cityId: CityID,
  backupFile?: string,
): Promise<DBPFEntry<DBPFDataType.PNG>> {
  return window.api.loadSavePreviewPicture(regionId, cityId, backupFile)
}

export async function loadVariantFileEntries(
  packageId: PackageID,
  variantId: VariantID,
  filePath: string,
): Promise<DBPFFile> {
  return window.api.loadVariantFileEntries(packageId, variantId, filePath)
}

export async function loadVariantFileEntry(
  packageId: PackageID,
  variantId: VariantID,
  filePath: string,
  entryId: TGI,
): Promise<DBPFEntry> {
  return window.api.loadVariantFileEntry(packageId, variantId, filePath, entryId)
}

export async function openAuthorURL(authorId: AuthorID): Promise<void> {
  return window.api.openAuthorURL(authorId)
}

export async function openInstallationDirectory(): Promise<void> {
  return window.api.openInstallationDirectory()
}

export async function openExecutableDirectory(): Promise<void> {
  return window.api.openExecutableDirectory()
}

export async function openPackageConfig(packageId: PackageID): Promise<void> {
  return window.api.openPackageConfig(packageId)
}

export async function openPackageFile(
  packageId: PackageID,
  variantId: VariantID,
  filePath: string,
): Promise<void> {
  return window.api.openPackageFile(packageId, variantId, filePath)
}

export async function openPackageURL(
  packageId: PackageID,
  variantId: VariantID,
  type: "repository" | "support" | "url",
): Promise<void> {
  return window.api.openPackageURL(packageId, variantId, type)
}

export async function openPluginFolder(pluginPath?: string): Promise<void> {
  return window.api.openPluginFolder(pluginPath)
}

export async function openProfileConfig(profileId: ProfileID): Promise<void> {
  return window.api.openProfileConfig(profileId)
}

export async function openRegionFolder(regionId: RegionID): Promise<void> {
  return window.api.openRegionFolder(regionId)
}

export async function openToolFile(toolId: ToolID, filePath: string): Promise<void> {
  return window.api.openToolFile(toolId, filePath)
}

export async function openToolURL(
  toolId: ToolID,
  type: "repository" | "support" | "url",
): Promise<void> {
  return window.api.openToolURL(toolId, type)
}

export async function patchPluginFileEntries(
  pluginPath: string,
  patches: { [entryId in TGI]?: ExemplarDataPatch | null },
): Promise<DBPFFile> {
  return window.api.patchPluginFileEntries(pluginPath, patches)
}

export async function patchVariantFileEntries(
  packageId: PackageID,
  variantId: VariantID,
  filePath: string,
  patches: { [entryId in TGI]?: ExemplarDataPatch | null },
): Promise<DBPFFile> {
  return window.api.patchVariantFileEntries(packageId, variantId, filePath, patches)
}

export async function reloadPlugins(): Promise<void> {
  return window.api.reloadPlugins()
}

export async function removeBackup(
  regionId: RegionID,
  cityId: CityID,
  file: string,
): Promise<void> {
  return window.api.removeBackup(regionId, cityId, file)
}

export async function removePluginFile(pluginPath: string): Promise<void> {
  return window.api.removePluginFile(pluginPath)
}

export async function removeProfile(profileId: ProfileID): Promise<boolean> {
  const profile = store.api.getProfileInfo(profileId)

  try {
    const success = await window.api.removeProfile(profileId)
    if (success) {
      showSuccessToast(`Profile ${profile.name} has been removed`)
    }

    return false
  } catch (error) {
    console.error(`Failed to remove ${profileId}`, error)
    showErrorToast(`Failed to remove ${profile.name}`)
    return false
  }
}

export async function removeTool(toolId: ToolID): Promise<boolean> {
  try {
    return await window.api.removeTool(toolId)
  } catch (error) {
    console.error(`Failed to remove ${toolId}`, error)
    showErrorToast(`Failed to remove ${toolId}`)
    return false
  }
}

export async function removeVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
  store.api.updateState({
    packages: {
      [packageId]: {
        variants: {
          [variantId]: {
            $merge: {
              action: "removing",
            },
          },
        },
      },
    },
  })

  try {
    await window.api.removeVariant(packageId, variantId)
  } catch (error) {
    console.error(`Failed to remove ${packageId}#${variantId}`, error)
    showErrorToast(`Failed to remove ${packageId}#${variantId}`)
  }
}

export async function resetPackageOptions(packageId: PackageID): Promise<boolean> {
  const profileInfo = store.api.getCurrentProfile()
  if (!profileInfo) {
    return false
  }

  store.api.updateState({
    profiles: {
      [profileInfo.id]: {
        packages: {
          [packageId]: (config = {}) => ({
            ...config,
            options: undefined,
          }),
        },
      },
    },
  })

  try {
    return await window.api.updateProfile(profileInfo.id, {
      packages: {
        [packageId]: { options: null },
      },
    })
  } catch (error) {
    console.error("Failed to reset options", error)
    showErrorToast("Failed to reset options")
    return false
  }
}

export async function restoreBackup(
  regionId: RegionID,
  cityId: CityID,
  file: string,
): Promise<void> {
  return window.api.restoreBackup(regionId, cityId, file)
}

export async function runTool(toolId: ToolID): Promise<boolean> {
  try {
    return await window.api.runTool(toolId)
  } catch (error) {
    console.error(`Failed to run ${toolId}`, error)
    showErrorToast(`Failed to run ${toolId}`)
    return false
  }
}

export function setPackageFilters(filters: Partial<PackageFilters>): void {
  store.api.setState(store => {
    const packageFilters = { ...store.packageFilters, ...filters }
    return { packageFilters, ...computePackageList({ ...store, packageFilters }, true) }
  })
}

export async function setPackageOption(
  packageId: PackageID,
  optionId: OptionID | "lots",
  value: OptionValue,
): Promise<boolean> {
  const profileInfo = store.api.getCurrentProfile()
  if (!profileInfo) {
    return false
  }

  store.api.updateState({
    profiles: {
      [profileInfo.id]: {
        packages: {
          [packageId]: (config = {}) => ({
            ...config,
            options: {
              ...config.options,
              [optionId]: value,
            },
          }),
        },
      },
    },
  })

  try {
    return await window.api.updateProfile(profileInfo.id, {
      packages: {
        [packageId]: { options: { [optionId]: value } },
      },
    })
  } catch (error) {
    console.error(`Failed to change option ${packageId}#${optionId}`, error)
    showErrorToast(`Failed to change option ${packageId}#${optionId}`)
    return false
  }
}

export async function setPackageVariant(
  packageId: PackageID,
  variantId: VariantID,
): Promise<boolean> {
  const profileInfo = store.api.getCurrentProfile()
  const packageStatus = store.api.getPackageStatus(packageId)

  if (profileInfo && isIncluded(packageStatus)) {
    store.api.updateState({
      packages: {
        [packageId]: {
          status: {
            [profileInfo.id]: {
              $merge: {
                action: "switching",
              },
            },
          },
        },
      },
    })
  } else {
    store.api.updateState({
      packageUi: {
        [packageId]: {
          $merge: {
            variantId,
          },
        },
      },
    })
  }

  if (!profileInfo) {
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
    showErrorToast(`Failed to select variant ${packageId}#${variantId}`)
    return false
  }
}

export async function setProfileOption(optionId: OptionID, value: OptionValue): Promise<boolean> {
  const profileInfo = store.api.getCurrentProfile()
  if (!profileInfo) {
    return false
  }

  try {
    return await window.api.updateProfile(profileInfo.id, {
      options: { [optionId]: value },
    })
  } catch (error) {
    console.error(`Failed to change option ${optionId}`, error)
    showErrorToast(`Failed to change option ${optionId}`)
    return false
  }
}

export async function simtropolisLogin(): Promise<void> {
  store.api.updateState({ simtropolis: { $set: null } })
  return window.api.simtropolisLogin()
}

export async function simtropolisLogout(): Promise<void> {
  store.api.updateState({ simtropolis: { $set: null } })
  return window.api.simtropolisLogout()
}

export async function switchProfile(profileId: ProfileID): Promise<boolean> {
  try {
    return await window.api.switchProfile(profileId)
  } catch (error) {
    console.error("Failed to change profile", error)
    showErrorToast("Failed to change profile")
    return false
  }
}

export async function updateVariant(packageId: PackageID, variantId: VariantID): Promise<boolean> {
  const profileInfo = store.api.getCurrentProfile()
  const variantInfo = store.api.getVariantInfo(packageId, variantId)
  if (!variantInfo.update) {
    return false
  }

  try {
    // If the variant to update is included in the current profile, then the update may cause
    // changes in files/conflicts/dependencies. Thus we need to trigger package resolution as
    // if the profile was changed.
    const packageStatus = store.api.getPackageStatus(packageId)
    if (profileInfo && isIncluded(packageStatus) && isSelected(variantInfo, packageStatus)) {
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
    showErrorToast(`Failed to update ${packageId}`)
    return false
  }
}

export async function updateProfile(profileId: ProfileID, data: ProfileUpdate): Promise<boolean> {
  const profileInfo = store.api.getProfileInfo(profileId)

  try {
    return await window.api.updateProfile(profileId, data)
  } catch (error) {
    console.error(`Failed to update profile ${profileInfo.name}`, error)
    showErrorToast(`Failed to update profile ${profileInfo.name}`)
    return false
  }
}

export async function updateSettings(data: Partial<Settings>): Promise<boolean> {
  try {
    if (await window.api.updateSettings(data)) {
      showSuccessToast("Settings updated")
    }

    return true
  } catch (error) {
    console.error("Failed to update settings", error)
    showErrorToast("Failed to update settings")
    return false
  }
}

export async function updateSave(
  regionId: RegionID,
  cityId: CityID,
  file: string | null,
  action: UpdateSaveAction,
): Promise<boolean> {
  const city = store.api.getCityInfo(regionId, cityId)

  try {
    const updated = await window.api.updateSave(regionId, cityId, file, action)

    if (updated) {
      showSuccessToast(`${city.name} updated`)
    } else {
      showInfoToast("Nothing to update")
    }

    return updated
  } catch (error) {
    console.error(`Failed to update ${city.name}`, error)
    // Lock error typically occurs if the city is currently in play
    if (error instanceof Error && error.message.match(/resource busy or locked/i)) {
      showErrorToast(`Failed to update ${city.name} - Please save and exit the city first`)
    } else {
      showErrorToast(`Failed to update ${city.name}`)
    }

    return false
  }
}
