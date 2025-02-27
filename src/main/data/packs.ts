import path from "node:path"
import type { PackageID } from "@common/packages"
import { ConfigFormat } from "@common/types"
import type { VariantID } from "@common/variants"
import { loadConfig, writeConfig } from "@node/configs"
import { fsCreate, fsQueryFiles, fsRemove } from "@node/files"
import type { TaskContext } from "@node/tasks"
import { isEmpty, size } from "@salinco/nice-utils"
import { DIRNAMES, FILENAMES } from "@utils/constants"

export type PackInfo = {
  files: {
    [key in `${PackageID}#${VariantID}@${string}`]?: string[]
  }
  priority: number
}

export type Packs = {
  [filename in string]?: PackInfo
}

export async function loadPacks(context: TaskContext, rootPath: string): Promise<Packs> {
  try {
    context.debug("Loading packs...")

    const config = await loadConfig<Packs>(rootPath, FILENAMES.packs)

    const packs = config?.data ?? {}

    const packsPath = path.resolve(rootPath, DIRNAMES.packs)

    if (isEmpty(packs)) {
      await fsRemove(packsPath)
    } else {
      await fsCreate(packsPath)
      const filenames = await fsQueryFiles(packsPath, "*.dat")

      // Remove files that no longer exist in config
      for (const filename of filenames) {
        if (!packs[filename]) {
          await fsRemove(path.resolve(packsPath, filename))
        }
      }

      // Drop packs that no longer exist on disk
      for (const filename in packs) {
        if (!filenames.includes(filename)) {
          delete packs[filename]
        }
      }
    }

    context.debug(`Loaded ${size(packs)} packs`)
    return packs
  } catch (error) {
    context.error("Failed to load packs", error)
    return {}
  }
}

export async function writePacks(
  context: TaskContext,
  rootPath: string,
  packs: Packs,
): Promise<void> {
  try {
    context.debug("Writing packs...")

    await writeConfig<Packs>(rootPath, FILENAMES.packs, packs, ConfigFormat.YAML)
  } catch (error) {
    context.error("Failed to write packs", error)
  }
}
