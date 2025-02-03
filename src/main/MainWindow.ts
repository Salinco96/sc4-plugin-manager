import path from "node:path"

import { isDev } from "@utils/env"

import { BaseWindow } from "./BaseWindow"

export class MainWindow extends BaseWindow {
  public constructor() {
    super({
      height: 800,
      webPreferences: {
        preload: path.resolve(__dirname, "../preload/index.js"),
      },
      width: 1200,
    })

    if (isDev()) {
      this.on("show", () => this.webContents.openDevTools())
    }

    if (isDev() && process.env.ELECTRON_RENDERER_URL) {
      this.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      this.loadFile(path.resolve(__dirname, "../renderer/index.html"))
    }
  }
}
