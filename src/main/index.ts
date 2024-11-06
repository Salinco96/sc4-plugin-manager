import { app } from "electron/main"

import { registerDocsProtocol } from "@utils/protocols"

import { Application } from "./Application"

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  registerDocsProtocol()

  app.on("second-instance", () => {
    Application.focus()
  })

  app.on("window-all-closed", async () => {
    await Application.quit()
    app.quit()
  })

  app.whenReady().then(async () => {
    try {
      await Application.launch()
    } catch (error) {
      console.error(error)
      app.quit()
    }
  })
}
