import { BrowserWindow } from "electron/main"
import path from "path"

export class MainWindow extends BrowserWindow {
  public constructor() {
    super({
      width: 900,
      height: 670,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
      },
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
