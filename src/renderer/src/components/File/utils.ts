import type { TFunction } from "i18next"
import type { Namespace } from "i18next"

import { DBPFDataType, type DBPFEntry, DBPFFileType, GroupID, isType } from "@common/dbpf"
import { ExemplarType, getExemplarType } from "@common/exemplars"
import { split } from "@common/utils/string"

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
  const groupId = split(entry.id, "-")[1]

  if (entry.type === DBPFDataType.FSH) {
    switch (groupId) {
      case GroupID.FSH_TEXTURE:
        return `${label} - ${t("fsh.texture", { ns: "DBPFEntryType" })}`
    }
  }

  if (entry.type === DBPFDataType.PNG) {
    switch (groupId) {
      case GroupID.PNG_BUTTONS:
        return `${label} - ${t("png.button", { ns: "DBPFEntryType" })}`
      case GroupID.PNG_LE_IMAGES:
        return `${label} - ${t("png.le-image", { ns: "DBPFEntryType" })}`
      case GroupID.PNG_LOT_PICTURES:
        return `${label} - ${t("png.lot-image", { ns: "DBPFEntryType" })}`
      case GroupID.PNG_MENU_ICONS:
        return `${label} - ${t("png.menu-icon", { ns: "DBPFEntryType" })}`
      case GroupID.PNG_REGION_VIEW_TILES:
        return `${label} - ${t("png.region-view-tile", { ns: "DBPFEntryType" })}`
      case GroupID.PNG_UDRIVEIT_ICONS:
        return `${label} - ${t("png.udrive-icon", { ns: "DBPFEntryType" })}`
      case GroupID.PNG_UI:
        return `${label} - ${t("png.ui", { ns: "DBPFEntryType" })}`
      case GroupID.PNG_UI_IMAGES:
        return `${label} - ${t("png.ui-image", { ns: "DBPFEntryType" })}`
    }
  }

  return label
}
