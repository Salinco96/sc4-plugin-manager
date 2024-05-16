import { app } from "electron/main"
import path from "path"

import log from "electron-log/main"

import { getLogsPath } from "./paths"

export function getLogsFile(): string {
  return path.join(getLogsPath(), "main.log")
}

export function initLogs(): void {
  app.setPath("logs", getLogsPath())
  log.transports.file.resolvePathFn = getLogsFile
  Object.assign(console, log.functions)
}
