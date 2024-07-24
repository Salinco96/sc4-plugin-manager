import { ComponentType } from "react"

import { TFunction } from "i18next"
import { create as createStore } from "zustand"

import { PackageStatus, VariantInfo } from "@common/types"
import { PackageOptionsForm } from "@components/Options"

import { PackageViewDependencies } from "./PackageViewDependencies"
import { PackageViewFiles } from "./PackageViewFiles"
import { PackageViewOptionalDependencies } from "./PackageViewOptionalDependencies"
import { PackageViewReadme } from "./PackageViewReadme"
import { PackageViewRequiredBy } from "./PackageViewRequiredBy"
import { PackageViewSummary } from "./PackageViewSummary"

export const packageViewTabs: {
  component: ComponentType<{ packageId: string }>
  id: string
  name: (
    t: TFunction<"PackageViewTabs">,
    variantInfo: VariantInfo,
    packageStatus?: PackageStatus,
  ) => string
  condition: (variantInfo: VariantInfo, packageStatus?: PackageStatus) => boolean
  fullsize?: boolean
}[] = [
  {
    id: "summary",
    component: PackageViewSummary,
    condition() {
      return true
    },
    name(t) {
      return t("summary")
    },
  },
  {
    id: "dependencies",
    component: PackageViewDependencies,
    condition(variantInfo) {
      return !!variantInfo.dependencies?.length
    },
    name(t, variantInfo) {
      return t("dependencies", { count: variantInfo.dependencies?.length })
    },
  },
  {
    id: "optionalDependencies",
    component: PackageViewOptionalDependencies,
    condition(variantInfo) {
      return !!variantInfo.optional?.length
    },
    name(t, variantInfo) {
      return t("optionalDependencies", { count: variantInfo.optional?.length })
    },
  },
  {
    // TODO: Make this show not only enabled packages, according to filters
    id: "requiredBy",
    component: PackageViewRequiredBy,
    condition(variantInfo, packageStatus) {
      return !!packageStatus?.requiredBy?.length
    },
    name(t, variantInfo, packageStatus) {
      return t("requiredBy", { count: packageStatus?.requiredBy?.length })
    },
  },
  {
    id: "files",
    component: PackageViewFiles,
    condition(variantInfo) {
      return !!variantInfo.files?.length
    },
    name(t, variantInfo) {
      return t("files", { count: variantInfo.files?.length })
    },
  },
  {
    id: "readme",
    component: PackageViewReadme,
    condition(variantInfo) {
      return !!variantInfo.readme
    },
    name(t) {
      return t("readme")
    },
    fullsize: true,
  },
  {
    id: "options",
    component: PackageOptionsForm,
    condition(variantInfo) {
      return !!variantInfo.options?.length
    },
    name(t) {
      return t("options")
    },
  },
]

export const usePackageViewTab = createStore<{
  activeTab: string
  setActiveTab(tabId: string): void
}>()(set => ({
  activeTab: packageViewTabs[0].id,
  setActiveTab(tabId) {
    set({ activeTab: tabId })
  },
}))
