const lastWordRegex = /\s*[,;]?\s*([^\s,;]+)\s*$/

export function getLastWord(search: string): string {
  return search.match(lastWordRegex)?.[1] ?? ""
}

export function getStartOfWordSearchRegex(search: string): RegExp {
  return RegExp(`\\b${search.replace(/\W/g, "\\$&")}`, "i")
}

export function removeLastWord(search: string): string {
  return search.replace(lastWordRegex, "")
}
