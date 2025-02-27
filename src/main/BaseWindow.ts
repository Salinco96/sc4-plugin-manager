import path from "node:path"

import { shell } from "electron"
import { BrowserWindow, type BrowserWindowConstructorOptions } from "electron/main"

const WHITELISTED_ORIGINS = [
  "https://community.simtropolis.com",
  "https://discordapp.com",
  "https://en.wikipedia.org",
  "https://github.com",
  "https://paypal.me",
  "https://sc4evermore.com",
  "https://www.paypal.com",
  "https://www.sc4devotion.com",
  "https://www.sc4evermore.com",
  "https://www.sc4nam.com",
  "https://www.toutsimcities.com",
  "https://www.youtube.com",
  "https://www.7-zip.com",
]

export class BaseWindow extends BrowserWindow {
  public constructor(options: BrowserWindowConstructorOptions) {
    super({
      autoHideMenuBar: true,
      icon: path.resolve(__dirname, "../renderer/icon.png"),
      show: false,
      ...options,
    })

    this.on("ready-to-show", () => this.show())

    // Open external links in browser
    this.webContents.setWindowOpenHandler(({ url }) => {
      this.openInBrowser(url)
      return { action: "deny" }
    })
  }

  public openInBrowser(url: string) {
    const { origin } = new URL(url)
    // Only open whitelisted origins
    if (WHITELISTED_ORIGINS.includes(origin)) {
      shell.openExternal(url)
    } else {
      console.warn("Origin is not whitelisted:", origin)
    }
  }
}
