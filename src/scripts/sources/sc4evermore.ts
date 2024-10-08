import { IndexerCategory, IndexerSource } from "../types"

const sourceId = "sc4evermore"

const origin = "https://www.sc4evermore.com"

const categories: IndexerCategory[] = [
  {
    category: "mods/nam",
    id: "6-network-addon-mod-nam",
  },
  {
    category: "residential",
    id: "11-residential",
  },
  {
    category: "commercial",
    id: "12-commercial",
  },
  {
    category: "industry",
    id: "13-industrial",
  },
  {
    category: "parks",
    id: "14-parks",
  },
  {
    category: "utilities",
    id: "15-utility",
  },
  {
    category: "civics",
    id: "16-civic",
  },
  {
    category: "rewards",
    id: "18-reward",
  },
  {
    category: "transport",
    id: "19-transportation",
  },
  {
    category: "landmarks",
    id: "20-ploppable",
  },
  {
    category: "landmarks",
    id: "21-other",
  },
  {
    category: "dependencies",
    id: "22-dependencies",
  },
  {
    category: "transport/mods",
    id: "23-transportation-mods",
  },
  {
    category: "mmps/flora",
    id: "25-flora-fauna-and-mayor-mode-ploppables",
  },
  {
    category: "gameplay",
    id: "26-gameplay-mods",
  },
  {
    category: "terrains",
    id: "37-terrain-mods-and-tree-controllers",
  },
  {
    category: "mods",
    id: "38-other-mods",
  },
  {
    category: "mods",
    id: "40-maxis",
  },
  {
    category: "automata",
    id: "41-automata-mods",
  },
  {
    category: "mods/dll",
    id: "42-dll-mods",
  },
  {
    category: "agriculture",
    id: "43-agriculture",
  },
]

export const SC4EVERMORE: IndexerSource = {
  categories,
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
  getDownloadUrl(entryId, variant) {
    if (variant) {
      throw Error(`${sourceId} does not have variants!`)
    }

    const itemId = entryId.split("/")[1]
    return `${origin}/index.php/downloads?task=download.send&id=${itemId.replace("-", ":")}`
  },
  getEntries(html) {
    const items = html.querySelectorAll(".jd_download_url")

    return items.map(item => {
      const thumbnail = item.parentNode.nextElementSibling?.querySelector("img")?.attributes.src
      const title = item.previousElementSibling?.querySelector("b a")
      const itemName = title?.textContent.trim()
      const itemUrl = title?.attributes.href
      const itemId = itemUrl?.split("/").at(-1)
      const authorName =
        item.parentNode.previousElementSibling?.textContent.match(
          /original author:\s*(\w+)/i,
        )?.[1] ??
        item.parentNode.previousElementSibling?.previousElementSibling?.textContent.match(
          /original author:\s*(\w+)/i,
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
    const description = html.querySelector(".jd_main")?.innerHTML

    const dependencies = Array.from(
      new Set([
        ...Array.from(
          description?.matchAll(/https:\/\/community.simtropolis.com\/files\/file\/([\w-]+)\/?/g) ??
            [],
        ).map(match => `simtropolis/${match[1]}`),
        ...Array.from(
          description?.matchAll(
            /(https:\/\/www.sc4evermore.com)?\/index.php\/downloads\/download\/([\w-]+)\/([\w-]+)\/?/g,
          ) ?? [],
        ).map(match => `sc4evermore/${match[3]}`),
      ]),
    ).filter(dependencyId => dependencyId !== assetId)

    const images = html.querySelectorAll(".jd_main img").map(img => img.attributes.src)

    return {
      dependencies,
      description: description ? `<body>${description}</body>` : undefined,
      images,
      repository: description?.match(/https:\/\/github.com\/([\w-]+)\/([\w-]+)?/g)?.[0],
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
