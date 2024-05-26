import { app, protocol } from "electron/main"

import { Application } from "./Application"
import { initLogs } from "./utils/logs"

protocol.registerSchemesAsPrivileged([
  {
    scheme: "docs",
    privileges: {
      bypassCSP: true,
    },
  },
])

initLogs()

app.whenReady().then(() => new Application())
