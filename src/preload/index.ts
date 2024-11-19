import { IpcRendererEvent, contextBridge, ipcRenderer } from "electron"

import { AuthorID } from "@common/authors"
import { DBPFEntry, DBPFFile, TGI } from "@common/dbpf"
import { ExemplarDataPatch } from "@common/exemplars"
import { ModalData, ModalID } from "@common/modals"
import { PackageID } from "@common/packages"
import { ProfileID, ProfileUpdate } from "@common/profiles"
import { ApplicationStateUpdate } from "@common/state"
import { VariantID } from "@common/variants"

// Custom APIs for renderer
export const api = {
  async check4GBPatch(): Promise<void> {
    return ipcRenderer.invoke("check4GBPatch")
  },
  async cleanVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("cleanVariant", packageId, variantId)
  },
  async clearPackageLogs(packageId: PackageID, variantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("clearPackageLogs", packageId, variantId)
  },
  async clearUnusedPackages(): Promise<void> {
    return ipcRenderer.invoke("clearUnusedPackages")
  },
  async createProfile(name: string, templateProfileId?: ProfileID): Promise<void> {
    return ipcRenderer.invoke("createProfile", name, templateProfileId)
  },
  async createVariant(
    packageId: PackageID,
    name: string,
    templateVariantId: VariantID,
  ): Promise<void> {
    return ipcRenderer.invoke("createVariant", packageId, name, templateVariantId)
  },
  async getPackageLogs(
    packageId: PackageID,
    variantId: VariantID,
  ): Promise<{ size: number; text: string } | null> {
    return ipcRenderer.invoke("getPackageLogs", packageId, variantId)
  },
  async getPackageReadme(
    packageId: PackageID,
    variantId: VariantID,
  ): Promise<{ html?: string; md?: string }> {
    return ipcRenderer.invoke("getPackageReadme", packageId, variantId)
  },
  async installVariant(packageId: PackageID, variantId: VariantID): Promise<boolean> {
    return ipcRenderer.invoke("installVariant", packageId, variantId)
  },
  async loadDBPFEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<DBPFFile> {
    return ipcRenderer.invoke("loadDBPFEntries", packageId, variantId, filePath)
  },
  async loadDBPFEntry(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    entryId: TGI,
  ): Promise<DBPFEntry> {
    return ipcRenderer.invoke("loadDBPFEntry", packageId, variantId, filePath, entryId)
  },
  async openAuthorURL(authorId: AuthorID): Promise<void> {
    return ipcRenderer.invoke("openAuthorURL", authorId)
  },
  async openExecutableDirectory(): Promise<void> {
    return ipcRenderer.invoke("openExecutableDirectory")
  },
  async openInstallationDirectory(): Promise<void> {
    return ipcRenderer.invoke("openInstallationDirectory")
  },
  async openPackageConfig(packageId: PackageID): Promise<void> {
    return ipcRenderer.invoke("openPackageConfig", packageId)
  },
  async openPackageFile(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<void> {
    return ipcRenderer.invoke("openPackageFile", packageId, variantId, filePath)
  },
  async openProfileConfig(profileId: ProfileID): Promise<void> {
    return ipcRenderer.invoke("openProfileConfig", profileId)
  },
  async openVariantURL(
    packageId: PackageID,
    variantId: VariantID,
    type: "repository" | "support" | "url",
  ): Promise<void> {
    return ipcRenderer.invoke("openVariantURL", packageId, variantId, type)
  },
  async patchDBPFEntries(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
    patches: {
      [entryId in TGI]?: ExemplarDataPatch | null
    },
  ): Promise<DBPFFile> {
    return ipcRenderer.invoke("patchDBPFEntries", packageId, variantId, filePath, patches)
  },
  async removeProfile(profileId: ProfileID): Promise<boolean> {
    return ipcRenderer.invoke("removeProfile", profileId)
  },
  async removeVariant(packageId: PackageID, variantId: VariantID): Promise<void> {
    return ipcRenderer.invoke("removeVariant", packageId, variantId)
  },
  async simtropolisLogin(): Promise<void> {
    return ipcRenderer.invoke("simtropolisLogin")
  },
  async simtropolisLogout(): Promise<void> {
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
  async switchProfile(profileId: ProfileID): Promise<boolean> {
    return ipcRenderer.invoke("switchProfile", profileId)
  },
  async updateProfile(profileId: ProfileID, data: ProfileUpdate): Promise<boolean> {
    return ipcRenderer.invoke("updateProfile", profileId, data)
  },
}

contextBridge.exposeInMainWorld("api", api)
