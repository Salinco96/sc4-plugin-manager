import { type ID, isString, parseHex, toHex } from "@salinco/nice-utils"
import type { ExemplarData } from "./exemplars"
import { split } from "./utils/string"
import { bitMask } from "./utils/types"
import type { TextureID } from "./variants"

export type TypeID = ID<string, { __kind: "Group" }>
export type GroupID = ID<string, { __kind: "Group" }>
export type InstanceID<T = unknown> = ID<string, T & { __kind: "Group" }>

export type TGI = `${TypeID}-${GroupID}-${InstanceID}`

export function TGI(t: number, g: number, i: number): TGI {
  return [t, g, i].map(id => toHex(id, 8)).join("-") as TGI
}

export function parseTGI(tgi: TGI): [t: number, g: number, i: number] {
  return tgi.split("-").map(parseHex) as number[] as [t: number, g: number, i: number]
}

export enum DBPFDataType {
  BMP = "bmp",
  DIR = "dir",
  EXEMPLAR = "exemplar",
  FSH = "fsh",
  JFIF = "jfif",
  LD = "ld",
  LTEXT = "ltext",
  PNG = "png",
  S3D = "s3d",
  XML = "xml",
  OTHER = "other",
}

export type DBPFEntryData<T extends DBPFDataType = DBPFDataType> = {
  [K in T]: {
    [DBPFDataType.BMP]: { base64: string }
    [DBPFDataType.DIR]: never
    [DBPFDataType.EXEMPLAR]: ExemplarData
    [DBPFDataType.FSH]: never // todo
    [DBPFDataType.JFIF]: { base64: string }
    [DBPFDataType.LD]: never // todo
    [DBPFDataType.LTEXT]: { text: string }
    [DBPFDataType.PNG]: { base64: string }
    [DBPFDataType.S3D]: never // todo
    [DBPFDataType.XML]: { text: string }
    [DBPFDataType.OTHER]: never // todo
  }[K]
}[T]

export type DBPFEntryInfo<T extends DBPFDataType = DBPFDataType> = {
  [K in T]: {
    data?: DBPFEntryData<K>
    id: TGI
    offset: number
    original?: DBPFEntryData<K>
    size: number
    type: K
    uncompressed?: number
  }
}[T]

/** Same as {@link DBPFEntryInfo}, except data is always loaded. */
export type DBPFLoadedEntryInfo<T extends DBPFDataType = DBPFDataType> = DBPFEntryInfo<T> & {
  data: DBPFEntryData<T>
}

export type DBPFInfo = {
  createdAt: Date
  entries: { [tgi in TGI]?: DBPFEntryInfo }
  modifiedAt: Date
}

export const TypeID = {
  BMP0: "66778000" as TypeID,
  BMP1: "66778001" as TypeID,
  COHORT: "05342861" as TypeID,
  DIR: "e86b1eef" as TypeID,
  EXEMPLAR: "6534284a" as TypeID,
  FSH: "7ab50e44" as TypeID,
  JFIF0: "74807100" as TypeID,
  JFIF1: "74807101" as TypeID,
  LD: "6be74c60" as TypeID,
  LTEXT: "2026960b" as TypeID,
  PNG: "856ddbac" as TypeID,
  SAVE_PNG: "8a2482b9" as TypeID,
  S3D: "5ad0e817" as TypeID,
  XML0: "88777600" as TypeID,
  XML1: "88777601" as TypeID,
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

const TypeIDToDataType: {
  [type in TypeID]?: DBPFDataType
} = {
  [TypeID.BMP0]: DBPFDataType.BMP,
  [TypeID.BMP1]: DBPFDataType.BMP,
  [TypeID.COHORT]: DBPFDataType.EXEMPLAR,
  [TypeID.DIR]: DBPFDataType.DIR,
  [TypeID.EXEMPLAR]: DBPFDataType.EXEMPLAR,
  [TypeID.FSH]: DBPFDataType.FSH,
  [TypeID.JFIF0]: DBPFDataType.JFIF,
  [TypeID.JFIF1]: DBPFDataType.JFIF,
  [TypeID.LD]: DBPFDataType.LD,
  [TypeID.LTEXT]: DBPFDataType.LTEXT,
  [TypeID.PNG]: DBPFDataType.PNG,
  [TypeID.S3D]: DBPFDataType.S3D,
  [TypeID.XML0]: DBPFDataType.XML,
  [TypeID.XML1]: DBPFDataType.XML,
  [TypeID.SAVE_PNG]: DBPFDataType.PNG,
}

export function getDataType(tgi: TGI): DBPFDataType {
  const [typeId] = split(tgi, "-")
  return TypeIDToDataType[typeId] ?? DBPFDataType.OTHER
}

export function isCompressed(entry: DBPFEntryInfo): boolean {
  return entry.uncompressed !== undefined
}

export function isDBPF(filePath: string): boolean {
  return /\.(dat|sc4desc|sc4lot|sc4model)$/i.test(filePath)
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
