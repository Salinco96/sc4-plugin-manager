import TurndownService from "@joplin/turndown"
import { gfm } from "@joplin/turndown-plugin-gfm"
import { HTMLElement, parse as parseHTML } from "node-html-parser"

export async function readHTML(response: Response): Promise<HTMLElement> {
  const body = await response.text()
  return parseHTML(body)
}

export function toID(name: string): string {
  return name.toLowerCase().replace(/\W+/g, " ").trim().replaceAll(" ", "-")
}

export async function wait(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

const turndown = new TurndownService({
  bulletListMarker: "-",
  emDelimiter: "*",
  headingStyle: "atx",
})

turndown.addRule("remove-simtropolis-popular-icon", {
  filter(node) {
    return (
      node.tagName.toLowerCase() === "img" &&
      node.getAttribute("src") === "https://www.simtropolis.com/library/misc/big-heart-icon.png"
    )
  },
  replacement() {
    return ""
  },
})

turndown.addRule("resolve-full-href", {
  filter(node) {
    return (
      node.tagName.toLowerCase() === "a" && !!node.getAttribute("href")?.startsWith("/index.php/")
    )
  },
  replacement(content, node) {
    const href = node instanceof HTMLElement ? node.getAttribute("href") : undefined

    if (href && href !== content) {
      return `[${content}](https://www.sc4evermore.com${href})`
    }

    return content
  },
})

turndown.addRule("remove-image-link", {
  filter(node) {
    return (
      node.tagName.toLowerCase() === "a" &&
      node.childNodes.length === 1 &&
      node.firstElementChild?.tagName.toLowerCase() === "img"
    )
  },
  replacement(content) {
    return content
  },
})

turndown.addRule("replace-br-tag", {
  filter: "br",
  replacement() {
    return "\n\n"
  },
})

turndown.use(gfm)

export function htmlToMd(html: string): string {
  return turndown
    .turndown(
      html
        .replace(/<(\w+) ?\/>/g, "<$1></$1>")
        .replace(/\u00a0/g, " ")
        .replace(/\u2013/g, "-")
        .replace(/\u2019/g, "'"),
    )
    .replace(/ +\n/g, "\n")
}
