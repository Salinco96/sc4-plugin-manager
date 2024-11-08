import { i18n } from "./i18n"
import { PackageID } from "./packages"
import { PackageWarning } from "./types"

export interface Warning {
  id: string
  message: string
  packageIds: PackageID[]
  title: string
}

export function getWarningId(warning: PackageWarning, packageId: PackageID): string {
  return `${packageId}:${warning.id ?? warning.on ?? "default"}`
}

export function getWarningTitle(warning: PackageWarning): string {
  return warning.title ?? i18n.t(warning.on ?? "default", { ns: "WarningTitle" })
}

export function getWarningMessage(warning: PackageWarning): string {
  if (warning.id && !warning.message) {
    return i18n.t(warning.id, { defaultValue: warning.id, ns: "WarningMessage" })
  } else {
    return warning.message ?? ""
  }
}
