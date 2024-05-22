import { BrowserWindow } from "electron/main"
import path from "path"

export class SplashScreen extends BrowserWindow {
  public constructor() {
    super({
      alwaysOnTop: true,
      frame: false,
      height: 360,
      icon: path.join(__dirname, "../renderer/splash.png"),
      transparent: true,
      width: 360,
    })

    if (import.meta.env.DEV && process.env["ELECTRON_RENDERER_URL"]) {
      this.loadURL(path.join(process.env["ELECTRON_RENDERER_URL"], "splash.html"))
    } else {
      this.loadFile(path.join(__dirname, "../renderer/splash.html"))
    }

    this.center()
  }
}
