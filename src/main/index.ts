import { app } from "electron/main"

import { Application } from "./Application"
import { initLogs } from "./utils/logs"

initLogs()

app.whenReady().then(() => new Application())
