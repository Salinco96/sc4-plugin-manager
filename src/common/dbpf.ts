import { type ID, type integer, isString, parseHex, toHex } from "@salinco/nice-utils"
import type { ExemplarData } from "./exemplars"
import { bitMask } from "./utils/types"
import type { TextureID } from "./variants"

export type TypeID = ID<string, { __kind: "Group" }>
export type GroupID = ID<string, { __kind: "Group" }>
export type InstanceID<T = unknown> = ID<string, T & { __kind: "Group" }>

export type TGI = `${TypeID}-${GroupID}-${InstanceID}`

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

export function isType(id: TGI, type: string): boolean {
  return new RegExp(`^${type}`, "i").test(id)
}

export const TypeID = {
  COHORT: "05342861" as TypeID,
  DIR: "e86b1eef" as TypeID,
  EXEMPLAR: "6534284a" as TypeID,
  FSH: "7ab50e44" as TypeID,
  LD: "6be74c60" as TypeID,
  LTEXT: "2026960b" as TypeID,
  PNG: "856ddbac" as TypeID,
  SAVE_PNG: "8a2482b9" as TypeID,
  S3D: "5ad0e817" as TypeID,
}

export const GroupID = {
  DIR: "e86b1eef" as GroupID,
  FSH_TEXTURE: "0986135e" as GroupID,
  LOT_CONFIG: "a8fbd372" as GroupID,
  PNG_BUTTONS: "00000001" as GroupID,
  PNG_LE_IMAGES: "8b6b7857" as GroupID,
  PNG_LOT_PICTURES: "ebdd10a4" as GroupID,
  PNG_MENU_ICONS: "6a386d26" as GroupID,
  PNG_REGION_VIEW_TILES: "6a1eed2c" as GroupID,
  PNG_UDRIVEIT_ICONS: "4c06f888" as GroupID,
  PNG_UI: "1abe787d" as GroupID,
  PNG_UI_IMAGES: "46a006b0" as GroupID,
}

export const InstanceID = {
  DIR: "286b1f03" as InstanceID,
  S3D: "00030000" as InstanceID,
}

export const DBPFFileType = {
  BMP: "6677800.",
  COHORT: TypeID.COHORT,
  DIR: `${TypeID.DIR}-${GroupID.DIR}-${InstanceID.DIR}`,
  EXEMPLAR: TypeID.EXEMPLAR,
  EXEMPLAR_LOT_CONFIG: `${TypeID.EXEMPLAR}-${GroupID.LOT_CONFIG}`,
  FSH: TypeID.FSH,
  FSH_TEXTURE: `${TypeID.FSH}-${GroupID.FSH_TEXTURE}`,
  JFIF: "7480710.",
  LD: TypeID.LD,
  LTEXT: TypeID.LTEXT,
  PNG: TypeID.PNG,
  PNG_BUTTONS: `${TypeID.PNG}-${GroupID.PNG_BUTTONS}`,
  PNG_LE_IMAGES: `${TypeID.PNG}-${GroupID.PNG_LE_IMAGES}`,
  PNG_LOT_PICTURES: `${TypeID.PNG}-${GroupID.PNG_LOT_PICTURES}`,
  PNG_MENU_ICONS: `${TypeID.PNG}-${GroupID.PNG_MENU_ICONS}`,
  PNG_REGION_VIEW_TILES: `${TypeID.PNG}-${GroupID.PNG_REGION_VIEW_TILES}`,
  PNG_UDRIVEIT_ICONS: `${TypeID.PNG}-${GroupID.PNG_UDRIVEIT_ICONS}`,
  PNG_UI: `${TypeID.PNG}-${GroupID.PNG_UI}`,
  PNG_UI_IMAGES: `${TypeID.PNG}-${GroupID.PNG_UI_IMAGES}`,
  SAVE_PNG: TypeID.SAVE_PNG,
  S3D: TypeID.S3D,
  XML: "8877760.",
} as const

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

  if (isType(id, DBPFFileType.PNG) || isType(id, DBPFFileType.SAVE_PNG)) {
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

export function getTextureIdRange(instanceId: number | string): [TextureID, TextureID] {
  const id = isString(instanceId) ? parseHex(instanceId) : instanceId

  // 0, 1, 2, 3, 4 -> 0
  // 5, 6, 7, 8, 9 -> 5
  // a, b, c, d, e -> a
  // f -> f (should not happen!)
  const start = bitMask(id, 0xfffffff0) + Math.floor(bitMask(id, 0x0000000f) / 5) * 5

  return [toHex(start, 8) as TextureID, toHex(start + 4, 8) as TextureID]
}
