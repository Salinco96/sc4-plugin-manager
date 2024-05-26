import { shell } from "electron"
import { BrowserWindow } from "electron/main"
import path from "path"

export class MainWindow extends BrowserWindow {
  public constructor() {
    super({
      autoHideMenuBar: true,
      height: 800,
      icon: path.join(__dirname, "../renderer/splash.png"),
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
      },
      width: 1200,
    })

    this.on("ready-to-show", () => {
      this.show()

      if (import.meta.env.DEV) {
        this.webContents.openDevTools()
      }
    })

    // Open external links in browser
    this.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: "deny" }
    })

    if (import.meta.env.DEV && process.env["ELECTRON_RENDERER_URL"]) {
      this.loadURL(process.env["ELECTRON_RENDERER_URL"])
    } else {
      this.loadFile(path.join(__dirname, "../renderer/index.html"))
    }
  }
}
