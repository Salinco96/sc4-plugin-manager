import path from "node:path"

import { isString, keys } from "@salinco/nice-utils"
import { app } from "electron/main"
import semver from "semver"

import { i18n } from "@common/i18n"
import type { Profiles } from "@common/profiles"
import type { Settings, SettingsData } from "@common/settings"
import { loadConfig } from "@node/configs"
import { fsCopy, isURL } from "@node/files"
import type { TaskContext } from "@node/tasks"
import { DIRNAMES, FILENAMES } from "@utils/constants"
import { showConfirmation, showSuccess } from "@utils/dialog"
import { env } from "@utils/env"
import { check4GBPatch, checkInstallPath, getExeVersion } from "@utils/exe"

const repository = "Salinco96/sc4-plugin-manager"

export async function loadSettings(
  context: TaskContext,
  managerPath: string,
  pluginsPath: string,
  regionsPath: string,
  profiles: Profiles,
): Promise<Settings> {
  const config = await loadConfig<SettingsData>(managerPath, FILENAMES.settings)

  const settings: Settings = {
    format: config?.format,
    ...config?.data,
    db: isURL(env.DATA_REPOSITORY)
      ? {
          branch: env.DATA_BRANCH || "main",
          local: false,
          path: path.resolve(managerPath, DIRNAMES.db),
          url: env.DATA_REPOSITORY,
        }
      : {
          local: true,
          path: path.resolve(app.getAppPath(), env.DATA_REPOSITORY),
        },
    env: {
      dev: import.meta.env.DEV,
    },
    regions: {
      ...config?.data.regions,
    },
    startup: {
      reloadMaxis: false,
      reloadPlugins: false,
      removeConflictingPlugins: true,
      removeUnsupportedPlugins: true,
      ...config?.data.startup,
    },
    version: app.getVersion(),
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`)

    if (!response.ok) {
      throw Error(response.statusText)
    }

    const json: { tag_name: string } = await response.json()
    const version = json.tag_name.replace(/^v/, "") // remove leading v
    if (isString(version) && semver.gt(version, settings.version)) {
      const url = `https://github.com/${repository}/releases/latest`
      settings.update = { url, version }
    }
  } catch (error) {
    context.error("Failed to check for updates", error)
    settings.update = undefined
  }

  // Config file does not exist
  // This must be the first time launching the manager, suggest creating a backup of Plugins folder
  if (!settings.format) {
    const pluginsBackupPath = path.resolve(path.dirname(pluginsPath), DIRNAMES.pluginsBackup)
    const regionsBackupPath = path.resolve(path.dirname(pluginsPath), DIRNAMES.regionsBackup)

    const { confirmed } = await showConfirmation(
      i18n.t("BackupPluginsModal:title"),
      i18n.t("BackupPluginsModal:confirmation", {
        plugins: DIRNAMES.plugins,
        regions: DIRNAMES.regions,
      }),
      i18n.t("BackupPluginsModal:description", {
        plugins: DIRNAMES.plugins,
        regions: DIRNAMES.regions,
      }),
    )

    if (confirmed) {
      try {
        context.setLabel(`Copying ${DIRNAMES.plugins}...`)
        await fsCopy(pluginsPath, pluginsBackupPath, { merge: true, overwrite: true })
        await showSuccess(
          i18n.t("BackupPluginsModal:title"),
          i18n.t("BackupPluginsModal:pluginsSuccess", {
            plugins: DIRNAMES.plugins,
            pluginsBackup: DIRNAMES.pluginsBackup,
          }),
        )
      } catch (error) {
        context.error(`Failed to backup ${DIRNAMES.plugins} folder`, error)

        await showSuccess(
          i18n.t("BackupPluginsModal:title"),
          i18n.t("BackupPluginsModal:pluginsFailure", {
            plugins: DIRNAMES.plugins,
          }),
          (error as Error).message,
        )
      }

      try {
        context.setLabel(`Copying ${DIRNAMES.regions}...`)
        await fsCopy(regionsPath, regionsBackupPath, { merge: true, overwrite: true })
        await showSuccess(
          i18n.t("BackupPluginsModal:title"),
          i18n.t("BackupPluginsModal:regionsSuccess", {
            regions: DIRNAMES.regions,
            regionsBackup: DIRNAMES.regionsBackup,
          }),
        )
      } catch (error) {
        context.error(`Failed to backup ${DIRNAMES.plugins} folder`, error)

        await showSuccess(
          i18n.t("BackupPluginsModal:title"),
          i18n.t("BackupPluginsModal:regionsFailure", {
            regions: DIRNAMES.regions,
          }),
          (error as Error).message,
        )
      }
    }
  }

  // settings.currentProfile
  // Select first profile if currently-selected profile no longer exists
  if (!settings.currentProfile || !profiles[settings.currentProfile]) {
    settings.currentProfile = keys(profiles)[0]
  }

  // settings.install.path
  // Determine game installation path
  try {
    const installPath = await checkInstallPath(context, settings.install?.path)

    if (installPath) {
      settings.install ??= { path: installPath }
      settings.install.path = installPath
    } else {
      settings.install = undefined
    }
  } catch (error) {
    context.error("Failed to determine game installation path", error)
    settings.install = undefined
  }

  if (settings.install?.path) {
    try {
      // settings.install.version
      // Determine executable version
      settings.install.version = await getExeVersion(settings.install.path)
      context.info(`Detected version ${settings.install.version}`)
    } catch (error) {
      context.error("Failed to detect executable version", error)
    }

    try {
      // settings.install.patched
      // Determine whether 4GB Patch is applied, and suggest to apply it if not
      // true       : patch applied
      // false      : patch not applied, do not ask on startup
      // undefined  : patch not applied, ask on startup

      const { applied, doNotAskAgain } = await check4GBPatch(context, settings.install.path, {
        isStartupCheck: true,
        skipSuggestion: settings.install.patched === false,
      })

      settings.install.patched = applied || (doNotAskAgain ? false : undefined)
    } catch (error) {
      context.error("Failed to check for 4GB Patch", error)
    }
  }

  return settings
}

export function toSettingsData(settings: Readonly<Settings>): SettingsData {
  const data: SettingsData = {
    currentProfile: settings.currentProfile,
    install: settings.install,
    regions: settings.regions,
    startup: settings.startup,
  }

  return data
}
