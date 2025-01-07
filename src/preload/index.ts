import { type IpcRendererEvent, contextBridge, ipcRenderer } from "electron"

import type { AuthorID } from "@common/authors"
import type { DBPFEntry, DBPFFile, TGI } from "@common/dbpf"
import type { ExemplarDataPatch } from "@common/exemplars"
import type { ModalData, ModalID } from "@common/modals"
import type { PackageID } from "@common/packages"
import type { ProfileID, ProfileUpdate } from "@common/profiles"
import type { ApplicationStateUpdate } from "@common/state"
import type { ToolID } from "@common/tools"
import type { VariantID } from "@common/variants"

// Custom APIs for renderer
export const api = {
  check4GBPatch(): Promise<void> {
    return ipcRenderer.invoke("check4GBPatch")
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
  createProfile(name: string, templateProfileId?: ProfileID): Promise<void> {
    return ipcRenderer.invoke("createProfile", name, templateProfileId)
  },
  createVariant(packageId: PackageID, name: string, templateVariantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("createVariant", packageId, name, templateVariantId)
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
  loadDBPFEntries(packageId: PackageID, variantId: VariantID, filePath: string): Promise<DBPFFile> {
    return ipcRenderer.invoke("loadDBPFEntries", packageId, variantId, filePath)
  },
  loadDBPFEntry(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    entryId: TGI,
  ): Promise<DBPFEntry> {
    return ipcRenderer.invoke("loadDBPFEntry", packageId, variantId, filePath, entryId)
  },
  openAuthorURL(authorId: AuthorID): Promise<void> {
    return ipcRenderer.invoke("openAuthorURL", authorId)
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
  openProfileConfig(profileId: ProfileID): Promise<void> {
    return ipcRenderer.invoke("openProfileConfig", profileId)
  },
  openVariantURL(
    packageId: PackageID,
    variantId: VariantID,
    type: "repository" | "support" | "url",
  ): Promise<void> {
    return ipcRenderer.invoke("openVariantURL", packageId, variantId, type)
  },
  patchDBPFEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    patches: {
      [entryId in TGI]?: ExemplarDataPatch | null
    },
  ): Promise<DBPFFile> {
    return ipcRenderer.invoke("patchDBPFEntries", packageId, variantId, filePath, patches)
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
  simtropolisLogin(): Promise<void> {
    return ipcRenderer.invoke("simtropolisLogin")
  },
  simtropolisLogout(): Promise<void> {
    return ipcRenderer.invoke("simtropolisLogout")
  },
  subscribe(handlers: {
    showModal<T extends ModalID>(id: T, data: ModalData<T>): Promise<boolean>
    updateState(data: ApplicationStateUpdate): void
  }): () => void {
    const showModal = async <T extends ModalID>(_: IpcRendererEvent, id: T, data: ModalData<T>) => {
      const result = await handlers.showModal(id, data)
      ipcRenderer.send("showModalResult", result)
    }

    const updateState = (_: IpcRendererEvent, data: ApplicationStateUpdate) => {
      handlers.updateState(data)
    }

    ipcRenderer.on("showModal", showModal)
    ipcRenderer.on("updateState", updateState)
    ipcRenderer.invoke("getState").then(handlers.updateState)

    return () => {
      ipcRenderer.off("showModal", showModal)
      ipcRenderer.off("updateState", updateState)
    }
  },
  switchProfile(profileId: ProfileID): Promise<boolean> {
    return ipcRenderer.invoke("switchProfile", profileId)
  },
  updateProfile(profileId: ProfileID, data: ProfileUpdate): Promise<boolean> {
    return ipcRenderer.invoke("updateProfile", profileId, data)
  },
}

contextBridge.exposeInMainWorld("api", api)
