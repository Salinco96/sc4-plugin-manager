import { ID, indexBy } from "@salinco/nice-utils"

import { CategoryID } from "@common/categories"
import { extractDependencies, extractRepositoryUrl, extractSupportUrl } from "../dbpf/packages"
import type { IndexerSource, IndexerSourceCategory, IndexerSourceID } from "../types"

const sourceId: IndexerSourceID = ID("sc4evermore")

const origin = "https://www.sc4evermore.com"

const categories: IndexerSourceCategory[] = [
  {
    categories: [CategoryID.MODS, CategoryID.NAM],
    id: ID("6-network-addon-mod-nam"),
  },
  {
    categories: [CategoryID.RESIDENTIAL],
    id: ID("11-residential"),
  },
  {
    categories: [CategoryID.COMMERCIAL],
    id: ID("12-commercial"),
  },
  {
    categories: [CategoryID.INDUSTRY],
    id: ID("13-industrial"),
  },
  {
    categories: [CategoryID.PARKS],
    id: ID("14-parks"),
  },
  {
    categories: [CategoryID.UTILITIES],
    id: ID("15-utility"),
  },
  {
    categories: [CategoryID.CIVICS],
    id: ID("16-civic"),
  },
  {
    categories: [CategoryID.REWARDS],
    id: ID("18-reward"),
  },
  {
    categories: [CategoryID.TRAM],
    id: ID("19-transportation"),
  },
  {
    categories: [CategoryID.LANDMARKS],
    id: ID("20-ploppable"),
  },
  {
    id: ID("21-other"),
  },
  {
    categories: [CategoryID.DEPENDENCIES],
    id: ID("22-dependencies"),
  },
  {
    categories: [CategoryID.TRANSPORT],
    id: ID("23-transportation-mods"),
  },
  {
    categories: [CategoryID.MMPS, CategoryID.FLORA],
    id: ID("25-flora-fauna-and-mayor-mode-ploppables"),
  },
  {
    categories: [CategoryID.MODS, CategoryID.GAMEPLAY],
    id: ID("26-gameplay-mods"),
  },
  {
    categories: [CategoryID.TERRAINS],
    id: ID("37-terrain-mods-and-tree-controllers"),
  },
  {
    categories: [CategoryID.MODS],
    id: ID("38-other-mods"),
  },
  {
    id: ID("40-maxis"),
  },
  {
    categories: [CategoryID.AUTOMATA],
    id: ID("41-automata-mods"),
  },
  {
    categories: [CategoryID.MODS, CategoryID.DLL],
    id: ID("42-dll-mods"),
  },
  {
    categories: [CategoryID.AGRICULTURE],
    id: ID("43-agriculture"),
  },
]

export const SC4EVERMORE: IndexerSource = {
  categories: indexBy(categories, category => category.id),
  getCategoryPageCount(html) {
    const pageJump = html.querySelector(".jd_cats_subheader")
    const match = pageJump?.textContent.match(/page (\d+) of (\d+)/i)
    return match ? Number.parseInt(match[2], 10) : 1
  },
  getCategoryUrl(categoryId, page) {
    return `${origin}/index.php/downloads/category/${categoryId}?filter_order=created&filter_order_Dir=desc&start=${(page - 1) * 20}`
  },
  getCookies() {
    return {}
  },
  getDownloadUrl(assetId, variant) {
    if (variant !== undefined) {
      throw Error(`${sourceId} does not have variants!`)
    }

    const itemId = assetId.split("/")[1]
    return `${origin}/index.php/downloads?task=download.send&id=${itemId.replace("-", ":")}`
  },
  getEntries(html) {
    const items = html.querySelectorAll(".jd_download_url")

    return items.map(item => {
      const thumbnail = item.parentNode.nextElementSibling?.querySelector("img")?.attributes.src
      const title = item.previousElementSibling?.querySelector("b a")

      const itemUrl = title?.attributes.href
      const itemId = itemUrl?.split("/").at(-1)
      const itemName = title?.textContent.trim()

      const authorName =
        item.parentNode.previousElementSibling?.textContent.match(
          /original author:\s*(\S+)/i,
        )?.[1] ??
        item.parentNode.previousElementSibling?.previousElementSibling?.textContent.match(
          /original author:\s*(\S+)/i,
        )?.[1]

      const fields = item.parentNode.nextElementSibling?.querySelectorAll(".jd_field_row_compact")

      const lastModified = fields
        ?.find(field => field.querySelector(".jd_field_title")?.textContent.match(/changed/i))
        ?.querySelector(".jd_field_value_compact")?.textContent

      const downloads = fields
        ?.find(field => field.querySelector(".jd_field_title")?.textContent.match(/downloads/i))
        ?.querySelector(".jd_field_value_compact")
        ?.textContent.replaceAll(",", "")

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
    const description = html.querySelector(".jd_main")?.innerHTML

    const images = html.querySelectorAll(".jd_main img").map(img => img.attributes.src)

    return {
      dependencies: description ? extractDependencies(description) : undefined,
      description: description ? `<body>${description}</body>` : undefined,
      images,
      repository: description ? extractRepositoryUrl(description) : undefined,
      support: description ? extractSupportUrl(description) : undefined,
      version: html
        .querySelectorAll(".jd_field_row")
        ?.find(row => row.querySelector(".jd_field_title")?.textContent.match(/version/i))
        ?.querySelector(".jd_field_value")
        ?.textContent.match(/\d+[\w.-]*|\d+ rev\d+[\w.-]*|lex version/i)
        ?.at(0)
        ?.replace(/lex version/i, "1")
        ?.replace(/\s+/g, "-"),
    }
  },
  getVariants() {
    throw Error(`${sourceId} does not have variants!`)
  },
  id: sourceId,
}
