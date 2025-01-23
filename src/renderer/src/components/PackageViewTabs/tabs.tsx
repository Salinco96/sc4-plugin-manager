import { type PackageID, isLocal, isPatched } from "@common/packages"
import { VariantState } from "@common/types"
import { TagType, createTag } from "@components/Tags/utils"
import { get, size, unionBy, unique, uniqueBy, values } from "@salinco/nice-utils"
import { lazy } from "react"

import type { TabInfo } from "@components/Tabs"

import { getCurrentVariant, getPackageInfo } from "@stores/main"
import { getDependentPackages } from "@utils/packages"
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
    count({ packageId }, state) {
      const { buildings, lots } = getCurrentVariant(state, packageId)
      const maxisLots = state.maxis?.lots ?? []

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
    count({ packageId }, state) {
      const { mmps } = getCurrentVariant(state, packageId)

      return mmps ? uniqueBy(mmps, get("id")).length : 0
    },
    label(t, count) {
      return t("mmps", { count })
    },
  },
  {
    id: "props",
    component: lazy(() => import("./PackageViewProps")),
    count({ packageId }, state) {
      const { props } = getCurrentVariant(state, packageId)

      return props ? uniqueBy(props, get("id")).length : 0
    },
    label(t, count) {
      return t("props", { count })
    },
  },
  {
    id: "textures",
    component: lazy(() => import("./PackageViewTextures")),
    count({ packageId }, state) {
      const { textures } = getCurrentVariant(state, packageId)

      return textures ? unique(values(textures).flat()).length : 0
    },
    label(t, count) {
      return t("textures", { count })
    },
  },
  {
    id: "dependencies",
    component: lazy(() => import("./PackageViewDependencies")),
    count({ packageId }, state) {
      const { dependencies } = getCurrentVariant(state, packageId)

      return dependencies?.length ?? 0
    },
    label(t, count) {
      return t("dependencies", { count })
    },
  },
  {
    id: "optionalDependencies",
    component: lazy(() => import("./PackageViewOptionalDependencies")),
    count({ packageId }, state) {
      const { optional } = getCurrentVariant(state, packageId)

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
    condition({ packageId }, state) {
      const variantInfo = getCurrentVariant(state, packageId)

      return !!variantInfo.installed && !!variantInfo.files?.length
    },
    count({ packageId }, state) {
      const variantInfo = getCurrentVariant(state, packageId)

      return variantInfo.files?.length ?? 0
    },
    fullsize: true,
    label(t, count) {
      return t("files", { count })
    },
    labelTag({ packageId }, state) {
      const variantInfo = getCurrentVariant(state, packageId)

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
    condition({ packageId }, state) {
      const variantInfo = getCurrentVariant(state, packageId)

      return !!variantInfo.installed && !!variantInfo.readme?.length
    },
    count({ packageId }, state) {
      const variantInfo = getCurrentVariant(state, packageId)

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
    condition({ packageId }, state) {
      const variantInfo = getCurrentVariant(state, packageId)

      return !!variantInfo.options?.length
    },
    label(t) {
      return t("options")
    },
  },
  {
    id: "logs",
    component: lazy(() => import("./PackageViewLogs")),
    condition({ packageId }, state) {
      const variantInfo = getCurrentVariant(state, packageId)

      return !!variantInfo.installed && !!variantInfo.logs
    },
    label(t) {
      return t("logs")
    },
  },
  {
    id: "variants",
    component: lazy(() => import("./PackageViewVariants")),
    count({ packageId }, state) {
      return size(getPackageInfo(state, packageId).variants)
    },
    label(t, count) {
      return t("variants", { count })
    },
  },
]
