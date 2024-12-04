const SEPARATOR = "[\\\\\\/]"
const NOT_SEPARATOR = SEPARATOR.replaceAll("[", "[^")

function toIdentifier(name: string): string {
  return name.replace(/[^\w_$]/g, "")
}

export function globToRegex(pattern: string): RegExp {
  return new RegExp(
    `${pattern.includes("/") ? "^" : `(?:^|${SEPARATOR})`}${pattern
      .replaceAll(/[$()|+.^]/g, s => `\\${s}`)
      .replaceAll("/", SEPARATOR)
      .replaceAll(/[*]+/g, s => `${s.length === 1 ? NOT_SEPARATOR : "."}*`)
      .replaceAll("?", `${NOT_SEPARATOR}?`)
      .replaceAll(/{{([^}]+)}}/g, (s, condition) => `(?<${toIdentifier(condition)}>[^\\\\/]*)`)
      .replaceAll(
        /{([^}]+)}/g,
        s => `(?:${s.replaceAll(",", "|")})`,
      )}${pattern.includes("/") ? "$" : `(?:$|${SEPARATOR})`}`,
    "i",
  )
}

export function matchConditions(
  pattern: string,
  filePath: string,
): { [key: string]: string } | undefined {
  if (/{{([^}]+)}}/g.test(pattern)) {
    const conditions = Array.from(pattern.matchAll(/{{([^}]+)}}/g), match => match[1])
    const groups = globToRegex(pattern).exec(filePath)?.groups
    if (groups) {
      return conditions.reduce<{ [key: string]: string }>((result, condition) => {
        result[condition] = groups[toIdentifier(condition)]
        return result
      }, {})
    }
  }
}

export function matchFile(pattern: string, filePath: string): boolean {
  return globToRegex(pattern).test(filePath)
}
