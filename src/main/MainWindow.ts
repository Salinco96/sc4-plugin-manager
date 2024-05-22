import { BrowserWindow } from "electron/main"
import path from "path"

export class MainWindow extends BrowserWindow {
  public constructor() {
    super({
      autoHideMenuBar: true,
      height: 720,
      icon: path.join(__dirname, "../renderer/splash.png"),
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
      },
      width: 960,
    })

    this.on("ready-to-show", () => {
      this.show()

      if (import.meta.env.DEV) {
        this.webContents.openDevTools()
      }
    })

    if (import.meta.env.DEV && process.env["ELECTRON_RENDERER_URL"]) {
      this.loadURL(process.env["ELECTRON_RENDERER_URL"])
    } else {
      this.loadFile(path.join(__dirname, "../renderer/index.html"))
    }
  }
}
