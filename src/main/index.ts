import { app } from "electron/main"

import { registerDocsProtocol } from "@utils/protocols"

import { Application } from "./Application"

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  registerDocsProtocol()

  let instance: Application

  app.on("second-instance", () => {
    if (instance?.mainWindow) {
      if (instance.mainWindow.isMinimized()) {
        instance.mainWindow.restore()
      }

      instance.mainWindow.focus()
    }
  })

  app.on("window-all-closed", async () => {
    await instance?.quit()
    app.quit()
  })

  app.whenReady().then(async () => {
    try {
      instance = new Application()
      await instance.launch()
    } catch (error) {
      console.error(error)
      app.quit()
    }
  })
}
