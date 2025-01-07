import { get, isEmpty, size, unionBy, unique, uniqueBy, values } from "@salinco/nice-utils"
import { lazy } from "react"

import { isTogglableLot } from "@common/lots"
import { type PackageID, isLocal, isPatched } from "@common/packages"
import { VariantState } from "@common/types"
import { TagType, createTag } from "@components/Tags/utils"

import type { TabInfo } from "@components/Tabs"
import { getCurrentVariant, getDependentPackages } from "@utils/packages"
import { getPackageInfo } from "@utils/store"
import { PackageViewSummary } from "./PackageViewSummary"

export const packageViewTabs: TabInfo<{ packageId: PackageID }>[] = [
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
    component: lazy(() => import("./PackageViewLots")),
    condition({ packageId }, store) {
      const { buildings, lots } = getCurrentVariant(store, packageId)
      const maxisLots = store.maxis.lots

      return (
        !!lots?.length ||
        !!buildings?.some(building => maxisLots.some(lot => lot.building === building.id))
      )
    },
    fullsize: true,
    label(t, { packageId }, store) {
      const { buildings, lots } = getCurrentVariant(store, packageId)
      const maxisLots = store.maxis.lots

      const ids = unionBy(
        lots ?? [],
        buildings?.flatMap(building => maxisLots.filter(lot => lot.building === building.id)) ?? [],
        lot => lot.id,
      )

      return t("lots", { count: ids.length })
    },
  },
  {
    id: "mmps",
    component: lazy(() => import("./PackageViewMMPs")),
    condition({ packageId }, store) {
      const { mmps } = getCurrentVariant(store, packageId)

      return !!mmps?.length
    },
    label(t, { packageId }, store) {
      const { mmps } = getCurrentVariant(store, packageId)

      const ids = mmps ? uniqueBy(mmps, get("id")) : []
      return t("mmps", { count: ids.length })
    },
  },
  {
    id: "props",
    component: lazy(() => import("./PackageViewProps")),
    condition({ packageId }, store) {
      const { props } = getCurrentVariant(store, packageId)

      return !!props?.length
    },
    label(t, { packageId }, store) {
      const { props } = getCurrentVariant(store, packageId)

      const ids = props ? uniqueBy(props, get("id")) : []
      return t("props", { count: ids.length })
    },
  },
  {
    id: "textures",
    component: lazy(() => import("./PackageViewTextures")),
    condition({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return !!variantInfo.textures && !isEmpty(variantInfo.textures)
    },
    label(t, { packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      const ids = unique(values(variantInfo.textures ?? {}).flat())
      return t("textures", { count: ids.length })
    },
  },
  {
    id: "dependencies",
    component: lazy(() => import("./PackageViewDependencies")),
    condition({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return !!variantInfo.dependencies?.length
    },
    label(t, { packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return t("dependencies", { count: variantInfo.dependencies?.length })
    },
  },
  {
    id: "optionalDependencies",
    component: lazy(() => import("./PackageViewOptionalDependencies")),
    condition({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return !!variantInfo.optional?.length
    },
    label(t, { packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return t("optionalDependencies", { count: variantInfo.optional?.length })
    },
  },
  {
    id: "requiredBy",
    fullsize: true,
    component: lazy(() => import("./PackageViewRequiredBy")),
    condition({ packageId }, { packages }) {
      const dependentPackages = packages ? getDependentPackages(packages, packageId) : []

      return !!dependentPackages.length
    },
    label(t, { packageId }, { packages }) {
      const dependentPackages = packages ? getDependentPackages(packages, packageId) : []

      return t("requiredBy", { count: dependentPackages.length })
    },
  },
  {
    id: "files",
    component: lazy(() => import("./PackageViewFiles")),
    condition({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return !!variantInfo.installed && !!variantInfo.files?.length
    },
    label(t, { packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return t("files", { count: variantInfo.files?.length })
    },
    labelTag({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

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
    component: lazy(() => import("./PackageViewReadme")),
    condition({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return !!variantInfo.installed && !!variantInfo.readme
    },
    label(t) {
      return t("readme")
    },
    fullsize: true,
  },
  {
    id: "options",
    component: lazy(() => import("../Options/PackageOptionsForm")),
    condition({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return !!variantInfo.options?.length || !!variantInfo.lots?.some(isTogglableLot)
    },
    label(t) {
      return t("options")
    },
  },
  {
    id: "logs",
    component: lazy(() => import("./PackageViewLogs")),
    condition({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return !!variantInfo.installed && !!variantInfo.logs
    },
    label(t) {
      return t("logs")
    },
  },
  {
    id: "variants",
    component: lazy(() => import("./PackageViewVariants")),
    condition() {
      return true
    },
    label(t, { packageId }, store) {
      const packageInfo = getPackageInfo(store, packageId)

      return t("variants", { count: packageInfo ? size(packageInfo.variants) : 0 })
    },
  },
]
