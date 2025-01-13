import { mapValues, values } from "@salinco/nice-utils"
import { useCallback, useMemo } from "react"

import { CategoryID, isCategory } from "@common/categories"
import {
  type PackageID,
  isError,
  isExperimental,
  isIncluded,
  isIncompatible,
  isOutdated,
} from "@common/packages"
import type { ProfileInfo } from "@common/profiles"
import {
  type PackageInfo,
  type PackageStatus,
  type Packages,
  VariantState,
  getState,
} from "@common/types"
import { getStartOfWordSearchRegex } from "@common/utils/regex"
import type { VariantID, VariantInfo } from "@common/variants"

import type { CollectionID, CollectionInfo } from "@common/collections"
import type { ToolID, ToolInfo } from "@common/tools"
import { hasMatchingContents, isHexSearch } from "./search"
import {
  type PackageFilters,
  type PackageUi,
  type Store,
  getCollectionInfo,
  getCurrentProfile,
  getPackageInfo,
  getToolInfo,
  useStore,
} from "./store"

function getFilteredPackages(store: Store): PackageID[] {
  return store.filteredPackages
}

function getPackageStatus(
  packageInfo: PackageInfo,
  profileInfo?: ProfileInfo,
): PackageStatus | undefined {
  return profileInfo && packageInfo.status[profileInfo.id]
}

export function useCollectionInfo(collectionId: CollectionID): CollectionInfo {
  return useStore(
    useCallback(
      store => {
        const toolInfo = getCollectionInfo(store, collectionId)
        if (!toolInfo) {
          throw Error(`Unknown collection '${collectionId}'`)
        }

        return toolInfo
      },
      [collectionId],
    ),
  )
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

export function useFilteredPackages(): PackageID[] {
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

export function useToolInfo(toolId: ToolID): ToolInfo {
  return useStore(
    useCallback(
      store => {
        const toolInfo = getToolInfo(store, toolId)
        if (!toolInfo) {
          throw Error(`Unknown tool '${toolId}'`)
        }

        return toolInfo
      },
      [toolId],
    ),
  )
}

export function useVariantInfo(
  packageId: PackageID,
  variantId: VariantID | undefined,
): VariantInfo {
  return useStore(
    useCallback(
      store => {
        const packageInfo = getPackageInfo(store, packageId)
        const packageUi = store.packageUi[packageId]
        if (!packageInfo || !packageUi) {
          throw Error(`Unknown package '${packageId}'`)
        }

        const variantInfo = packageInfo.variants[variantId ?? packageUi.variantId]
        if (!variantInfo) {
          throw Error(`Unknown variant '${packageId}#${variantId ?? packageUi.variantId}'`)
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
  filters: Omit<PackageFilters, "search"> & { hex?: string; pattern?: RegExp },
): boolean {
  const packageStatus = getPackageStatus(packageInfo, profileInfo)

  const fn = filters.combine === "and" ? "every" : "some"

  if (variantInfo.disabled) {
    return false
  }

  if (filters.authors.length) {
    if (!filters.authors[fn](authorId => variantInfo.authors.includes(authorId))) {
      return false
    }
  }

  if (filters.categories.length) {
    if (!filters.categories[fn](category => isCategory(variantInfo, category))) {
      return false
    }
  }

  if (filters.onlyNew && !variantInfo.new) {
    return false
  }

  if (filters.onlyUpdates && !isOutdated(variantInfo)) {
    return false
  }

  if (filters.state) {
    if (filters.state === VariantState.ENABLED && filters.dependencies) {
      if (!isIncluded(variantInfo, packageStatus)) {
        return false
      }
    } else if (!getState(filters.state, packageInfo, variantInfo, profileInfo)) {
      return false
    }
  }

  if (filters.states.length) {
    if (!filters.states[fn](state => getState(state, packageInfo, variantInfo, profileInfo))) {
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

  if (filters.hex && hasMatchingContents(variantInfo, filters.hex)) {
    return true
  }

  if (filters.pattern && !filters.pattern?.test(`${packageInfo.id}|${packageInfo.name}`)) {
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

  const filters: Omit<PackageFilters, "search"> & { hex?: string; pattern?: RegExp } = {
    ...packageFilters,
    dependencies: packageFilters.dependencies || packageFilters.onlyErrors,
    experimental: packageFilters.experimental || packageFilters.onlyErrors,
    incompatible: packageFilters.incompatible || packageFilters.onlyErrors,
    hex: isHexSearch(search) ? search.toLowerCase() : undefined,
    pattern: search ? getStartOfWordSearchRegex(search) : undefined,
  }

  const filteredPackages = values(packages)
    .filter(packageInfo => {
      const packageId = packageInfo.id
      const packageConfig = profileInfo?.packages[packageId]
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
        variantId: selectedVariantId,
        variantIds: filteredVariants.map(variantInfo => variantInfo.id),
      }

      // Only check errors for the selected variant
      if (packageFilters.onlyErrors && !isError(selectedVariant, packageStatus)) {
        return false
      }

      // Package is visible if we managed to select a visible variant
      return filteredVariants.includes(selectedVariant)
    })
    .map(packageInfo => packageInfo.id)
    .sort()

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
