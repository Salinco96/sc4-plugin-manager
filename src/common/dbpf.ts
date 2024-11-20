import type { ExemplarData } from "./exemplars"
import { readHex, toHex } from "./utils/hex"

export type TGI = `${string}-${string}-${string}`

export function TGI(t: number, g: number, i: number): TGI {
  return `${toHex(t, 8)}-${toHex(g, 8)}-${toHex(i, 8)}`
}

export function parseTGI(tgi: TGI): [t: number, g: number, i: number] {
  return tgi.split("-").map(readHex) as [t: number, g: number, i: number]
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
  EXMP = "exmp",
  FSH = "fsh",
  JFIF = "jfif",
  PNG = "png",
  S3D = "s3d",
  XML = "xml",
  UNKNOWN = "unknown",
}

export type DBPFEntryData<T extends DBPFDataType = DBPFDataType> = {
  [DBPFDataType.BMP]: { base64: string }
  [DBPFDataType.EXMP]: ExemplarData
  [DBPFDataType.FSH]: never // TODO
  [DBPFDataType.JFIF]: { base64: string }
  [DBPFDataType.PNG]: { base64: string }
  [DBPFDataType.S3D]: never // TODO
  [DBPFDataType.XML]: { text: string }
  [DBPFDataType.UNKNOWN]: never // TODO
}[T]

const types = Object.values(DBPFFileType).reverse()
export function getFileType(id: TGI): DBPFFileType | undefined {
  return types.find(type => isType(id, type))
}

export function getDataType(id: TGI): DBPFDataType {
  if (isType(id, DBPFFileType.BMP)) {
    return DBPFDataType.BMP
  }

  if (isType(id, DBPFFileType.FSH)) {
    return DBPFDataType.FSH
  }

  if (isType(id, DBPFFileType.JFIF)) {
    return DBPFDataType.JFIF
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

export function getFileTypeLabel(id: TGI): string {
  const type = getFileType(id)

  if (!type) {
    return "Unknown"
  }

  return {
    [DBPFFileType.BMP]: "BMP",
    [DBPFFileType.COHORT]: "Cohort",
    [DBPFFileType.DIR]: "DIR",
    [DBPFFileType.EXEMPLAR]: "Exemplar",
    [DBPFFileType.EXEMPLAR_LOT_CONFIG]: "Exemplar - Lot Config",
    [DBPFFileType.FSH]: "FSH",
    [DBPFFileType.FSH_TEXTURE]: "FSH - Texture",
    [DBPFFileType.JFIF]: "JFIF",
    [DBPFFileType.LD]: "Lot Data",
    [DBPFFileType.PNG]: "PNG",
    [DBPFFileType.PNG_BUTTONS]: "PNG - Button",
    [DBPFFileType.PNG_LE_IMAGES]: "PNG - Lot Editor Image",
    [DBPFFileType.PNG_LOT_PICTURES]: "PNG - Lot Picture",
    [DBPFFileType.PNG_MENU_ICONS]: "PNG - Menu Icon",
    [DBPFFileType.PNG_REGION_VIEW_TILES]: "PNG - Region View Tile",
    [DBPFFileType.PNG_UDRIVEIT_ICONS]: "PNG - UDriveIt Icon",
    [DBPFFileType.PNG_UI]: "PNG - UI",
    [DBPFFileType.PNG_UI_IMAGES]: "PNG - UI Image",
    [DBPFFileType.S3D]: "S3D",
    [DBPFFileType.XML]: "XML",
  }[type]
}
