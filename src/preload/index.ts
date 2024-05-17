import { IpcRendererEvent, contextBridge, ipcRenderer } from "electron"

import { ApplicationState } from "@common/state"
import { ProfileInfo, Settings } from "@common/types"

// Custom APIs for renderer
export const api = {
  ping(): void {
    ipcRenderer.send("ping")
  },
  subscribeToStateUpdates(handler: (update: Partial<ApplicationState>) => void): () => void {
    const listener = (_: IpcRendererEvent, update: Partial<ApplicationState>) => handler(update)
    ipcRenderer.on("updateState", listener)
    ipcRenderer.invoke("getState").then(handler)
    return () => ipcRenderer.off("updateState", listener)
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
