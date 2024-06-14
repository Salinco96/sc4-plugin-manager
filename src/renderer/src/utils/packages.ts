import { useCallback } from "react"

import {
  getVariantIssues,
  isDependency,
  isDeprecated,
  isError,
  isExperimental,
  isIncompatible,
  isMissing,
  isOutdated,
} from "@common/packages"
import {
  PackageCategory,
  PackageInfo,
  PackageState,
  PackageStatus,
  ProfileInfo,
  VariantInfo,
  getCategory,
  getState,
} from "@common/types"
import { hasAny } from "@common/utils/arrays"
import { mapValues } from "@common/utils/objects"
import { PACKAGE_BANNER_HEIGHT, PACKAGE_BANNER_SPACING } from "@components/PackageBanners"
import { TagType, parseTag } from "@components/PackageList/utils"

import { PackageUi, Store, getCurrentProfile, getPackageInfo, useStore } from "./store"

export const PACKAGE_LIST_ITEM_BASE_SIZE = 180
export const PACKAGE_LIST_ITEM_BANNER_SIZE = PACKAGE_BANNER_HEIGHT + PACKAGE_BANNER_SPACING
export const PACKAGE_LIST_ITEM_DESCRIPTION_SIZE = 56

function getFilteredPackages(store: Store): string[] {
  return store.filteredPackages
}

export function getPackageListItemSize(
  variantInfo: VariantInfo,
  packageStatus?: PackageStatus,
): number {
  const issues = getVariantIssues(variantInfo, packageStatus)

  let nBanners = 0
  let size = PACKAGE_LIST_ITEM_BASE_SIZE

  if (isDeprecated(variantInfo)) {
    nBanners++
  }

  if (isExperimental(variantInfo)) {
    nBanners++
  }

  if (isMissing(variantInfo, packageStatus)) {
    nBanners++
  }

  if (isOutdated(variantInfo)) {
    nBanners++
  }

  if (issues) {
    nBanners += issues.length
  }

  size += nBanners * PACKAGE_LIST_ITEM_BANNER_SIZE

  // We expect most packages to have a description so that is pre-included in base size
  if (!variantInfo.description) {
    size -= PACKAGE_LIST_ITEM_DESCRIPTION_SIZE
  }

  return size
}

function getPackageStatus(
  packageInfo: PackageInfo,
  profileInfo?: ProfileInfo,
): PackageStatus | undefined {
  return profileInfo && packageInfo.status[profileInfo.id]
}

export function useCurrentVariant(packageId: string): VariantInfo {
  return useStore(
    useCallback(
      store => {
        const packageInfo = getPackageInfo(store, packageId)!
        return packageInfo.variants[store.packageUi[packageId].variantId]
      },
      [packageId],
    ),
  )
}

export function useFilteredPackages(): string[] {
  return useStore(getFilteredPackages)
}

export function useFilteredVariants(packageId: string): string[] {
  return useStore(
    useCallback(
      store => {
        const packageInfo = getPackageInfo(store, packageId)!
        const packageUi = store.packageUi[packageId]
        return packageUi?.variantIds ?? Object.keys(packageInfo.variants)
      },
      [packageId],
    ),
  )
}

export function usePackageInfo(packageId: string): PackageInfo {
  return useStore(useCallback(store => getPackageInfo(store, packageId)!, [packageId]))
}

export function usePackageListItemSize(): (packageId: string) => number {
  const packageUi = useStore(store => store.packageUi)
  return (packageId: string) => packageUi[packageId]?.itemSize ?? PACKAGE_LIST_ITEM_BASE_SIZE
}

export function usePackageStatus(packageId: string): PackageStatus | undefined {
  return useStore(
    useCallback(
      store => {
        const packageInfo = getPackageInfo(store, packageId)!
        const profileInfo = getCurrentProfile(store)
        return getPackageStatus(packageInfo, profileInfo)
      },
      [packageId],
    ),
  )
}

export function useVariantInfo(packageId: string, variantId: string): VariantInfo {
  return useStore(
    useCallback(
      store => {
        const packageInfo = getPackageInfo(store, packageId)!
        return packageInfo.variants[variantId]
      },
      [packageId, variantId],
    ),
  )
}

export function filterVariant(
  packageInfo: PackageInfo,
  variantInfo: VariantInfo,
  profileInfo: ProfileInfo | undefined,
  filters: {
    authors: string[]
    categories: PackageCategory[]
    dependencies?: boolean
    experimental?: boolean
    incompatible?: boolean
    onlyErrors?: boolean
    onlyUpdates?: boolean
    pattern?: RegExp
    state: PackageState | null
  },
): boolean {
  const packageStatus = getPackageStatus(packageInfo, profileInfo)

  if (filters.authors.length && !hasAny(variantInfo.authors, filters.authors)) {
    return false
  }

  if (filters.categories.length && !filters.categories.includes(getCategory(variantInfo))) {
    return false
  }

  if (filters.onlyErrors && !isError(variantInfo, packageStatus)) {
    return false
  }

  if (filters.onlyUpdates && !isOutdated(variantInfo)) {
    return false
  }

  if (filters.state && !getState(filters.state, packageInfo, variantInfo.id, profileInfo)) {
    return false
  }

  if (!filters.onlyErrors && !filters.onlyUpdates) {
    if (!filters.dependencies && isDependency(variantInfo)) {
      return false
    }

    if (!filters.experimental && isExperimental(variantInfo)) {
      return false
    }

    if (!filters.incompatible && isIncompatible(variantInfo, packageStatus)) {
      return false
    }
  }

  if (filters.pattern && !filters.pattern?.test(packageInfo.id + "|" + packageInfo.name)) {
    return false
  }

  return true
}

export function computePackageList(
  store: Store,
  triggeredByFilters: boolean,
): Pick<Store, "authors" | "filteredPackages" | "packageUi"> {
  const profileInfo = getCurrentProfile(store)
  const packageFilters = store.packageFilters
  const packages = store.packages
  if (!packages) {
    return {
      authors: [],
      filteredPackages: [],
      packageUi: {},
    }
  }

  const authors = new Set<string>()
  const packageUi: { [packageId: string]: PackageUi } = {}
  const variantChanges: { [packageId: string]: string } = {}

  // Match search query from start of words only, ignoring leading/trailing spaces
  const search = packageFilters.search.trim()
  const pattern = search ? RegExp("\\b" + search.replaceAll(/\W/g, "\\$&"), "i") : undefined

  // Group tags by type
  // Tags within each type are merged as OR, then types are merged as AND
  // e.g. (author1 OR author2 OR author3) AND (category1 OR category2)
  const filterAuthors: string[] = []
  const filterCategories: PackageCategory[] = []
  for (const tag of packageFilters.tags) {
    const { type, value } = parseTag(tag)
    if (type === TagType.AUTHOR) {
      filterAuthors.push(value)
    } else if (type === TagType.CATEGORY) {
      filterCategories.push(value as PackageCategory)
    }
  }

  const filters = {
    ...packageFilters,
    authors: filterAuthors,
    categories: filterCategories,
    // When showing errors, we do not want to exclude non-error variants
    // Instead we will check this for the selected variant only
    onlyErrors: false,
    pattern,
  }

  const allPackages = Object.keys(packages).sort()
  const filteredPackages = allPackages.filter(packageId => {
    const packageConfig = profileInfo?.packages[packageId]
    const packageInfo = packages[packageId]
    const packageStatus = getPackageStatus(packageInfo, profileInfo)

    const allVariantIds = Object.keys(packageInfo.variants)

    const filteredVariantIds = allVariantIds.filter(variantId => {
      const variantInfo = packageInfo.variants[variantId]
      variantInfo.authors.forEach(author => authors.add(author))
      return filterVariant(packageInfo, variantInfo, profileInfo, filters)
    })

    let selectedVariantId =
      packageStatus?.variantId ??
      store.packageUi[packageId]?.variantId ??
      filteredVariantIds[0] ??
      allVariantIds[0]

    // Adjust selected variant upon changing filters
    if (!packageConfig?.enabled && triggeredByFilters) {
      const compatibleVariantIds = filteredVariantIds.filter(
        variantId => !isIncompatible(packageInfo.variants[variantId], packageStatus),
      )

      if (compatibleVariantIds.length && !compatibleVariantIds.includes(selectedVariantId)) {
        variantChanges[packageId] = selectedVariantId = compatibleVariantIds[0]
      } else if (filteredVariantIds.length && !filteredVariantIds.includes(selectedVariantId)) {
        variantChanges[packageId] = selectedVariantId = filteredVariantIds[0]
      }
    }

    const selectedVariantInfo = packageInfo.variants[selectedVariantId]

    packageUi[packageId] = {
      itemSize: getPackageListItemSize(selectedVariantInfo, packageStatus),
      variantId: selectedVariantId,
      variantIds: filteredVariantIds,
    }

    // Only check errors for the selected variant
    if (packageFilters.onlyErrors && !isError(selectedVariantInfo, packageStatus)) {
      return false
    }

    // Package is visible if we managed to select a visible variant
    return filteredVariantIds.includes(selectedVariantId)
  })

  // Send adjusted variants back to main process
  // Enabled packages do not get adjusted so this should not trigger expensive calculations
  if (profileInfo && Object.keys(variantChanges).length) {
    store.actions.updateProfile(profileInfo.id, {
      packages: mapValues(variantChanges, variantId => ({ variant: variantId })),
    })
  }

  return {
    authors: Array.from(authors).sort(),
    filteredPackages,
    packageUi,
  }
}
