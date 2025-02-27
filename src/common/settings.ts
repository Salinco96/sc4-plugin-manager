import type { ProfileID } from "./profiles"
import type { CityID, RegionID } from "./regions"
import type { ConfigFormat } from "./types"

export type DatabaseSettings = {
  /** Git branch */
  branch?: string
  /** Whether database is local or not */
  local: boolean
  /** Absolute path to the local database directory */
  path: string
  /** Git repository URL to fetch updates from (always set if and only if database is not local) */
  url?: string
}

export type EnvironmentSettings = {
  /** Are we in development mode? */
  dev: boolean
}

export type InstallationSettings = {
  /** Whether the 4GB patch is applied */
  patched?: boolean
  /** Absolute path to game installation directory */
  path?: string
  /** Executable version */
  version?: string
  /** Whether DgVoodoo is installed */
  voodoo?: boolean
}

export type RegionsSettings = {
  [regionId in RegionID]?: {
    cities?: {
      [cityId in CityID]?: {
        /** Linked profile ID (defaults to same as region) */
        profile?: ProfileID
      }
    }

    /** Linked profile ID */
    profile?: ProfileID
  }
}

export type StartupSettings = {
  /** Whether  */
  reloadMaxis: boolean
  /** Whether  */
  reloadPlugins: boolean
  /** Whether  */
  removeConflictingPlugins: boolean
  /** Whether  */
  removeUnsupportedPlugins: boolean
}

export type SettingsUpdate = Partial<Pick<Settings, "regions" | "startup">>

/**
 * Loaded global settings
 */
export type Settings = {
  /**
   * Current active profile
   */
  currentProfile?: ProfileID

  /**
   * **Database information**
   *
   * There are 2 types of databases:
   *  - Git repository (clones the configured Git repository in Manager/Database directory)
   *  - Local database (loads files directly from the configured directory)
   *
   * We use fully-local database in development and Git in production build.
   *
   * This field is currently not persisted. It is actually set by the following environment variables:
   *  - `MAIN_VITE_DATA_REPOSITORY` (absolute path or Git repository URL)
   *  - `MAIN_VITE_DATA_BRANCH` (Git branch, defaults to `main`)
   *
   * TODO: Make this a true setting?
   */
  db: DatabaseSettings

  /**
   * **Environment information**
   *
   * Renderer thread does not have inherent access to environment variables and `import.meta.env`.
   *
   * This is how the main thread passes this information to the renderer.
   *
   * This field is not persisted.
   */
  env: EnvironmentSettings

  /**
   * **Current `settings` file format**
   *
   * This field is not persisted.
   */
  format?: ConfigFormat

  /**
   * **Game installation information**
   *
   * These field are mostly regenerated on startup. They are persisted so we can show the last known values if regeneration fails.
   *
   * Also, the presence of some fields may indicate that user has rejected to e.g. apply the 4GB Patch, so we will not suggest that again.
   */
  install?: InstallationSettings

  /**
   * **Savegame settings**
   *
   * Currently the only setting is linking profiles to regions/cities, so e.g. lot replacement suggestions can be applied to only those ones.
   */
  regions: RegionsSettings

  /**
   * **Startup settings**
   *
   * Sets what actions/suggestions we should make each time the application is started:
   *  - Some actions (e.g. reindexing SimCity_1.dat) are only useful if the user is making changes to the corresponding files
   *  - Some advanced users with complex plugins/overrides may be better off resolving conflicts manually
   *  - Some users may prefer a slightly faster startup
   */
  startup: StartupSettings

  /**
   * **Available manager update**
   *
   * Updates are detected on startup by querying `/releases/latest` on our Git repository.
   *
   * This field is not persisted.
   *
   * TODO: Use's electron auto-updater?
   */
  update?: {
    /** URL to latest version download page (not the download URL itself) */
    url: string
    /** Latest available manager version */
    version: string
  }

  /**
   * **Current manager version**
   *
   * This field is not persisted.
   */
  version: string
}

/**
 * Raw global settings as they are persisted in `settings.yaml`
 */
export type SettingsData = {
  currentProfile?: ProfileID
  install?: Partial<InstallationSettings>
  regions?: Partial<RegionsSettings>
  startup?: Partial<StartupSettings>
}
