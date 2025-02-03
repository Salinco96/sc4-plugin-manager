import path from "node:path"

import { BrowserWindow } from "electron/main"

import { isDev } from "@utils/env"

export class SplashScreen extends BrowserWindow {
  public constructor() {
    super({
      alwaysOnTop: true,
      frame: false,
      height: 240,
      transparent: true,
      width: 480,
    })

    if (isDev() && process.env.ELECTRON_RENDERER_URL) {
      this.loadURL(path.resolve(process.env.ELECTRON_RENDERER_URL, "splash.html"))
    } else {
      this.loadFile(path.resolve(__dirname, "../renderer/splash.html"))
    }

    this.center()
  }
}
