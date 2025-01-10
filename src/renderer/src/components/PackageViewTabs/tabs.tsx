import { get, size, unionBy, unique, uniqueBy, values } from "@salinco/nice-utils"
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
    label(t) {
      return t("summary")
    },
  },
  {
    id: "lots",
    component: lazy(() => import("./PackageViewLots")),
    count({ packageId }, store) {
      const { buildings, lots } = getCurrentVariant(store, packageId)
      const maxisLots = store.maxis?.lots ?? []

      return unionBy(
        lots ?? [],
        buildings?.flatMap(building => maxisLots.filter(lot => lot.building === building.id)) ?? [],
        lot => lot.id,
      ).length
    },
    fullsize: true,
    label(t, count) {
      return t("lots", { count })
    },
  },
  {
    id: "mmps",
    component: lazy(() => import("./PackageViewMMPs")),
    count({ packageId }, store) {
      const { mmps } = getCurrentVariant(store, packageId)

      return mmps ? uniqueBy(mmps, get("id")).length : 0
    },
    label(t, count) {
      return t("mmps", { count })
    },
  },
  {
    id: "props",
    component: lazy(() => import("./PackageViewProps")),
    count({ packageId }, store) {
      const { props } = getCurrentVariant(store, packageId)

      return props ? uniqueBy(props, get("id")).length : 0
    },
    label(t, count) {
      return t("props", { count })
    },
  },
  {
    id: "textures",
    component: lazy(() => import("./PackageViewTextures")),
    count({ packageId }, store) {
      const { textures } = getCurrentVariant(store, packageId)

      return textures ? unique(values(textures).flat()).length : 0
    },
    label(t, count) {
      return t("textures", { count })
    },
  },
  {
    id: "dependencies",
    component: lazy(() => import("./PackageViewDependencies")),
    count({ packageId }, store) {
      const { dependencies } = getCurrentVariant(store, packageId)

      return dependencies?.length ?? 0
    },
    label(t, count) {
      return t("dependencies", { count })
    },
  },
  {
    id: "optionalDependencies",
    component: lazy(() => import("./PackageViewOptionalDependencies")),
    count({ packageId }, store) {
      const { optional } = getCurrentVariant(store, packageId)

      return optional?.length ?? 0
    },
    label(t, count) {
      return t("optionalDependencies", { count })
    },
  },
  {
    id: "requiredBy",
    fullsize: true,
    component: lazy(() => import("./PackageViewRequiredBy")),
    count({ packageId }, { packages }) {
      return packages ? getDependentPackages(packages, packageId).length : 0
    },
    label(t, count) {
      return t("requiredBy", { count })
    },
  },
  {
    id: "files",
    component: lazy(() => import("./PackageViewFiles")),
    condition({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return !!variantInfo.installed && !!variantInfo.files?.length
    },
    count({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return variantInfo.files?.length ?? 0
    },
    fullsize: true,
    label(t, count) {
      return t("files", { count })
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

      return !!variantInfo.installed && !!variantInfo.readme?.length
    },
    count({ packageId }, store) {
      const variantInfo = getCurrentVariant(store, packageId)

      return variantInfo.readme?.length ?? 0
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
    count({ packageId }, store) {
      const packageInfo = getPackageInfo(store, packageId)

      return packageInfo ? size(packageInfo.variants) : 0
    },
    label(t, count) {
      return t("variants", { count })
    },
  },
]
