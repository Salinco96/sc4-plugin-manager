const CONDITION_REGEX = /{{([^}]+)}}/g
const SEPARATOR = "[\\\\\\/]"
const NOT_SEPARATOR = SEPARATOR.replaceAll("[", "[^")

export function globToRegex(pattern: string): RegExp {
  return new RegExp(
    `${pattern.includes("/") ? "^" : `(?:^|${SEPARATOR})`}${pattern
      .replaceAll(/[$()|+.^]/g, s => `\\${s}`)
      .replaceAll("/", SEPARATOR)
      .replaceAll(/[*]+/g, s => `${s.length === 1 ? NOT_SEPARATOR : "."}*`)
      .replaceAll("?", `${NOT_SEPARATOR}?`)
      .replaceAll(CONDITION_REGEX, "(?<$1>[^\\\\/]*)")
      .replaceAll(
        /{([^}]+)}/g,
        s => `(?:${s.replaceAll(",", "|")})`,
      )}${pattern.includes("/") ? "$" : `(?:$|${SEPARATOR})`}`,
    "i",
  )
}

export function matchConditions(
  pattern: string,
  filename: string,
): { [key: string]: string } | undefined {
  if (CONDITION_REGEX.test(pattern)) {
    return globToRegex(pattern).exec(filename)?.groups
  }
}

export function matchFile(pattern: string, filename: string): boolean {
  return globToRegex(pattern).test(filename)
}
