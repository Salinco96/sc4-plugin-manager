import path from "path"

import { isDev } from "@utils/env"

import { BaseWindow } from "./BaseWindow"

export class MainWindow extends BaseWindow {
  public constructor() {
    super({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
      },
    })

    if (isDev()) {
      this.on("show", () => this.webContents.openDevTools())
    }

    if (isDev() && process.env.ELECTRON_RENDERER_URL) {
      this.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      this.loadFile(path.join(__dirname, "../renderer/index.html"))
    }
  }
}
