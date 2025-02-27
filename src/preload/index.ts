import { type IpcRendererEvent, contextBridge, ipcRenderer } from "electron"

import type { AuthorID } from "@common/authors"
import type { DBPFDataType, DBPFInfo, DBPFLoadedEntryInfo, TGI } from "@common/dbpf"
import type { ExemplarDataPatches } from "@common/exemplars"
import type { PackageID } from "@common/packages"
import type { ProfileID, ProfileUpdate } from "@common/profiles"
import type { CityID, RegionID, UpdateSaveAction } from "@common/regions"
import type { SettingsUpdate } from "@common/settings"
import type { ApplicationState, ApplicationStateUpdate, ApplicationStatus } from "@common/state"
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
  checkPlugins(): Promise<void> {
    return ipcRenderer.invoke("checkPlugins")
  },
  cleanVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("cleanVariant", packageId, variantId)
  },
  clearPackageLogs(packageId: PackageID, variantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("clearPackageLogs", packageId, variantId)
  },
  removeUnusedPackages(): Promise<void> {
    return ipcRenderer.invoke("removeUnusedPackages")
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
  getPackageDocs(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<{ iframe: string } | { md: string } | { text: string }> {
    return ipcRenderer.invoke("getPackageDocs", packageId, variantId, filePath)
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
  loadPackageFileEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<DBPFInfo> {
    return ipcRenderer.invoke("loadPackageFileEntries", packageId, variantId, filePath)
  },
  loadPackageFileEntry(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    entryId: TGI,
  ): Promise<DBPFLoadedEntryInfo> {
    return ipcRenderer.invoke("loadPackageFileEntry", packageId, variantId, filePath, entryId)
  },
  openAuthorUrl(authorId: AuthorID, type?: "url"): Promise<void> {
    return ipcRenderer.invoke("openAuthorUrl", authorId, type)
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
  openPackageDirectory(
    packageId: PackageID,
    variantId: VariantID,
    relativePath?: string,
  ): Promise<void> {
    return ipcRenderer.invoke("openPackageDirectory", packageId, variantId, relativePath)
  },
  openPackageUrl(
    packageId: PackageID,
    variantId: VariantID,
    type?: "repository" | "support" | "url",
  ): Promise<void> {
    return ipcRenderer.invoke("openPackageUrl", packageId, variantId, type)
  },
  openPluginDirectory(relativePath?: string): Promise<void> {
    return ipcRenderer.invoke("openPluginDirectory", relativePath)
  },
  openProfileConfig(profileId: ProfileID): Promise<void> {
    return ipcRenderer.invoke("openProfileConfig", profileId)
  },
  openRegionDirectory(regionId: RegionID): Promise<void> {
    return ipcRenderer.invoke("openRegionDirectory", regionId)
  },
  openToolDirectory(toolId: ToolID, relativePath?: string): Promise<void> {
    return ipcRenderer.invoke("openToolDirectory", toolId, relativePath)
  },
  openToolUrl(toolId: ToolID, type?: "repository" | "support" | "url"): Promise<void> {
    return ipcRenderer.invoke("openToolUrl", toolId, type)
  },
  patchPluginFileEntries(pluginPath: string, patches: ExemplarDataPatches): Promise<DBPFInfo> {
    return ipcRenderer.invoke("patchPluginFileEntries", pluginPath, patches)
  },
  patchPackageFileEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    patches: ExemplarDataPatches,
  ): Promise<DBPFInfo> {
    return ipcRenderer.invoke("patchPackageFileEntries", packageId, variantId, filePath, patches)
  },
  refreshLocalVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("refreshLocalVariant", packageId, variantId)
  },
  reloadPlugins(): Promise<void> {
    return ipcRenderer.invoke("reloadPlugins")
  },
  removeBackup(regionId: RegionID, cityId: CityID, file: string): Promise<void> {
    return ipcRenderer.invoke("removeBackup", regionId, cityId, file)
  },
  removePlugin(pluginPath: string): Promise<void> {
    return ipcRenderer.invoke("removePlugin", pluginPath)
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
    updateState(state: ApplicationStateUpdate): void
    updateStatus(status: Partial<ApplicationStatus>): void
  }): () => void {
    const updateState = (_: IpcRendererEvent, state: ApplicationStateUpdate) => {
      handlers.updateState(state)
    }

    const updateStatus = (_: IpcRendererEvent, status: Partial<ApplicationStatus>) => {
      handlers.updateStatus(status)
    }

    ipcRenderer.on("updateState", updateState)
    ipcRenderer.on("updateStatus", updateStatus)
    ipcRenderer.invoke("getState").then((state: ApplicationState) => {
      handlers.updateState({ data: { $merge: state }, recompute: true })
    })

    return () => {
      ipcRenderer.off("updateState", updateState)
      ipcRenderer.off("updateStatus", updateStatus)
    }
  },
  switchProfile(profileId: ProfileID): Promise<boolean> {
    return ipcRenderer.invoke("switchProfile", profileId)
  },
  updateCity(regionId: RegionID, cityId: CityID, action: UpdateSaveAction): Promise<boolean> {
    return ipcRenderer.invoke("updateCity", regionId, cityId, action)
  },
  updateProfile(profileId: ProfileID, data: ProfileUpdate): Promise<boolean> {
    return ipcRenderer.invoke("updateProfile", profileId, data)
  },
  updateSettings(data: SettingsUpdate): Promise<boolean> {
    return ipcRenderer.invoke("updateSettings", data)
  },
}

contextBridge.exposeInMainWorld("api", api)
