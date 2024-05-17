import { app } from "electron/main"
import path from "path"

export function getGamePath(): string {
  if (import.meta.env.MAIN_VITE_GAME_DIR) {
    return import.meta.env.MAIN_VITE_GAME_DIR
  }

  return path.join(app.getPath("documents"), "SimCity 4")
}

export function getRootPath(): string {
  if (import.meta.env.MAIN_VITE_ROOT_DIR) {
    return import.meta.env.MAIN_VITE_ROOT_DIR
  }

  return path.join(getGamePath(), "Manager")
}

export function getDownloadsPath(): string {
  return path.join(getRootPath(), "Downloads")
}

export function getDatabasePath(): string {
  return path.join(getRootPath(), "Database")
}

export function getLogsPath(): string {
  return path.join(getRootPath(), "Logs")
}

export function getPackagesPath(): string {
  return path.join(getRootPath(), "Packages")
}

export function getPluginsPath(): string {
  return path.join(getGamePath(), "Plugins")
}
