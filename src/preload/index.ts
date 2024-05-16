import { IpcRendererEvent, contextBridge, ipcRenderer } from "electron"

import { ApplicationState } from "@common/state"
import { AssetInfo, CollectionInfo, PackageInfo, ProfileInfo, Settings } from "@common/types"

// Custom APIs for renderer
export const api = {
  ping(): void {
    ipcRenderer.send("ping")
  },
  subscribeToStateUpdates(handler: (update: Partial<ApplicationState>) => void): () => void {
    const listener = (_: IpcRendererEvent, update: Partial<ApplicationState>) => handler(update)
    ipcRenderer.on("updateState", listener)
    return () => ipcRenderer.off("updateState", listener)
  },
  async getCollections(): Promise<CollectionInfo[]> {
    return ipcRenderer.invoke("getCollections")
  },
  async getProfiles(): Promise<{ [id: string]: ProfileInfo }> {
    return ipcRenderer.invoke("getProfiles")
  },
  async getLocalPackages(): Promise<{ [id: string]: PackageInfo }> {
    return ipcRenderer.invoke("getLocalPackages")
  },
  async getRemotePackages(): Promise<{
    assets: { [id: string]: AssetInfo }
    packages: { [id: string]: PackageInfo }
  }> {
    return ipcRenderer.invoke("getRemotePackages")
  },
  async getSettings(): Promise<Settings> {
    return ipcRenderer.invoke("getSettings")
  },
  async installFiles(
    assets: {
      id: string
      packages: {
        packageId: string
        variantId: string
      }[]
      url: string
      version: string
    }[],
  ): Promise<void> {
    return ipcRenderer.invoke("installFiles", assets)
  },
  async writeProfile(profile: ProfileInfo): Promise<void> {
    return ipcRenderer.invoke("writeProfile", profile)
  },
  async writeSettings(settings: Settings): Promise<void> {
    return ipcRenderer.invoke("writeSettings", settings)
  },
}

contextBridge.exposeInMainWorld("api", api)
