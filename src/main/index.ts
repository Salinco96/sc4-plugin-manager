import { app, protocol } from "electron/main"

import { Application } from "./Application"

protocol.registerSchemesAsPrivileged([
  {
    scheme: "docs",
    privileges: {
      bypassCSP: true,
    },
  },
])

app.whenReady().then(() => new Application())
