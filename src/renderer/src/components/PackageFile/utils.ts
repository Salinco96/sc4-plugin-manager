import type { TFunction } from "i18next"
import type { Namespace } from "i18next"

import { DBPFDataType, type DBPFEntry, DBPFFileType, isType, parseTGI } from "@common/dbpf"
import { ExemplarType, getExemplarType } from "@common/exemplars"

// Keep in dispay order
export enum DBPFEntryCategory {
  EXEMPLARS = "exemplars",
  IMAGES = "images",
  MODELS = "models",
  TEXTURES = "textures",
  OTHERS = "others",
}

export function getDBPFEntryCategory(entry: DBPFEntry): DBPFEntryCategory | null {
  switch (entry.type) {
    // Hide DIR file
    case DBPFDataType.DIR:
      return null
    case DBPFDataType.EXMP:
      return DBPFEntryCategory.EXEMPLARS
    case DBPFDataType.BMP:
    case DBPFDataType.JFIF:
    case DBPFDataType.PNG:
      return DBPFEntryCategory.IMAGES
    case DBPFDataType.S3D:
      return DBPFEntryCategory.MODELS
    case DBPFDataType.FSH:
      return DBPFEntryCategory.TEXTURES
    default:
      return DBPFEntryCategory.OTHERS
  }
}

export function getDBPFEntryCategoryLabel(
  t: TFunction<Namespace>,
  category: DBPFEntryCategory,
  count: number,
): string {
  return t(category, { count, ns: "DBPFEntryCategory" })
}

export function getDBPFEntryLabel(t: TFunction<Namespace>, entry: DBPFEntry): string {
  if (entry.type === DBPFDataType.EXMP) {
    const isCohort = isType(entry.id, DBPFFileType.COHORT)
    const label = t(isCohort ? "cohort" : "exemplar", { ns: "DBPFEntryType" })
    const exemplarType = getExemplarType(entry.id, entry.data)

    if (exemplarType) {
      const type = ExemplarType[exemplarType] as keyof typeof ExemplarType
      return `${label} - ${t(type ?? "Unknown", { ns: "ExemplarType" })}`
    }

    return label
  }

  const label = t(entry.type, { ns: "DBPFEntryType" })
  const groupId = parseTGI(entry.id)[1]

  if (entry.type === DBPFDataType.FSH) {
    // TODO: Constants
    switch (groupId) {
      case 0x0986135e:
        return `${label} - ${t("fsh.texture", { ns: "DBPFEntryType" })}`
    }
  }

  if (entry.type === DBPFDataType.PNG) {
    // TODO: Constants
    const groupId = parseTGI(entry.id)[1]
    switch (groupId) {
      case 0x00000001:
        return `${label} - ${t("png.button", { ns: "DBPFEntryType" })}`
      case 0x8b6b7857:
        return `${label} - ${t("png.le-image", { ns: "DBPFEntryType" })}`
      case 0xebdd10a4:
        return `${label} - ${t("png.lot-image", { ns: "DBPFEntryType" })}`
      case 0x6a386d26:
        return `${label} - ${t("png.menu-icon", { ns: "DBPFEntryType" })}`
      case 0x6a1eed2c:
        return `${label} - ${t("png.region-view-tile", { ns: "DBPFEntryType" })}`
      case 0x4c06f888:
        return `${label} - ${t("png.udrive-icon", { ns: "DBPFEntryType" })}`
      case 0x1abe787d:
        return `${label} - ${t("png.ui", { ns: "DBPFEntryType" })}`
      case 0x46a006b0:
        return `${label} - ${t("png.ui-image", { ns: "DBPFEntryType" })}`
    }
  }

  return label
}
