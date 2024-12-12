import path from "node:path"

import { isEmpty, toArray } from "@salinco/nice-utils"

import type { OptionInfo } from "@common/options"
import { createMatcher } from "@common/utils/glob"
import type { FileInfo } from "@common/variants"

/** Whitelisted cleanitol file extensions */
export const CLEANITOL_EXTENSIONS = [".txt"]

/** Whitelisted readme file extensions */
export const README_EXTENSIONS = [".htm", ".html", ".md", ".txt"]

/** Whitelisted documentation file extensions */
export const DOC_EXTENSIONS = [
  ...README_EXTENSIONS,
  ".bmp",
  ".css",
  ".doc",
  ".docx",
  ".gif",
  ".jpeg",
  ".jpg",
  ".odt",
  ".pdf",
  ".png",
  ".rtf",
  ".svg",
  ".xcf",
]

/** Whitelisted plugin file extensions */
export const SC4_EXTENSIONS = [".dat", ".dll", ".ini", ".sc4desc", ".sc4lot", ".sc4model"]

export function matchFiles(
  paths: string[],
  {
    exclude = [],
    ignoreEmpty = false,
    include,
    options = [],
  }: {
    exclude?: string[]
    ignoreEmpty?: boolean
    include: FileInfo[]
    options?: OptionInfo[]
  },
): {
  matchedPaths: { [path in string]?: FileInfo | null }
  unmatchedPaths: string[]
} {
  const matchedPaths: { [path in string]?: FileInfo | null } = {}
  let unmatchedPaths = paths

  for (const excludePath of exclude) {
    try {
      const matcher = createMatcher(excludePath)

      unmatchedPaths = unmatchedPaths.filter(filePath => {
        const match = matcher(filePath)
        if (match) {
          matchedPaths[filePath] = null
          return false
        }

        return true
      })
    } catch (error) {
      console.error(`Invalid pattern "${excludePath}"`, error)
    }
  }

  for (const includeInfo of include) {
    try {
      const matcher = createMatcher(includeInfo.path, options)

      let count = 0

      unmatchedPaths = unmatchedPaths.filter(filePath => {
        const match = matcher(filePath)
        if (match) {
          const filename = path.basename(filePath)

          const asPath = match.isDirectory
            ? path.posix.join(includeInfo.as ?? "", filePath.replace(match.base, ""))
            : (includeInfo.as?.replaceAll("*", filename) ?? filename)

          const conditions = {
            ...match.conditions,
            ...includeInfo.condition,
          }

          matchedPaths[filePath] = {
            condition: isEmpty(conditions) ? undefined : conditions,
            path: asPath,
            priority: includeInfo.priority,
          }

          count++
          return false
        }

        return true
      })

      if (count === 0 && !ignoreEmpty) {
        console.warn(`Pattern "${includeInfo.path}" did not match any file!`)
      }
    } catch (error) {
      console.error(`Invalid pattern "${includeInfo.path}"`, error)
    }
  }

  return {
    matchedPaths,
    unmatchedPaths: toArray(unmatchedPaths),
  }
}
