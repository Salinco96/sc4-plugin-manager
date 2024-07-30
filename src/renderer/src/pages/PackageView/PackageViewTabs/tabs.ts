import { ComponentType } from "react"

import { TFunction } from "i18next"
import { create as createStore } from "zustand"

import { PackageOptionsForm } from "@components/Options"
import { getCurrentVariant, getDependentPackages } from "@utils/packages"
import { Store } from "@utils/store"

import { PackageViewDependencies } from "./PackageViewDependencies"
import { PackageViewFiles } from "./PackageViewFiles"
import { PackageViewOptionalDependencies } from "./PackageViewOptionalDependencies"
import { PackageViewReadme } from "./PackageViewReadme"
import { PackageViewRequiredBy } from "./PackageViewRequiredBy"
import { PackageViewSummary } from "./PackageViewSummary"

export type PackageViewTabInfo = {
  component: ComponentType<{ packageId: string }>
  id: string
  label: (t: TFunction<"PackageViewTabs">, packageId: string, store: Store) => string
  condition: (packageId: string, store: Store) => boolean
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
    id: "dependencies",
    component: PackageViewDependencies,
    condition(packageId, store) {
      const variantInfo = getCurrentVariant(store, packageId)
      return !!variantInfo.dependencies?.length
    },
    label(t, packageId, store) {
      const variantInfo = getCurrentVariant(store, packageId)
      return t("dependencies", { count: variantInfo.dependencies?.length })
    },
  },
  {
    id: "optionalDependencies",
    component: PackageViewOptionalDependencies,
    condition(packageId, store) {
      const variantInfo = getCurrentVariant(store, packageId)
      return !!variantInfo.optional?.length
    },
    label(t, packageId, store) {
      const variantInfo = getCurrentVariant(store, packageId)
      return t("optionalDependencies", { count: variantInfo.optional?.length })
    },
  },
  {
    id: "requiredBy",
    fullsize: true,
    component: PackageViewRequiredBy,
    condition(packageId, store) {
      return !!getDependentPackages(store, packageId).length
    },
    label(t, packageId, store) {
      return t("requiredBy", { count: getDependentPackages(store, packageId).length })
    },
  },
  {
    id: "files",
    component: PackageViewFiles,
    condition(packageId, store) {
      const variantInfo = getCurrentVariant(store, packageId)
      return !!variantInfo.files?.length
    },
    label(t, packageId, store) {
      const variantInfo = getCurrentVariant(store, packageId)
      return t("files", { count: variantInfo.files?.length })
    },
  },
  {
    id: "readme",
    component: PackageViewReadme,
    condition(packageId, store) {
      const variantInfo = getCurrentVariant(store, packageId)
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
    condition(packageId, store) {
      const variantInfo = getCurrentVariant(store, packageId)
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
