import fs from "node:fs/promises"
import path from "node:path"

import type { Categories } from "@common/categories"
import { isDBPF } from "@common/dbpf"
import {
  type ExemplarPropertyData,
  type ExemplarPropertyInfo,
  ExemplarValueType,
} from "@common/exemplars"
import type { OptionInfo } from "@common/options"
import { type FileContents, MAXIS_FILES, type Plugins } from "@common/plugins"
import type { ProfileData, ProfileID, Profiles } from "@common/profiles"
import type { ToolID, Tools } from "@common/tools"
import { ConfigFormat } from "@common/types"
import { loadConfig, readConfig, writeConfig } from "@node/configs"
import { type OptionData, loadOptionInfo } from "@node/data/options"
import { type FileContentsData, loadContents, writeContents } from "@node/data/plugins"
import { type ToolData, loadToolInfo } from "@node/data/tools"
import { analyzeSC4File, analyzeSC4Files } from "@node/dbpf/analyze"
import {
  fsCreate,
  fsExists,
  fsQueryFilesWithTypes,
  fsRemove,
  getExtension,
  replaceExtension,
} from "@node/files"
import type { TaskContext } from "@node/tasks"
import {
  forEach,
  forEachAsync,
  isEnum,
  mapDefined,
  mapValues,
  parseHex,
  size,
} from "@salinco/nice-utils"
import { DIRNAMES, FILENAMES, TEMPLATE_PREFIX } from "@utils/constants"
import git from "isomorphic-git"
import http from "isomorphic-git/http/node"

import { fromProfileData } from "./profiles"

export async function loadCategories(context: TaskContext, dbPath: string): Promise<Categories> {
  try {
    const config = await loadConfig<Categories>(dbPath, FILENAMES.dbCategories)

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbCategories}`)
    }

    const categories = config.data

    context.debug(`Loaded ${size(categories)} categories`)
    return categories
  } catch (error) {
    context.error("Failed to load categories", error)
    return {}
  }
}

export async function loadExemplarProperties(
  context: TaskContext,
  dbPath: string,
): Promise<Record<string, ExemplarPropertyInfo>> {
  try {
    const config = await loadConfig<Record<string, ExemplarPropertyData>>(
      dbPath,
      FILENAMES.dbExemplarProperties,
    )

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbExemplarProperties}`)
    }

    const properties: Record<string, ExemplarPropertyInfo> = {}

    forEach(config.data, (data, propertyIdHex) => {
      const propertyInfo: ExemplarPropertyInfo = {
        ...data,
        type: data.type && ExemplarValueType[data.type],
      }

      if (propertyIdHex.includes("-")) {
        const [firstId, lastId] = propertyIdHex.split("-").map(parseHex)
        for (let propertyId = firstId; propertyId <= lastId; propertyId++) {
          properties[propertyId] = propertyInfo
        }
      } else {
        const propertyId = parseHex(propertyIdHex)
        properties[propertyId] = propertyInfo
      }
    })

    context.debug(`Loaded ${size(properties)} exemplar properties`)
    return properties
  } catch (error) {
    context.error("Failed to load exemplar properties", error)
    return {}
  }
}

export async function loadMaxisContents(
  context: TaskContext,
  dbPath: string,
  gamePath: string,
  options: {
    categories: Categories
    reload?: boolean
  },
): Promise<FileContents> {
  try {
    if (!options.reload) {
      const config = await loadConfig<{ [path in string]?: FileContentsData }>(
        dbPath,
        FILENAMES.indexMaxis,
      )

      if (config) {
        return loadContents(config.data, options.categories)
      }
    }

    context.debug("Indexing Maxis files...")

    const { contents } = await analyzeSC4Files(gamePath, MAXIS_FILES)

    await writeConfig<FileContentsData>(
      dbPath,
      FILENAMES.indexMaxis,
      writeContents(contents, options.categories),
      ConfigFormat.YAML,
    )

    return contents
  } catch (error) {
    context.error("Failed to load Maxis exemplars", error)
    return {}
  }
}

export async function loadPlugins(
  context: TaskContext,
  managerPath: string,
  pluginsPath: string,
  options: {
    categories: Categories
    reload?: boolean
  },
): Promise<{ links: Map<string, string>; plugins: Plugins }> {
  const links = new Map<string, string>()
  const plugins: Plugins = {}

  try {
    context.debug("Indexing external plugins...")

    let cache: FileContents = {}

    // Load the external plugin index cache
    if (!options.reload) {
      const config = await loadConfig<{ [path in string]?: FileContentsData }>(
        managerPath,
        FILENAMES.indexPlugins,
      )

      if (config) {
        cache = loadContents(config.data, options.categories)
      }
    }

    // Find all files in Plugins folder:
    // - Symbolic links are all treated as coming from Manager - TODO: Should we make sure the target path is child?
    // - Everything else is treated as external (since Manager only does symbolic links to Plugins)
    // - INI and LOG files are ignored (probably generated) - TODO: Ignore only if DLL with matching name? Is this always the case?
    const subfiles = await fsQueryFilesWithTypes(pluginsPath, "**", {
      exclude: "*.{ini,log}",
    })

    const newCache: typeof cache = {}

    let nSubfiles = 0
    for (const subfile of subfiles) {
      context.setProgress(nSubfiles++, subfiles.length)

      const subfilePath = subfile.relativePosix()

      if (subfile.isSymbolicLink()) {
        const targetPath = await fs.readlink(subfile.fullpath()) // Only read 1 level, this is intended (goes to Packages, not Downloads)
        links.set(subfilePath, targetPath)
      } else if (!isDBPF(subfilePath)) {
        plugins[subfilePath] = {}
      } else if (cache[subfilePath]) {
        plugins[subfilePath] = newCache[subfilePath] = cache[subfilePath]
      } else {
        try {
          const { contents } = await analyzeSC4File(pluginsPath, subfilePath)
          plugins[subfilePath] = newCache[subfilePath] = contents
        } catch (error) {
          context.error(`Failed to analyze ${subfilePath}`, error)
          plugins[subfilePath] = { issues: { dbpfError: (error as Error).message } }
        }
      }

      if (plugins[subfilePath]) {
        if (getExtension(subfilePath) === ".dll") {
          const logsPath = replaceExtension(subfilePath, ".log")
          if (await fsExists(path.resolve(pluginsPath, logsPath))) {
            plugins[subfilePath].logs = logsPath
          }
        }
      }
    }

    // Persist the analyzed plugins
    await writeConfig<{ [path in string]?: FileContentsData }>(
      managerPath,
      FILENAMES.indexPlugins,
      writeContents(newCache, options.categories),
      ConfigFormat.YAML,
    )

    context.debug(`Found ${links.size} links and ${nSubfiles - links.size} external plugins`)
  } catch (error) {
    context.error("Failed to index external plugins", error)
  }

  return { links, plugins }
}

export async function loadProfileOptions(
  context: TaskContext,
  dbPath: string,
): Promise<OptionInfo[]> {
  try {
    const config = await loadConfig<{ options: OptionData[] }>(dbPath, FILENAMES.dbProfileOptions)

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbProfileOptions}`)
    }

    const options = mapDefined(config.data.options, loadOptionInfo)

    context.debug(`Loaded ${options.length} profile options`)
    return options
  } catch (error) {
    context.error("Failed to load profile options", error)
    return []
  }
}

export async function loadProfileTemplates(
  context: TaskContext,
  dbPath: string,
): Promise<Profiles> {
  try {
    const templates: Profiles = {}

    const templatesPath = path.resolve(dbPath, DIRNAMES.dbTemplates)
    const entries = await fs.readdir(templatesPath, { withFileTypes: true })
    for (const entry of entries) {
      const format = path.extname(entry.name)
      if (entry.isFile() && isEnum(format, ConfigFormat)) {
        const profileId = `${TEMPLATE_PREFIX}${path.basename(entry.name, format)}` as ProfileID
        const profilePath = path.resolve(templatesPath, entry.name)
        if (templates[profileId]) {
          context.error(`Duplicate profile template '${entry.name}'`)
          continue
        }

        try {
          const data = await readConfig<ProfileData>(profilePath)
          const profile = fromProfileData(profileId, data)
          profile.format = format
          templates[profileId] = profile
        } catch (error) {
          context.error(`Invalid profile template '${entry.name}'`, error)
        }
      }
    }

    context.debug(`Loaded ${size(templates)} profile templates`)

    return templates
  } catch (error) {
    context.error("Failed to load profile templates", error)
    return {}
  }
}

export async function loadTools(
  context: TaskContext,
  dbPath: string,
  toolsPath: string,
): Promise<Tools> {
  try {
    const config = await loadConfig<{ [toolId in ToolID]?: ToolData }>(dbPath, FILENAMES.dbTools)

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbTools}`)
    }

    const tools = mapValues(config.data, (data, id) => loadToolInfo(id, data))

    await forEachAsync(tools, async toolInfo => {
      toolInfo.installed = await fsExists(path.join(toolsPath, toolInfo.id))
    })

    context.debug(`Loaded ${size(tools)} tools`)
    return tools
  } catch (error) {
    context.error("Failed to load tools", error)
    return {}
  }
}

export async function updateDatabase(
  context: TaskContext,
  dbPath: string,
  origin: string,
  branch: string,
): Promise<boolean> {
  try {
    const remote = "origin" // fine to hardcode this

    let exists = false

    if (await fsExists(path.resolve(dbPath, ".git"))) {
      const oldOrigin = await git.getConfig({ dir: dbPath, fs, path: `remote.${remote}.url` })
      const oldBranch = await git.currentBranch({ dir: dbPath, fs, test: true })
      if (oldOrigin === origin && oldBranch === branch) {
        exists = true
      } else {
        context.info("Resetting database due to mismatching origin or branch")
        // If we find anything else than expected origin/branch, nuke the repository
        // TODO: Handle switching branch?
        await fsRemove(dbPath)
      }
    }

    if (exists) {
      context.info(`Fetching changes from ${origin}/${branch}...`)

      // TODO: Handle local changes (atm this will just fail)
      await git.fastForward({
        dir: dbPath,
        fs,
        http,
        onProgress: progress => {
          context.setProgress(progress.loaded, progress.total)
        },
        ref: branch,
        remote,
        singleBranch: true,
      })
    } else {
      context.info(`Cloning ${origin}/${branch}...`)

      await fsCreate(dbPath)
      await git.clone({
        depth: 1,
        dir: dbPath,
        http,
        fs,
        onProgress: progress => {
          context.setProgress(progress.loaded, progress.total)
        },
        noTags: true,
        ref: branch,
        remote,
        singleBranch: true,
        url: origin,
      })
    }

    return true
  } catch (error) {
    context.error("Failed to update database", error)
    return false
  }
}
