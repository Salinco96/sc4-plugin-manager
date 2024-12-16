import { type integer, isString, parseHex, toHex } from "@salinco/nice-utils"
import type { ExemplarData } from "./exemplars"
import { bitMask } from "./utils/types"

export type TGI = `${string}-${string}-${string}`

export function TGI(t: number, g: number, i: number): TGI {
  return [t, g, i].map(id => toHex(id, 8)).join("-") as TGI
}

export function parseTGI(tgi: TGI): [t: integer, g: integer, i: integer] {
  return tgi.split("-").map(parseHex) as [t: integer, g: integer, i: integer]
}

export type DBPFEntry<T extends DBPFDataType = DBPFDataType> = {
  [S in DBPFDataType]: {
    data?: DBPFEntryData<S>
    id: TGI
    offset: number
    original?: DBPFEntryData<S>
    size: number
    type: S
    /** Only defined if compressed */
    uncompressed?: number
  }
}[T]

export interface DBPFFile {
  createdAt: string
  entries: {
    [entryId in TGI]?: DBPFEntry
  }
  modifiedAt: string
}

export function isDBPF(filePath: string): boolean {
  return /\.(dat|sc4desc|sc4lot|sc4model)$/i.test(filePath)
}

export function isCompressed(entry: DBPFEntry): boolean {
  return entry.uncompressed !== undefined
}

export function isType(id: TGI, type: DBPFFileType): boolean {
  return new RegExp(`^${type}`, "i").test(id)
}

export enum DBPFFileType {
  BMP = "6677800.",
  COHORT = "05342861",
  DIR = "e86b1eef-e86b1eef-286b1f03",
  EXEMPLAR = "6534284a",
  EXEMPLAR_LOT_CONFIG = "6534284a-a8fbd372",
  FSH = "7ab50e44",
  FSH_TEXTURE = "7ab50e44-0986135e",
  JFIF = "7480710.",
  LD = "6be74c60",
  LTEXT = "2026960b",
  PNG = "856ddbac",
  PNG_BUTTONS = "856ddbac-00000001",
  PNG_LE_IMAGES = "856ddbac-8b6b7857",
  PNG_LOT_PICTURES = "856ddbac-ebdd10a4",
  PNG_MENU_ICONS = "856ddbac-6a386d26",
  PNG_REGION_VIEW_TILES = "856ddbac-6a1eed2c",
  PNG_UDRIVEIT_ICONS = "856ddbac-4c06f888",
  PNG_UI = "856ddbac-1abe787d",
  PNG_UI_IMAGES = "856ddbac-46a006b0",
  S3D = "5ad0e817",
  XML = "8877760.",
}

export enum DBPFDataType {
  BMP = "bmp",
  DIR = "dir",
  EXMP = "exmp",
  FSH = "fsh",
  JFIF = "jfif",
  LD = "ld",
  LTEXT = "ltext",
  PNG = "png",
  S3D = "s3d",
  XML = "xml",
  UNKNOWN = "unknown",
}

export type DBPFEntryData<T extends DBPFDataType = DBPFDataType> = {
  [DBPFDataType.BMP]: { base64: string }
  [DBPFDataType.DIR]: never
  [DBPFDataType.EXMP]: ExemplarData
  [DBPFDataType.FSH]: never // TODO
  [DBPFDataType.JFIF]: { base64: string }
  [DBPFDataType.LD]: never // TODO
  [DBPFDataType.LTEXT]: { text: string }
  [DBPFDataType.PNG]: { base64: string }
  [DBPFDataType.S3D]: never // TODO
  [DBPFDataType.XML]: { text: string }
  [DBPFDataType.UNKNOWN]: never // TODO
}[T]

export function getDataType(id: TGI): DBPFDataType {
  if (isType(id, DBPFFileType.BMP)) {
    return DBPFDataType.BMP
  }

  if (isType(id, DBPFFileType.DIR)) {
    return DBPFDataType.DIR
  }

  if (isType(id, DBPFFileType.FSH)) {
    return DBPFDataType.FSH
  }

  if (isType(id, DBPFFileType.JFIF)) {
    return DBPFDataType.JFIF
  }

  if (isType(id, DBPFFileType.LD)) {
    return DBPFDataType.LD
  }

  if (isType(id, DBPFFileType.LTEXT)) {
    return DBPFDataType.LTEXT
  }

  if (isType(id, DBPFFileType.PNG)) {
    return DBPFDataType.PNG
  }

  if (isType(id, DBPFFileType.S3D)) {
    return DBPFDataType.S3D
  }

  if (isType(id, DBPFFileType.XML)) {
    return DBPFDataType.XML
  }

  if (isType(id, DBPFFileType.COHORT) || isType(id, DBPFFileType.EXEMPLAR)) {
    return DBPFDataType.EXMP
  }

  return DBPFDataType.UNKNOWN
}

export function getTextureIdRange(instanceId: number | string): [start: string, end: string] {
  const id = isString(instanceId) ? parseHex(instanceId) : instanceId
  const digit5 = bitMask(id, 0x0000f000)
  const digit8 = bitMask(id, 0x0000000f)

  // 0, 1, 2, 3 -> 0
  // others -> unchanged
  const baseDigit5 = digit5 > 0x00003000 ? digit5 : 0

  // 0, 1, 2, 3, 4 -> 0
  // 5, 6, 7, 8, 9 -> 5
  // a, b, c, d, e -> a
  // f -> f
  const baseDigit8 = digit8 > 0x0000000e ? digit8 : Math.floor(digit8 / 5) * 5

  const start = bitMask(id, 0xffff0ff0) + baseDigit5 + baseDigit8

  return [toHex(start, 8), toHex(start + 4, 8)]
}
