import { useCallback, useMemo } from "react"

import { CategoryID, isCategory } from "@common/categories"
import {
  PackageID,
  getVariantIssues,
  isDeprecated,
  isExperimental,
  isIncluded,
  isIncompatible,
  isInvalid,
  isMissing,
  isOutdated,
} from "@common/packages"
import { ProfileInfo } from "@common/profiles"
import {
  PackageInfo,
  PackageState,
  PackageStatus,
  Packages,
  VariantInfo,
  getState,
} from "@common/types"
import { hasAny } from "@common/utils/arrays"
import { keys, mapValues, values } from "@common/utils/objects"
import { getStartOfWordSearchRegex } from "@common/utils/regex"
import { VariantID } from "@common/variants"
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

export function getCurrentVariant(store: Store, packageId: PackageID): VariantInfo {
  const packageInfo = getPackageInfo(store, packageId)
  const packageUi = store.packageUi[packageId]
  if (!packageInfo || !packageUi) {
    throw Error(`Unknown package '${packageId}'`)
  }

  const variantInfo = packageInfo.variants[packageUi.variantId]
  if (!variantInfo) {
    throw Error(`Unknown variant '${packageId}#${packageUi.variantId}'`)
  }

  return variantInfo
}

export function useCurrentVariant(packageId: PackageID): VariantInfo {
  return useStore(useCallback(store => getCurrentVariant(store, packageId), [packageId]))
}

export function getDependentPackages(packages: Packages, dependencyId: PackageID): PackageID[] {
  return values(packages)
    .filter(packageInfo => {
      return values(packageInfo.variants).some(variantInfo => {
        return !!variantInfo.dependencies?.some(dependency => dependency.id === dependencyId)
      })
    })
    .map(packageInfo => packageInfo.id)
}

export function useDependentPackages(dependencyId: PackageID): PackageID[] {
  const packages = useStore(store => store.packages)

  return useMemo(() => {
    return packages ? getDependentPackages(packages, dependencyId) : []
  }, [dependencyId, packages])
}

export function useFilteredPackages(): string[] {
  return useStore(getFilteredPackages)
}

export function useFilteredVariants(packageId: PackageID): VariantID[] {
  return useStore(
    useCallback(
      store => {
        const packageUi = store.packageUi[packageId]
        if (!packageUi) {
          throw Error(`Unknown package '${packageId}'`)
        }

        return packageUi.variantIds
      },
      [packageId],
    ),
  )
}

export function usePackageInfo(packageId: PackageID): PackageInfo {
  return useStore(
    useCallback(
      store => {
        const packageInfo = getPackageInfo(store, packageId)
        if (!packageInfo) {
          throw Error(`Unknown package '${packageId}'`)
        }

        return packageInfo
      },
      [packageId],
    ),
  )
}

export function usePackageListItemSize(): (packageId: PackageID) => number {
  const packageUi = useStore(store => store.packageUi)
  return packageId => packageUi[packageId]?.itemSize ?? PACKAGE_LIST_ITEM_BASE_SIZE
}

export function usePackageStatus(packageId: PackageID): PackageStatus | undefined {
  return useStore(
    useCallback(
      store => {
        const packageInfo = getPackageInfo(store, packageId)
        if (!packageInfo) {
          throw Error(`Unknown package '${packageId}'`)
        }

        const profileInfo = getCurrentProfile(store)
        return getPackageStatus(packageInfo, profileInfo)
      },
      [packageId],
    ),
  )
}

export function useVariantInfo(packageId: PackageID, variantId: VariantID): VariantInfo {
  return useStore(
    useCallback(
      store => {
        const packageInfo = getPackageInfo(store, packageId)
        if (!packageInfo) {
          throw Error(`Unknown package '${packageId}'`)
        }

        const variantInfo = packageInfo.variants[variantId]
        if (!variantInfo) {
          throw Error(`Unknown variant '${packageId}#${variantId}'`)
        }

        return variantInfo
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

  if (filters.onlyErrors && !isInvalid(variantInfo, packageStatus)) {
    return false
  }

  if (filters.onlyNew && !variantInfo.new) {
    return false
  }

  if (filters.onlyUpdates && !isOutdated(variantInfo)) {
    return false
  }

  if (filters.state) {
    if (filters.state === PackageState.ENABLED && filters.dependencies) {
      if (!isIncluded(packageStatus)) {
        return false
      }
    } else if (!getState(filters.state, packageInfo, variantInfo, profileInfo)) {
      return false
    }
  }

  if (filters.states.length) {
    if (!filters.states.some(state => getState(state, packageInfo, variantInfo, profileInfo))) {
      return false
    }
  }

  if (!filters.onlyErrors && !filters.onlyUpdates) {
    if (!filters.dependencies && isCategory(variantInfo, CategoryID.DEPENDENCIES)) {
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
): Pick<Store, "filteredPackages" | "packageUi"> {
  const profileInfo = getCurrentProfile(store)
  const packageFilters = store.packageFilters
  const packages = store.packages
  if (!packages) {
    return {
      filteredPackages: [],
      packageUi: {},
    }
  }

  const packageUi: { [packageId in PackageID]?: PackageUi } = {}
  const variantChanges: { [packageId in PackageID]?: VariantID } = {}

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

  const allPackages = keys(packages).sort()
  const filteredPackages = allPackages.filter(packageId => {
    const packageConfig = profileInfo?.packages[packageId]
    const packageInfo = packages[packageId]! // TODO
    const packageStatus = getPackageStatus(packageInfo, profileInfo)

    const allVariants = values(packageInfo.variants)

    const filteredVariants = allVariants.filter(variantInfo => {
      return filterVariant(packageInfo, variantInfo, profileInfo, filters)
    })

    let selectedVariantId =
      packageStatus?.variantId ??
      store.packageUi[packageId]?.variantId ??
      (filteredVariants[0] ?? allVariants[0]).id

    const selectedVariant = packageInfo.variants[selectedVariantId]
    if (!selectedVariant) {
      return false
    }

    // Adjust selected variant upon changing filters
    if (!packageConfig?.enabled && triggeredByFilters) {
      const compatibleVariants = filteredVariants.filter(
        variantInfo => !isIncompatible(variantInfo, packageStatus),
      )

      if (compatibleVariants.length && !compatibleVariants.includes(selectedVariant)) {
        variantChanges[packageId] = selectedVariantId = compatibleVariants[0].id
      } else if (filteredVariants.length && !filteredVariants.includes(selectedVariant)) {
        variantChanges[packageId] = selectedVariantId = filteredVariants[0].id
      }
    }

    packageUi[packageId] = {
      itemSize: getPackageListItemSize(selectedVariant, packageStatus),
      variantId: selectedVariantId,
      variantIds: filteredVariants.map(variantInfo => variantInfo.id),
    }

    // Only check errors for the selected variant
    if (packageFilters.onlyErrors && !isInvalid(selectedVariant, packageStatus)) {
      return false
    }

    // Package is visible if we managed to select a visible variant
    return filteredVariants.includes(selectedVariant)
  })

  // Send adjusted variants back to main process
  // Enabled packages do not get adjusted so this should not trigger expensive calculations
  if (profileInfo && Object.keys(variantChanges).length) {
    store.actions.updateProfile(profileInfo.id, {
      packages: mapValues(variantChanges, variantId => ({ variant: variantId })),
    })
  }

  return {
    filteredPackages,
    packageUi,
  }
}
