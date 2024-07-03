import { BrowserWindow, BrowserWindowConstructorOptions } from "electron/main"
import path from "path"

import { shell } from "electron"

const WHITELISTED_ORIGINS = [
  "https://adoptium.net",
  "https://community.simtropolis.com",
  "https://discordapp.com",
  "https://en.wikipedia.org",
  "https://github.com",
  "https://sc4evermore.com",
  "https://www.keka.io",
  "https://www.sc4devotion.com",
  "https://www.sc4evermore.com",
  "https://www.sc4nam.com",
  "https://www.youtube.com",
  "https://www.7-zip.com",
  // Consider supporting for donations
  // "https://paypal.me",
  // "https://www.paypal.com",
]

export class BaseWindow extends BrowserWindow {
  public constructor(options: BrowserWindowConstructorOptions) {
    super({
      autoHideMenuBar: true,
      icon: path.join(__dirname, "../renderer/icon.png"),
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
