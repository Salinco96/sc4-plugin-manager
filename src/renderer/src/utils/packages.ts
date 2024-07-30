import { useCallback } from "react"

import { isCategory } from "@common/categories"
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
import { PackageInfo, PackageStatus, ProfileInfo, VariantInfo, getState } from "@common/types"
import { hasAny } from "@common/utils/arrays"
import { mapValues } from "@common/utils/objects"
import { getStartOfWordSearchRegex } from "@common/utils/regex"
import { PACKAGE_BANNER_HEIGHT, PACKAGE_BANNER_SPACING } from "@components/PackageBanners"

import {
  PackageFilters,
  PackageUi,
  Store,
  getCurrentProfile,
  getPackageInfo,
  useStore,
} from "./store"

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

export function getCurrentVariant(store: Store, packageId: string): VariantInfo {
  const packageInfo = getPackageInfo(store, packageId)!
  return packageInfo.variants[store.packageUi[packageId].variantId]
}

export function useCurrentVariant(packageId: string): VariantInfo {
  return useStore(useCallback(store => getCurrentVariant(store, packageId), [packageId]))
}

export function getDependentPackages(store: Store, dependencyId: string): string[] {
  const { packages = {} } = store

  return Object.keys(packages).filter(packageId => {
    return Object.values(packages[packageId].variants).some(variantInfo => {
      return !!variantInfo.dependencies?.includes(dependencyId)
    })
  })
}

export function useDependentPackages(dependencyId: string): string[] {
  return useStore(useCallback(store => getDependentPackages(store, dependencyId), [dependencyId]))
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
  filters: Omit<PackageFilters, "search"> & { pattern?: RegExp },
): boolean {
  const packageStatus = getPackageStatus(packageInfo, profileInfo)

  if (filters.authors.length) {
    if (!hasAny(variantInfo.authors, filters.authors)) {
      return false
    }
  }

  if (filters.categories.length) {
    if (!filters.categories.some(category => isCategory(variantInfo, category))) {
      return false
    }
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

  if (filters.states.length) {
    if (!filters.states.some(state => getState(state, packageInfo, variantInfo.id, profileInfo))) {
      return false
    }
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
  const pattern = search ? getStartOfWordSearchRegex(search) : undefined

  const filters: Omit<PackageFilters, "search"> & { pattern?: RegExp } = {
    ...packageFilters,
    dependencies: packageFilters.dependencies || packageFilters.onlyErrors,
    experimental: packageFilters.experimental || packageFilters.onlyErrors,
    incompatible: packageFilters.incompatible || packageFilters.onlyErrors,
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
