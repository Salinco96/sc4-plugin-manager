import { IndexerCategory, IndexerSource } from "../types"

const sourceId = "simtropolis"

const origin = "https://community.simtropolis.com"

const categories: IndexerCategory[] = [
  {
    category: 100,
    id: "32-simpeg-plex-files",
  },
  {
    category: 600,
    id: "33-plex-custom-lots-mods",
  },
  {
    category: 750,
    id: "34-cdk-coastal-development-kit",
  },
  {
    category: 100,
    id: "35-mtp-mountain-theme-pack",
  },
  {
    category: 411,
    id: "36-spam-simpeg-agricultural-mods",
  },
  {
    category: 600,
    id: "37-peg-utopian-series",
  },
  {
    category: 0,
    id: "64-simcitypolska-files",
  },
  {
    category: 0,
    id: "67-simcitybrasil-files",
  },
  {
    category: 0,
    id: "73-workingman-productions-wmp",
  },
  {
    category: 200,
    id: "101-residential",
  },
  {
    category: 300,
    id: "102-commercial",
  },
  {
    category: 400,
    id: "103-industrial",
  },
  {
    category: 410,
    id: "104-agricultural",
  },
  {
    category: 200,
    id: "105-building-sets",
  },
  {
    category: 600,
    id: "106-civic-non-rci",
  },
  {
    category: 500,
    id: "107-utilities",
  },
  {
    category: 660,
    id: "108-parks-plazas",
  },
  {
    category: 750,
    id: "109-waterfront",
  },
  {
    category: 700,
    id: "110-transportation",
  },
  {
    category: 790,
    id: "111-automata",
  },
  {
    category: 30,
    id: "112-gameplay-mods",
  },
  {
    category: 20,
    id: "113-graphical-mods",
  },
  {
    category: 10,
    id: "114-cheats",
  },
  {
    category: 60,
    id: "115-tools",
  },
  {
    category: 100,
    id: "118-dependencies",
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
