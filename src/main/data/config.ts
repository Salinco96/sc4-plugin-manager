import path from "node:path"

import { app } from "electron/main"

import { i18n } from "@common/i18n"
import { ConfigFormat } from "@common/types"
import { loadConfig, writeConfig } from "@node/configs"
import { fsExists } from "@node/files"
import { DIRNAMES, FILENAMES } from "@utils/constants"
import { showFolderSelector } from "@utils/dialog"
import { env } from "@utils/env"

export interface AppConfig {
  gamePath: string
}

export async function loadAppConfig(): Promise<AppConfig> {
  const configPath = app.getPath("userData")
  const config = await loadConfig<Partial<AppConfig>>(configPath, FILENAMES.appConfig)

  const appConfig: AppConfig = {
    gamePath: env.GAME_DIR || config?.data.gamePath || getDefaultGamePath(),
  }

  // Fix invalid game data path
  while (await isInvalidGamePath(appConfig.gamePath)) {
    const result = await showFolderSelector(
      i18n.t("SelectGameDataFolderModal:title", { plugins: DIRNAMES.plugins }),
      app.getPath("documents"),
    )

    if (result) {
      appConfig.gamePath = result
    } else {
      throw Error("Aborted")
    }
  }

  if (appConfig.gamePath !== config?.data.gamePath) {
    await writeConfig(configPath, FILENAMES.appConfig, appConfig, ConfigFormat.JSON, config?.format)
  }

  return appConfig
}

function getDefaultGamePath(): string {
  return path.resolve(app.getPath("documents"), "SimCity 4")
}

async function isInvalidGamePath(gamePath: string): Promise<boolean> {
  const hasPlugins = await fsExists(path.resolve(gamePath, DIRNAMES.plugins))
  return !hasPlugins
}
