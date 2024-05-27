import { app } from "electron/main"
import path from "path"

import log, { LogLevel } from "electron-log"

import { getLogsPath } from "./paths"

export function getLogLevel(): LogLevel {
  if (import.meta.env.VITE_LOG_LEVEL && log.levels.includes(import.meta.env.VITE_LOG_LEVEL)) {
    return import.meta.env.VITE_LOG_LEVEL as LogLevel
  }

  return import.meta.env.DEV ? "debug" : "info"
}

export function getLogsFile(): string {
  return path.join(getLogsPath(), "main.log")
}

export function initLogs(): void {
  app.setPath("logs", getLogsPath())
  log.transports.console.level = getLogLevel()
  log.transports.file.level = getLogLevel()
  log.transports.file.resolvePathFn = getLogsFile
  Object.assign(console, log.functions)
}
