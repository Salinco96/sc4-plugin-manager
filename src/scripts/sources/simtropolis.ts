import { IndexerCategory, IndexerSource } from "../types"

const sourceId = "simtropolis"

const origin = "https://community.simtropolis.com"

const categories: IndexerCategory[] = [
  {
    category: "dependencies",
    id: "32-simpeg-plex-files",
  },
  {
    category: "civics",
    id: "33-plex-custom-lots-mods",
  },
  {
    category: "waterfront",
    id: "34-cdk-coastal-development-kit",
  },
  {
    category: "dependencies",
    id: "35-mtp-mountain-theme-pack",
  },
  {
    category: "mods/spam",
    id: "36-spam-simpeg-agricultural-mods",
  },
  {
    category: "mods",
    id: "37-peg-utopian-series",
  },
  {
    category: "mods",
    id: "64-simcitypolska-files",
  },
  {
    category: "mods",
    id: "67-simcitybrasil-files",
  },
  {
    category: "mods",
    id: "73-workingman-productions-wmp",
  },
  {
    category: "residential",
    id: "101-residential",
  },
  {
    category: "commercial",
    id: "102-commercial",
  },
  {
    category: "industry",
    id: "103-industrial",
  },
  {
    category: "agriculture",
    id: "104-agricultural",
  },
  {
    category: "residential",
    id: "105-building-sets",
  },
  {
    category: "civics",
    id: "106-civic-non-rci",
  },
  {
    category: "utilities",
    id: "107-utilities",
  },
  {
    category: "parks",
    id: "108-parks-plazas",
  },
  {
    category: "waterfront",
    id: "109-waterfront",
  },
  {
    category: "transport",
    id: "110-transportation",
  },
  {
    category: "automata",
    id: "111-automata",
  },
  {
    category: "gameplay",
    id: "112-gameplay-mods",
  },
  {
    category: "graphics",
    id: "113-graphical-mods",
  },
  {
    category: "cheats",
    id: "114-cheats",
  },
  {
    category: "mods",
    id: "115-tools",
  },
  {
    category: "dependencies",
    id: "118-dependencies",
  },
  {
    category: "dependencies",
    id: "120-obsolete-legacy",
  },
  {
    category: "dll",
    id: "122-dll-mods",
  },
]

export const SIMTROPOLIS: IndexerSource = {
  categories,
  getCategoryPageCount(html) {
    const pageJump = html.querySelector("li.ipsPagination_pageJump a")
    const match = pageJump?.textContent.match(/page (\d+) of (\d+)/i)
    return match ? Number.parseInt(match[2], 10) : 1
  },
  getCategoryUrl(categoryId, page) {
    return `${origin}/files/category/${categoryId}/?sortby=file_updated&sortdirection=desc&page=${page}`
  },
  getCookies() {
    const ips4_IPSSessionFront = process.env.SIMTROPOLIS_IPS4_IPSSESSIONFRONT
    const ips4_member_id = process.env.SIMTROPOLIS_IPS4_MEMBER_ID

    if (!ips4_IPSSessionFront || !ips4_member_id) {
      throw Error("Missing Simtropolis credentials")
    }

    return {
      ips4_IPSSessionFront,
      ips4_member_id,
    }
  },
  getDownloadUrl(entryId, variant) {
    const itemId = entryId.split("/")[1]
    const baseUrl = `${origin}/files/file/${itemId}/?do=download`
    return variant ? `${baseUrl}&r=${variant}` : baseUrl
  },
  getEntries(html) {
    const items = html.querySelectorAll("div.cDownloadsCategoryTable li.ipsDataItem")

    return items.map(item => {
      const thumbnail = item.querySelector("[data-bg]")?.attributes["data-bg"]
      const title = item.querySelector(".ipsDataItem_title > span:last-of-type a")
      const itemName = title?.textContent.trim()
      const itemUrl = title?.attributes.href
      const itemId = itemUrl?.match(/[/]file[/]([%\w-]+)[/]?$/)?.[1]
      const author = item.querySelector(".ipsDataItem_main > p:first-of-type a")
      const authorName = author?.textContent.trim()
      const lastModified = item.querySelector("[datetime]")?.attributes.datetime
      const downloads = item
        .querySelector(".ipsDataItem_main > p:nth-of-type(2)")
        ?.textContent.match(/([\d,]+) downloads/)
        ?.at(0)
        ?.replaceAll(",", "")

      if (!lastModified) {
        throw Error(`Failed to extract last modified time for item ${items.indexOf(item) + 1}`)
      }

      if (!itemName) {
        throw Error(`Failed to extract name for item ${items.indexOf(item) + 1}`)
      }

      if (!itemUrl) {
        throw Error(`Failed to extract URL for ${itemName}`)
      }

      if (!itemId) {
        throw Error(`Failed to extract ID for ${itemName}`)
      }

      return [
        `${sourceId}/${itemId}`,
        {
          authors: [authorName ?? sourceId],
          downloads: Number.parseInt(downloads || "0", 10) || undefined,
          lastModified,
          name: itemName,
          thumbnail,
          url: itemUrl.startsWith(origin) ? itemUrl : `${origin}${itemUrl}`,
        },
      ]
    })
  },
  getEntryDetails(assetId, html) {
    const description = html.querySelector("article section .ipsType_richText")?.innerHTML

    const dependencies = Array.from(
      new Set([
        ...Array.from(
          description?.matchAll(/https:\/\/community.simtropolis.com\/files\/file\/([\w-]+)\/?/g) ??
            [],
        ).map(match => `simtropolis/${match[1]}`),
        ...Array.from(
          description?.matchAll(
            /https:\/\/www.sc4evermore.com\/index.php\/downloads\/download\/([\w-]+)\/([\w-]+)\/?/g,
          ) ?? [],
        ).map(match => `sc4evermore/${match[2]}`),
      ]),
    ).filter(dependencyId => dependencyId !== assetId)

    const images = html
      .querySelectorAll(".cDownloadsCarousel .ipsCarousel_item span")
      .map(e => e.attributes["data-fullURL"] || e.querySelector("img")?.attributes.src)
      .filter(Boolean) as string[]

    return {
      dependencies,
      description: description ? `<body>${description}</body>` : undefined,
      images,
      repository: description?.match(/https:\/\/github.com\/([\w-]+)\/([\w-]+)?/g)?.[0],
      version: html.querySelector(".stex-title-version")?.textContent,
    }
  },
  getVariants(html) {
    const items = html.querySelector('[data-controller="downloads.front.view.download"]')
    if (!items) {
      throw Error("Missing variants")
    }

    const variants: { [variant: string]: string } = {}

    for (const item of items.querySelectorAll(".ipsDataItem")) {
      const filename = item.querySelector(".ipsDataItem_title")?.textContent
      const variant = item.querySelector("a")?.attributes.href.match(/&r=(\w+)/)?.[1]
      if (variant && filename) {
        variants[variant] = filename
      }
    }

    return variants
  },
  id: sourceId,
}
