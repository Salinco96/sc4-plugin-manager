import { ComponentType } from "react"

import { create as createStore } from "zustand"

import { PackageStatus, VariantInfo } from "@common/types"

import { PackageViewDependencies } from "./PackageViewDependencies"
import { PackageViewDocumentation } from "./PackageViewDocumentation"
import { PackageViewFiles } from "./PackageViewFiles"
import { PackageViewInfo } from "./PackageViewInfo"
import { PackageViewRequiredBy } from "./PackageViewRequiredBy"

export const packageViewTabs: {
  component: ComponentType<{ packageId: string }>
  id: string
  name: (variantInfo: VariantInfo, packageStatus?: PackageStatus) => string
  condition: (variantInfo: VariantInfo, packageStatus?: PackageStatus) => boolean
  fullsize?: boolean
}[] = [
  {
    id: "info",
    component: PackageViewInfo,
    condition() {
      return true
    },
    name() {
      return "Summary"
    },
  },
  {
    id: "dependencies",
    component: PackageViewDependencies,
    condition(variantInfo) {
      return !!variantInfo.dependencies?.length
    },
    name(variantInfo) {
      return `${variantInfo.dependencies?.length ?? 0} dependencies`
    },
  },
  {
    // TODO: Make this show not only enabled packages, according to filters
    id: "requires",
    component: PackageViewRequiredBy,
    condition(variantInfo, packageStatus) {
      return !!packageStatus?.requiredBy?.length
    },
    name() {
      return "Required by"
    },
  },
  {
    id: "files",
    component: PackageViewFiles,
    condition(variantInfo) {
      return !!variantInfo.files?.length
    },
    name(variantInfo) {
      return `${variantInfo.files?.length ?? 0} files`
    },
  },
  {
    id: "docs",
    component: PackageViewDocumentation,
    condition(variantInfo) {
      return !!variantInfo.readme
    },
    name() {
      return "Readme"
    },
    fullsize: true,
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
