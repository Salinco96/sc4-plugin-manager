import { IpcRendererEvent, contextBridge, ipcRenderer } from "electron"

import { ProfileUpdate } from "@common/profiles"
import { ApplicationState } from "@common/state"

// Custom APIs for renderer
export const api = {
  async createProfile(name: string, templateProfileId?: string): Promise<boolean> {
    return ipcRenderer.invoke("createProfile", name, templateProfileId)
  },
  async disablePackages(packageIds: string[]): Promise<boolean> {
    return ipcRenderer.invoke("disablePackages", packageIds)
  },
  async editProfile(profileId: string, data: ProfileUpdate): Promise<boolean> {
    return ipcRenderer.invoke("editProfile", profileId, data)
  },
  async enablePackages(packageIds: string[]): Promise<boolean> {
    return ipcRenderer.invoke("enablePackages", packageIds)
  },
  async getPackageDocsAsHtml(packageId: string): Promise<string> {
    return ipcRenderer.invoke("getPackageDocsAsHtml", packageId)
  },
  async installPackages(packageIds: string[]): Promise<boolean> {
    return ipcRenderer.invoke("installPackages", packageIds)
  },
  async removePackages(packageIds: string[]): Promise<boolean> {
    return ipcRenderer.invoke("removePackages", packageIds)
  },
  async openPackageFileInExplorer(
    packageId: string,
    variantId: string,
    filePath: string,
  ): Promise<void> {
    return ipcRenderer.invoke("openPackageFileInExplorer", packageId, variantId, filePath)
  },
  async setPackageVariant(packageId: string, variantId: string): Promise<boolean> {
    return ipcRenderer.invoke("setPackageVariant", packageId, variantId)
  },
  subscribeToStateUpdates(handler: (update: Partial<ApplicationState>) => void): () => void {
    const listener = (_: IpcRendererEvent, update: Partial<ApplicationState>) => handler(update)
    ipcRenderer.on("updateState", listener)
    ipcRenderer.invoke("getState").then(handler)
    return () => ipcRenderer.off("updateState", listener)
  },
  async switchProfile(profileId: string): Promise<boolean> {
    return ipcRenderer.invoke("switchProfile", profileId)
  },
}

contextBridge.exposeInMainWorld("api", api)
