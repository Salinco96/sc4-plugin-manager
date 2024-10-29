import { IpcRendererEvent, contextBridge, ipcRenderer } from "electron"

import { AuthorID } from "@common/authors"
import { DBPFEntryData, DBPFFile, TGI } from "@common/dbpf"
import { ExemplarDataPatch } from "@common/exemplars"
import { Translations } from "@common/i18n"
import { ModalData, ModalID } from "@common/modals"
import { PackageID } from "@common/packages"
import { ProfileID, ProfileUpdate } from "@common/profiles"
import { ApplicationState } from "@common/state"
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
  async createProfile(name: string, templateProfileId?: ProfileID): Promise<boolean> {
    return ipcRenderer.invoke("createProfile", name, templateProfileId)
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
  async installPackages(packages: { [packageId: PackageID]: VariantID }): Promise<boolean> {
    return ipcRenderer.invoke("installPackages", packages)
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
  ): Promise<{ data: DBPFEntryData; original?: DBPFEntryData }> {
    return ipcRenderer.invoke("loadDBPFEntry", packageId, variantId, filePath, entryId)
  },
  async loadTranslations(lng: string): Promise<Translations> {
    return ipcRenderer.invoke("loadTranslations", lng)
  },
  async openAuthorURL(authorId: AuthorID): Promise<boolean> {
    return ipcRenderer.invoke("openAuthorURL", authorId)
  },
  async openExecutableDirectory(): Promise<boolean> {
    return ipcRenderer.invoke("openExecutableDirectory")
  },
  async openInstallationDirectory(): Promise<boolean> {
    return ipcRenderer.invoke("openInstallationDirectory")
  },
  async openPackageConfig(packageId: PackageID): Promise<boolean> {
    return ipcRenderer.invoke("openPackageConfig", packageId)
  },
  async openPackageFile(
    packageId: PackageID,
    variantId: VariantID,
    filePath: string,
  ): Promise<boolean> {
    return ipcRenderer.invoke("openPackageFile", packageId, variantId, filePath)
  },
  async openProfileConfig(profileId: ProfileID): Promise<boolean> {
    return ipcRenderer.invoke("openProfileConfig", profileId)
  },
  async openVariantRepository(packageId: PackageID, variantId: VariantID): Promise<boolean> {
    return ipcRenderer.invoke("openVariantRepository", packageId, variantId)
  },
  async openVariantURL(packageId: PackageID, variantId: VariantID): Promise<boolean> {
    return ipcRenderer.invoke("openVariantURL", packageId, variantId)
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
  async removePackages(packages: { [packageId: PackageID]: VariantID }): Promise<boolean> {
    return ipcRenderer.invoke("removePackages", packages)
  },
  async simtropolisLogin(): Promise<void> {
    return ipcRenderer.invoke("simtropolisLogin")
  },
  async simtropolisLogout(): Promise<void> {
    return ipcRenderer.invoke("simtropolisLogout")
  },
  subscribe(handlers: {
    resetState(): void
    showModal<T extends ModalID>(id: T, data: ModalData<T>): Promise<boolean>
    updateState(data: Partial<ApplicationState>): void
  }): () => void {
    const showModal = async <T extends ModalID>(_: IpcRendererEvent, id: T, data: ModalData<T>) => {
      const result = await handlers.showModal(id, data)
      ipcRenderer.send("showModalResult", result)
    }

    const resetState = () => {
      handlers.resetState()
    }

    const updateState = (_: IpcRendererEvent, data: Partial<ApplicationState>) => {
      handlers.updateState(data)
    }

    ipcRenderer.on("resetState", resetState)
    ipcRenderer.on("showModal", showModal)
    ipcRenderer.on("updateState", updateState)
    ipcRenderer.invoke("getState").then(handlers.updateState)

    return () => {
      ipcRenderer.off("resetState", resetState)
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
