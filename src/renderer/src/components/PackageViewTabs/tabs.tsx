import type { ComponentType } from "react"

import type { TFunction } from "i18next"
import { create as createStore } from "zustand"

import { type PackageID, isLocal, isPatched } from "@common/packages"
import { type PackageInfo, VariantState } from "@common/types"
import { size } from "@common/utils/objects"
import type { VariantInfo } from "@common/variants"
import { PackageOptionsForm } from "@components/Options/PackageOptionsForm"
import { type Tag, TagType, createTag } from "@components/Tags/utils"

import { PackageViewDependencies } from "./PackageViewDependencies"
import { PackageViewFiles } from "./PackageViewFiles"
import { PackageViewLogs } from "./PackageViewLogs"
import { PackageViewLots } from "./PackageViewLots"
import { PackageViewMMPs } from "./PackageViewMMPs"
import { PackageViewOptionalDependencies } from "./PackageViewOptionalDependencies"
import { PackageViewReadme } from "./PackageViewReadme"
import { PackageViewRequiredBy } from "./PackageViewRequiredBy"
import { PackageViewSummary } from "./PackageViewSummary"
import { PackageViewVariants } from "./PackageViewVariants"

export type PackageViewTabInfo = {
  component: ComponentType<{ packageId: PackageID }>
  id: string
  label: (
    t: TFunction<"PackageViewTabs">,
    variantInfo: VariantInfo,
    packageInfo: PackageInfo,
    dependentPackages: PackageID[],
  ) => string
  labelTag?: (variantInfo: VariantInfo) => Tag | undefined
  condition: (variantInfo: VariantInfo, dependentPackages: PackageID[]) => boolean
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
    id: "mmps",
    component: PackageViewMMPs,
    condition(variantInfo) {
      return !!variantInfo.mmps?.length
    },
    label(t, variantInfo) {
      return t("mmps", { count: variantInfo.mmps?.length })
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
    label(t, variantInfo, packageInfo, dependentPackages) {
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
    labelTag(variantInfo) {
      if (isLocal(variantInfo)) {
        return createTag(TagType.STATE, VariantState.LOCAL)
      }

      if (isPatched(variantInfo)) {
        return createTag(TagType.STATE, VariantState.PATCHED)
      }
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
  {
    id: "logs",
    component: PackageViewLogs,
    condition(variantInfo) {
      return !!variantInfo.installed && !!variantInfo.logs
    },
    label(t) {
      return t("logs")
    },
  },
  {
    id: "variants",
    component: PackageViewVariants,
    condition() {
      return true
    },
    label(t, variantInfo, packageInfo) {
      return t("variants", { count: size(packageInfo.variants) })
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
