import { get, isEmpty, size, unionBy, unique, uniqueBy, values, where } from "@salinco/nice-utils"
import type { TFunction } from "i18next"
import { type ComponentType, lazy } from "react"

import { isTogglableLot } from "@common/lots"
import { type PackageID, isLocal, isPatched } from "@common/packages"
import { type PackageInfo, VariantState } from "@common/types"
import type { ContentsInfo, VariantInfo } from "@common/variants"
import { type Tag, TagType, createTag } from "@components/Tags/utils"

import { PackageViewSummary } from "./PackageViewSummary"

export interface PackageViewTabInfoProps {
  packageId: PackageID
}

export type PackageViewTabInfo = {
  component: ComponentType<PackageViewTabInfoProps>
  id: string
  label: (
    t: TFunction<"PackageViewTabs">,
    variantInfo: VariantInfo,
    packageInfo: PackageInfo,
    dependentPackages: PackageID[],
    maxis: Required<ContentsInfo>,
  ) => string
  labelTag?: (variantInfo: VariantInfo) => Tag | undefined
  condition: (
    variantInfo: VariantInfo,
    dependentPackages: PackageID[],
    maxis: Required<ContentsInfo>,
  ) => boolean
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
    component: lazy(() => import("./PackageViewLots")),
    condition(variantInfo, dependentPackages, maxis) {
      return (
        !!variantInfo.lots?.length ||
        !!variantInfo.buildings?.some(building => maxis.lots.some(where("building", building.id)))
      )
    },
    label(t, variantInfo, packageInfo, dependentPackages, maxis) {
      const ids = unionBy(
        variantInfo.lots ?? [],
        variantInfo.buildings?.flatMap(building =>
          maxis.lots.filter(where("building", building.id)),
        ) ?? [],
        get("id"),
      )

      return t("lots", { count: ids.length })
    },
  },
  {
    id: "mmps",
    component: lazy(() => import("./PackageViewMMPs")),
    condition(variantInfo) {
      return !!variantInfo.mmps?.length
    },
    label(t, variantInfo) {
      const ids = uniqueBy(variantInfo.mmps ?? [], get("id"))
      return t("mmps", { count: ids.length })
    },
  },
  {
    id: "props",
    component: lazy(() => import("./PackageViewProps")),
    condition(variantInfo) {
      return !!variantInfo.props?.length
    },
    label(t, variantInfo) {
      const ids = uniqueBy(variantInfo.props ?? [], get("id"))
      return t("props", { count: ids.length })
    },
  },
  {
    id: "textures",
    component: lazy(() => import("./PackageViewTextures")),
    condition(variantInfo) {
      return !!variantInfo.textures && !isEmpty(variantInfo.textures)
    },
    label(t, variantInfo) {
      const ids = unique(values(variantInfo.textures ?? {}).flat())
      return t("textures", { count: ids.length })
    },
  },
  {
    id: "dependencies",
    component: lazy(() => import("./PackageViewDependencies")),
    condition(variantInfo) {
      return !!variantInfo.dependencies?.length
    },
    label(t, variantInfo) {
      return t("dependencies", { count: variantInfo.dependencies?.length })
    },
  },
  {
    id: "optionalDependencies",
    component: lazy(() => import("./PackageViewOptionalDependencies")),
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
    component: lazy(() => import("./PackageViewRequiredBy")),
    condition(variantInfo, dependentPackages) {
      return !!dependentPackages.length
    },
    label(t, variantInfo, packageInfo, dependentPackages) {
      return t("requiredBy", { count: dependentPackages.length })
    },
  },
  {
    id: "files",
    component: lazy(() => import("./PackageViewFiles")),
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
    component: lazy(() => import("./PackageViewReadme")),
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
    component: lazy(() => import("../Options/PackageOptionsForm")),
    condition(variantInfo) {
      return !!variantInfo.options?.length || !!variantInfo.lots?.some(isTogglableLot)
    },
    label(t) {
      return t("options")
    },
  },
  {
    id: "logs",
    component: lazy(() => import("./PackageViewLogs")),
    condition(variantInfo) {
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
    label(t, variantInfo, packageInfo) {
      return t("variants", { count: size(packageInfo.variants) })
    },
  },
]
