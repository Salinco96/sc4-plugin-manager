import fs from "fs/promises"
import path from "path"

import { parse as yamlParse, stringify as yamlStringify } from "yaml"

import { ProfileInfo, Settings } from "@common/types"

import { getRootPath } from "../utils/paths"

const formats = ["json", "yaml", "yml"] as const

export type ConfigFormat = (typeof formats)[number]

const dirnames = {
  downloads: "Downloads",
  packages: "Packages",
  profiles: "Profiles",
}

const filenames = {
  packageConfig: "package",
  settings: "settings",
}

export class DataManager {
  defaultFormat: ConfigFormat = "json"

  rootPath: string = getRootPath()

  getDownloadsPath() {
    return path.join(this.rootPath, dirnames.downloads)
  }

  getPackagesPath() {
    return path.join(this.rootPath, dirnames.packages)
  }

  getProfilesPath() {
    return path.join(this.rootPath, dirnames.profiles)
  }

  async writeProfile(profile: ProfileInfo): Promise<void> {
    await this.writeConfig<RawProfileInfo>(this.getProfilesPath(), profile.id, {
      name: profile.name,
      packages: profile.packages,
    })
  }

  async readSettings(): Promise<Settings> {
    const read = await this.readConfig(this.rootPath, filenames.settings)
    const data = read?.data ?? {}

    return {
      useYaml: this.defaultFormat !== "json",
      ...data,
    }
  }

  async writeSettings(settings: Settings): Promise<void> {
    await this.writeConfig<RawSettings>(this.rootPath, filenames.settings, {
      currentProfile: settings.currentProfile,
    })
  }

  async readConfig(
    directory: string,
    basename: string,
  ): Promise<{ data: unknown; format: ConfigFormat } | null> {
    for (const format of formats) {
      const fullPath = path.join(directory, `${basename}.${format}`)
      try {
        const raw = await fs.readFile(fullPath, "utf8")
        return format === "json" ? JSON.parse(raw) : yamlParse(raw)
      } catch (error) {
        console.debug(error)
      }
    }

    return null
  }

  async writeConfig<T>(
    directory: string,
    basename: string,
    data: T,
    format: ConfigFormat = this.defaultFormat,
  ): Promise<void> {
    const fullPath = path.join(directory, `${basename}.${format}`)
    const raw = format === "json" ? JSON.stringify(data, undefined, 2) : yamlStringify(data)
    await fs.writeFile(fullPath, raw, "utf8")
  }
}

export type RawProfileInfo = Omit<ProfileInfo, "id">
export type RawSettings = Settings
