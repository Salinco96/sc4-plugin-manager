import { IpcRendererEvent, contextBridge, ipcRenderer } from "electron"

import { ModalData, ModalID } from "@common/modals"
import { ProfileUpdate } from "@common/profiles"
import { ApplicationState } from "@common/state"
import { PackageConfig } from "@common/types"

// Custom APIs for renderer
export const api = {
  async check4GBPatch(): Promise<void> {
    return ipcRenderer.invoke("check4GBPatch")
  },
  async createProfile(name: string, templateProfileId?: string): Promise<boolean> {
    return ipcRenderer.invoke("createProfile", name, templateProfileId)
  },
  async editProfile(profileId: string, data: ProfileUpdate): Promise<boolean> {
    return ipcRenderer.invoke("editProfile", profileId, data)
  },
  async getPackageDocsAsHtml(packageId: string, variantId: string): Promise<string> {
    return ipcRenderer.invoke("getPackageDocsAsHtml", packageId, variantId)
  },
  async installPackages(packages: { [packageId: string]: string }): Promise<boolean> {
    return ipcRenderer.invoke("installPackages", packages)
  },
  async updatePackages(
    profileId: string,
    configUpdates: Partial<Record<string, PackageConfig>>,
    externalUpdates: Partial<Record<string, boolean>> = {},
  ): Promise<boolean> {
    return ipcRenderer.invoke("updatePackages", profileId, configUpdates, externalUpdates)
  },
  async removePackages(packages: { [packageId: string]: string }): Promise<boolean> {
    return ipcRenderer.invoke("removePackages", packages)
  },
  async openExecutableDirectory(): Promise<void> {
    return ipcRenderer.invoke("openExecutableDirectory")
  },
  async openInstallationDirectory(): Promise<void> {
    return ipcRenderer.invoke("openInstallationDirectory")
  },
  async openPackageFileInExplorer(
    packageId: string,
    variantId: string,
    filePath: string,
  ): Promise<void> {
    return ipcRenderer.invoke("openPackageFileInExplorer", packageId, variantId, filePath)
  },
  async openProfileConfig(profileId: string): Promise<void> {
    return ipcRenderer.invoke("openProfileConfig", profileId)
  },
  async simtropolisLogin(): Promise<void> {
    return ipcRenderer.invoke("simtropolisLogin")
  },
  async simtropolisLogout(): Promise<void> {
    return ipcRenderer.invoke("simtropolisLogout")
  },
  subscribe(handlers: {
    showModal<T extends ModalID>(id: T, data: ModalData<T>): Promise<boolean>
    updateState(data: Partial<ApplicationState>): void
  }): () => void {
    const showModal = async <T extends ModalID>(_: IpcRendererEvent, id: T, data: ModalData<T>) => {
      const result = await handlers.showModal(id, data)
      ipcRenderer.send("showModalResult", result)
    }

    const updateState = (_: IpcRendererEvent, data: Partial<ApplicationState>) => {
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
  async switchProfile(profileId: string): Promise<boolean> {
    return ipcRenderer.invoke("switchProfile", profileId)
  },
}

contextBridge.exposeInMainWorld("api", api)
