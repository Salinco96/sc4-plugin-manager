import type { OptionID, OptionInfo } from "@common/options"
import { isEmpty } from "@salinco/nice-utils"

const SEPARATOR = "[\\\\\\/]"
const NOT_SEPARATOR = SEPARATOR.replaceAll("[", "[^")

function toIdentifier(name: string): string {
  return name.replace(/[^\w_$]/g, "")
}

export function globToRegex(pattern: string, options?: OptionInfo[]): RegExp {
  const regex = pattern
    // escape special characters
    .replaceAll(/[()|]/g, s => `\\${s}`)
    // ? matches any one non-separator character -> [^\\/]
    .replaceAll("?", NOT_SEPARATOR)
    // {{condition}} matches any option value and captures it by name -> (?<condition>foo|bar)
    .replaceAll(/{{([^}]*)(}}|$)/g, (match, condition, closing) => {
      if (!closing) {
        throw Error(`In pattern ${pattern} - Unclosed condition "${match}"`)
      }

      if (!options) {
        throw Error(`In pattern ${pattern} - Unmatched condition`)
      }

      const option = options.find(option => option.id === condition)
      if (!option) {
        throw Error(`In pattern ${pattern} - Unknown option "${condition}"`)
      }

      const values = option?.choices?.map(choice => choice.value)
      return `(?<${toIdentifier(condition)}>${values?.join("|") ?? "*"})`
    })
    // {foo,bar} matches either foo or bar -> (?:foo|bar)
    .replaceAll(/{([^}]*)(}|$)/g, (match, contents, closing) => {
      if (!closing) {
        throw Error(`In pattern ${pattern} - Unclosed group "${match}"`)
      }

      if (!contents) {
        throw Error(`In pattern ${pattern} - Empty group "${match}"`)
      }

      return `(?:${contents.split(",").join("|")})`
    })
    // disallow stray }
    .replaceAll("}", match => {
      throw Error(`In pattern ${pattern} - Unexpected character "${match}"`)
    })
    // **/ matches any number of path segments -> (?:.*[\\/])?
    .replaceAll("**/", "(?:**/)?")
    // / matches any one separator -> [\\/]
    .replaceAll("/", SEPARATOR)
    // escape more special characters -> \$, \., etc.
    .replaceAll(/[$+.^]/g, s => `\\${s}`)
    // ** matches any number of characters -> .*
    // * matches any number of non-separator characters -> [^\\/]*
    .replaceAll(/[*][*]?/g, s => `${s.length === 1 ? NOT_SEPARATOR : "."}*`)

  return new RegExp(
    `^(${pattern.includes("/") ? "" : `(?:.+${SEPARATOR})?`}${regex})(?:${pattern.endsWith("/") ? "" : SEPARATOR}.+)?$`,
    "i",
  )
}

export function createMatcher(
  pattern: string,
  options?: OptionInfo[],
): (filePath: string) =>
  | {
      base: string
      conditions?: { [optionId in OptionID]?: string }
      isDirectory: boolean
    }
  | undefined {
  const regex = globToRegex(pattern, options)

  return (filePath: string) => {
    const match = regex.exec(filePath)
    if (match) {
      const isDirectory = match[1] !== filePath

      const base = isDirectory
        ? `${match[1]}${match[1].endsWith("/") ? "" : "/"}`
        : filePath.replace(/[^/]+$/, "")

      const groups = match.groups

      if (options && groups) {
        const conditions = options.reduce<{ [optionId in OptionID]?: string }>((result, option) => {
          result[option.id] = groups[toIdentifier(option.id)]
          return result
        }, {})

        if (!isEmpty(conditions)) {
          return { base, isDirectory, conditions }
        }
      }

      return { base, isDirectory }
    }
  }
}
