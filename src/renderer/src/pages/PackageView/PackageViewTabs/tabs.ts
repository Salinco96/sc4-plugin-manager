import { ComponentType } from "react"

import { TFunction } from "i18next"
import { create as createStore } from "zustand"

import { VariantInfo } from "@common/types"
import { PackageOptionsForm } from "@components/Options"

import { PackageViewDependencies } from "./PackageViewDependencies"
import { PackageViewFiles } from "./PackageViewFiles"
import { PackageViewLots } from "./PackageViewLots"
import { PackageViewOptionalDependencies } from "./PackageViewOptionalDependencies"
import { PackageViewReadme } from "./PackageViewReadme"
import { PackageViewRequiredBy } from "./PackageViewRequiredBy"
import { PackageViewSummary } from "./PackageViewSummary"

export type PackageViewTabInfo = {
  component: ComponentType<{ packageId: string }>
  id: string
  label: (
    t: TFunction<"PackageViewTabs">,
    variantInfo: VariantInfo,
    dependentPackages: string[],
  ) => string
  condition: (variantInfo: VariantInfo, dependentPackages: string[]) => boolean
  fullsize?: boolean
}

export const packageViewTabs: PackageViewTabInfo[] = [
  {
    id: "summary",
    component: PackageViewSummary,
    condition() {
      return true
    },
    label(t) {
      return t("summary")
    },
  },
  {
    id: "lots",
    component: PackageViewLots,
    condition(variantInfo) {
      return !!variantInfo.lots?.length
    },
    label(t, variantInfo) {
      return t("lots", { count: variantInfo.lots?.length })
    },
  },
  {
    id: "dependencies",
    component: PackageViewDependencies,
    condition(variantInfo) {
      return !!variantInfo.dependencies?.length
    },
    label(t, variantInfo) {
      return t("dependencies", { count: variantInfo.dependencies?.length })
    },
  },
  {
    id: "optionalDependencies",
    component: PackageViewOptionalDependencies,
    condition(variantInfo) {
      return !!variantInfo.optional?.length
    },
    label(t, variantInfo) {
      return t("optionalDependencies", { count: variantInfo.optional?.length })
    },
  },
  {
    id: "requiredBy",
    fullsize: true,
    component: PackageViewRequiredBy,
    condition(variantInfo, dependentPackages) {
      return !!dependentPackages.length
    },
    label(t, variantInfo, dependentPackages) {
      return t("requiredBy", { count: dependentPackages.length })
    },
  },
  {
    id: "files",
    component: PackageViewFiles,
    condition(variantInfo) {
      return !!variantInfo.files?.length
    },
    label(t, variantInfo) {
      return t("files", { count: variantInfo.files?.length })
    },
  },
  {
    id: "readme",
    component: PackageViewReadme,
    condition(variantInfo) {
      return !!variantInfo.readme
    },
    label(t) {
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
    label(t) {
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
