import { ID, indexBy, isDefined } from "@salinco/nice-utils"

import { CategoryID } from "@common/categories"
import { extractDependencies, extractRepositoryUrl, extractSupportUrl } from "../dbpf/packages"
import type { IndexerSource, IndexerSourceCategory, IndexerSourceID } from "../types"

const sourceId: IndexerSourceID = ID("simtropolis")

const origin = "https://community.simtropolis.com"

const categories: IndexerSourceCategory[] = [
  {
    id: ID("32-simpeg-plex-files"),
  },
  {
    categories: [CategoryID.CIVICS],
    id: ID("33-plex-custom-lots-mods"),
  },
  {
    categories: [CategoryID.WATERFRONT],
    id: ID("34-cdk-coastal-development-kit"),
  },
  {
    id: ID("35-mtp-mountain-theme-pack"),
  },
  {
    categories: [CategoryID.SPAM],
    id: ID("36-spam-simpeg-agricultural-mods"),
  },
  {
    id: ID("37-peg-utopian-series"),
  },
  {
    id: ID("64-simcitypolska-files"),
  },
  {
    id: ID("67-simcitybrasil-files"),
  },
  {
    id: ID("73-workingman-productions-wmp"),
  },
  {
    categories: [CategoryID.RESIDENTIAL],
    id: ID("101-residential"),
  },
  {
    categories: [CategoryID.COMMERCIAL],
    id: ID("102-commercial"),
  },
  {
    categories: [CategoryID.INDUSTRY],
    id: ID("103-industrial"),
  },
  {
    categories: [CategoryID.AGRICULTURE],
    id: ID("104-agricultural"),
  },
  {
    id: ID("105-building-sets"),
  },
  {
    categories: [],
    id: ID("106-civic-non-rci"),
  },
  {
    categories: [CategoryID.UTILITIES],
    id: ID("107-utilities"),
  },
  {
    categories: [CategoryID.PARKS],
    id: ID("108-parks-plazas"),
  },
  {
    categories: [CategoryID.WATERFRONT],
    id: ID("109-waterfront"),
  },
  {
    categories: [CategoryID.TRANSPORT],
    id: ID("110-transportation"),
  },
  {
    categories: [CategoryID.AUTOMATA],
    id: ID("111-automata"),
  },
  {
    categories: [CategoryID.GAMEPLAY],
    id: ID("112-gameplay-mods"),
  },
  {
    categories: [CategoryID.GRAPHICS],
    id: ID("113-graphical-mods"),
  },
  {
    categories: [CategoryID.CHEATS],
    id: ID("114-cheats"),
  },
  {
    id: ID("115-tools"),
  },
  {
    categories: [CategoryID.DEPENDENCIES],
    id: ID("118-dependencies"),
  },
  {
    categories: [CategoryID.DEPENDENCIES],
    id: ID("120-obsolete-legacy"),
  },
  {
    categories: [CategoryID.DLL],
    id: ID("122-dll-mods"),
  },
]

export const SIMTROPOLIS: IndexerSource = {
  categories: indexBy(categories, category => category.id),
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
  getDownloadUrl(assetId, variant) {
    const itemId = assetId.split("/")[1]
    const baseUrl = `${origin}/files/file/${itemId}/?do=download`
    return variant !== undefined ? `${baseUrl}&r=${variant}` : baseUrl
  },
  getEntries(html) {
    const items = html.querySelectorAll("div.cDownloadsCategoryTable li.ipsDataItem")

    return items.map(item => {
      const thumbnail = item.querySelector("[data-bg]")?.attributes["data-bg"]
      const title = item.querySelector(".ipsDataItem_title > span:last-of-type a")

      const itemUrl = title?.attributes.href
      const itemId = itemUrl?.match(/[/]file[/]([%\w-]+)[/]?$/)?.[1]
      const itemName = title?.textContent.trim()

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

      return {
        assetId: ID(`${sourceId}/${itemId}`),
        downloads: Number.parseInt(downloads || "0", 10) || undefined,
        lastModified: new Date(lastModified),
        name: itemName,
        owner: authorName ?? sourceId,
        thumbnail,
        url: new URL(itemUrl, origin).toString(),
      }
    })
  },
  getEntryDetails(html) {
    const description = html.querySelector("article section .ipsType_richText")?.innerHTML

    const images = html
      .querySelectorAll(".cDownloadsCarousel .ipsCarousel_item span")
      .map(e => e.attributes["data-fullURL"] || e.querySelector("img")?.attributes.src)
      .filter(isDefined)

    return {
      dependencies: description ? extractDependencies(description) : undefined,
      description: description ? `<body>${description}</body>` : undefined,
      images,
      repository: description ? extractRepositoryUrl(description) : undefined,
      support: description ? extractSupportUrl(description) : undefined,
      version: html.querySelector(".stex-title-version")?.textContent,
    }
  },
  getVariants(html) {
    const items = html.querySelector('[data-controller="downloads.front.view.download"]')
    if (!items) {
      throw Error("Missing variants")
    }

    const variants: { [variant: number]: string } = {}

    for (const item of items.querySelectorAll(".ipsDataItem")) {
      const filename = item.querySelector(".ipsDataItem_title")?.textContent
      const variant = item.querySelector("a")?.attributes.href.match(/&r=(\d+)/)?.[1]
      if (variant && filename) {
        variants[Number(variant)] = filename
      }
    }

    return variants
  },
  id: sourceId,
}
