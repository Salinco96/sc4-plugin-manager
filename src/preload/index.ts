import { type IpcRendererEvent, contextBridge, ipcRenderer } from "electron"

import type { AuthorID } from "@common/authors"
import type { DBPFDataType, DBPFInfo, DBPFLoadedEntryInfo, TGI } from "@common/dbpf"
import type { ExemplarDataPatch } from "@common/exemplars"
import type { PackageID } from "@common/packages"
import type { ProfileID, ProfileUpdate } from "@common/profiles"
import type { CityID, RegionID, UpdateSaveAction } from "@common/regions"
import type { Settings } from "@common/settings"
import type { ApplicationStateUpdate, ApplicationStatusUpdate } from "@common/state"
import type { ToolID } from "@common/tools"
import type { EditableVariantInfo, VariantID } from "@common/variants"

// Custom APIs for renderer
export const api = {
  check4GBPatch(): Promise<void> {
    return ipcRenderer.invoke("check4GBPatch")
  },
  checkDgVoodoo(): Promise<void> {
    return ipcRenderer.invoke("checkDgVoodoo")
  },
  cleanPlugins(): Promise<void> {
    return ipcRenderer.invoke("cleanPlugins")
  },
  cleanVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("cleanVariant", packageId, variantId)
  },
  clearPackageLogs(packageId: PackageID, variantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("clearPackageLogs", packageId, variantId)
  },
  clearUnusedPackages(): Promise<void> {
    return ipcRenderer.invoke("clearUnusedPackages")
  },
  createBackup(regionId: RegionID, cityId: CityID, description?: string): Promise<void> {
    return ipcRenderer.invoke("createBackup", regionId, cityId, description)
  },
  createProfile(name: string, templateProfileId?: ProfileID): Promise<void> {
    return ipcRenderer.invoke("createProfile", name, templateProfileId)
  },
  createVariant(packageId: PackageID, name: string, templateVariantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("createVariant", packageId, name, templateVariantId)
  },
  editVariant(
    packageId: PackageID,
    variantId: VariantID,
    data: EditableVariantInfo,
  ): Promise<void> {
    return ipcRenderer.invoke("editVariant", packageId, variantId, data)
  },
  getPackageLogs(
    packageId: PackageID,
    variantId: VariantID,
  ): Promise<{ size: number; text: string } | null> {
    return ipcRenderer.invoke("getPackageLogs", packageId, variantId)
  },
  getPackageReadme(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<{ html?: string; md?: string }> {
    return ipcRenderer.invoke("getPackageReadme", packageId, variantId, filePath)
  },
  installTool(toolId: ToolID): Promise<boolean> {
    return ipcRenderer.invoke("installTool", toolId)
  },
  installVariant(packageId: PackageID, variantId: VariantID): Promise<boolean> {
    return ipcRenderer.invoke("installVariant", packageId, variantId)
  },
  loadPluginFileEntries(pluginPath: string): Promise<DBPFInfo> {
    return ipcRenderer.invoke("loadPluginFileEntries", pluginPath)
  },
  loadPluginFileEntry(pluginPath: string, entryId: TGI): Promise<DBPFLoadedEntryInfo> {
    return ipcRenderer.invoke("loadPluginFileEntry", pluginPath, entryId)
  },
  loadSavePreviewPicture(
    regionId: RegionID,
    cityId: CityID,
    backupFile?: string,
  ): Promise<DBPFLoadedEntryInfo<DBPFDataType.PNG>> {
    return ipcRenderer.invoke("loadSavePreviewPicture", regionId, cityId, backupFile)
  },
  loadVariantFileEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<DBPFInfo> {
    return ipcRenderer.invoke("loadVariantFileEntries", packageId, variantId, filePath)
  },
  loadVariantFileEntry(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    entryId: TGI,
  ): Promise<DBPFLoadedEntryInfo> {
    return ipcRenderer.invoke("loadVariantFileEntry", packageId, variantId, filePath, entryId)
  },
  openAuthorURL(authorId: AuthorID): Promise<void> {
    return ipcRenderer.invoke("openAuthorURL", authorId)
  },
  openDataRepository(): Promise<void> {
    return ipcRenderer.invoke("openDataRepository")
  },
  openExecutableDirectory(): Promise<void> {
    return ipcRenderer.invoke("openExecutableDirectory")
  },
  openInstallationDirectory(): Promise<void> {
    return ipcRenderer.invoke("openInstallationDirectory")
  },
  openPackageConfig(packageId: PackageID): Promise<void> {
    return ipcRenderer.invoke("openPackageConfig", packageId)
  },
  openPackageFile(packageId: PackageID, variantId: VariantID, filePath: string): Promise<void> {
    return ipcRenderer.invoke("openPackageFile", packageId, variantId, filePath)
  },
  openPackageURL(
    packageId: PackageID,
    variantId: VariantID,
    type: "repository" | "support" | "url",
  ): Promise<void> {
    return ipcRenderer.invoke("openPackageURL", packageId, variantId, type)
  },
  openPluginFolder(pluginPath?: string): Promise<void> {
    return ipcRenderer.invoke("openPluginFolder", pluginPath)
  },
  openProfileConfig(profileId: ProfileID): Promise<void> {
    return ipcRenderer.invoke("openProfileConfig", profileId)
  },
  openRegionFolder(regionId: RegionID): Promise<void> {
    return ipcRenderer.invoke("openRegionFolder", regionId)
  },
  openToolFile(toolId: ToolID, filePath: string): Promise<void> {
    return ipcRenderer.invoke("openToolFile", toolId, filePath)
  },
  openToolURL(toolId: ToolID, type: "repository" | "support" | "url"): Promise<void> {
    return ipcRenderer.invoke("openToolURL", toolId, type)
  },
  patchPluginFileEntries(
    pluginPath: string,
    patches: {
      [entryId in TGI]?: ExemplarDataPatch | null
    },
  ): Promise<DBPFInfo> {
    return ipcRenderer.invoke("patchPluginFileEntries", pluginPath, patches)
  },
  patchVariantFileEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    patches: {
      [entryId in TGI]?: ExemplarDataPatch | null
    },
  ): Promise<DBPFInfo> {
    return ipcRenderer.invoke("patchVariantFileEntries", packageId, variantId, filePath, patches)
  },
  reloadPlugins(): Promise<void> {
    return ipcRenderer.invoke("reloadPlugins")
  },
  removeBackup(regionId: RegionID, cityId: CityID, file: string): Promise<void> {
    return ipcRenderer.invoke("removeBackup", regionId, cityId, file)
  },
  removePluginFile(pluginPath: string): Promise<void> {
    return ipcRenderer.invoke("removePluginFile", pluginPath)
  },
  removeProfile(profileId: ProfileID): Promise<boolean> {
    return ipcRenderer.invoke("removeProfile", profileId)
  },
  removeTool(toolId: ToolID): Promise<boolean> {
    return ipcRenderer.invoke("removeTool", toolId)
  },
  removeVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("removeVariant", packageId, variantId)
  },
  restoreBackup(regionId: RegionID, cityId: CityID, file: string): Promise<void> {
    return ipcRenderer.invoke("restoreBackup", regionId, cityId, file)
  },
  runTool(toolId: ToolID): Promise<boolean> {
    return ipcRenderer.invoke("runTool", toolId)
  },
  simtropolisLogin(): Promise<void> {
    return ipcRenderer.invoke("simtropolisLogin")
  },
  simtropolisLogout(): Promise<void> {
    return ipcRenderer.invoke("simtropolisLogout")
  },
  subscribe(handlers: {
    updateState(data: ApplicationStateUpdate, options: { merge: boolean; recompute: boolean }): void
    updateStatus(data: ApplicationStatusUpdate): void
  }): () => void {
    const updateState = (
      _: IpcRendererEvent,
      {
        data,
        ...options
      }: {
        data: ApplicationStateUpdate
        merge: boolean
        recompute: boolean
      },
    ) => {
      handlers.updateState(data, options)
    }

    const updateStatus = (_: IpcRendererEvent, data: ApplicationStatusUpdate) => {
      handlers.updateStatus(data)
    }

    ipcRenderer.on("updateState", updateState)
    ipcRenderer.on("updateStatus", updateStatus)
    ipcRenderer.invoke("getState").then(state => {
      handlers.updateState(state, { merge: false, recompute: true })
    })

    return () => {
      ipcRenderer.off("updateState", updateState)
      ipcRenderer.off("updateStatus", updateStatus)
    }
  },
  switchProfile(profileId: ProfileID): Promise<boolean> {
    return ipcRenderer.invoke("switchProfile", profileId)
  },
  updateProfile(profileId: ProfileID, data: ProfileUpdate): Promise<boolean> {
    return ipcRenderer.invoke("updateProfile", profileId, data)
  },
  updateSettings(data: Partial<Settings>): Promise<boolean> {
    return ipcRenderer.invoke("updateSettings", data)
  },
  updateSave(
    regionId: RegionID,
    cityId: CityID,
    file: string | null,
    action: UpdateSaveAction,
  ): Promise<boolean> {
    return ipcRenderer.invoke("updateSave", regionId, cityId, file, action)
  },
}

contextBridge.exposeInMainWorld("api", api)
