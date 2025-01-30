import { isEmpty, mapValues, sortBy, values } from "@salinco/nice-utils"

import { CategoryID, isCategory } from "@common/categories"
import {
  type PackageID,
  getPackageStatus,
  isError,
  isExperimental,
  isIncompatible,
  isOutdated,
} from "@common/packages"
import type { ProfileInfo } from "@common/profiles"
import { type PackageInfo, type Packages, VariantState, getState } from "@common/types"
import { prioritize } from "@common/utils/arrays"
import { getStartOfWordSearchRegex } from "@common/utils/regex"
import type { VariantID, VariantInfo } from "@common/variants"
import { updateProfile } from "@stores/actions"
import {
  type MainState,
  type PackageFilters,
  type PackageUi,
  getCurrentProfile,
} from "@stores/main"
import { hasMatchingContents, isHexSearch } from "./search"

export function getDependentPackages(packages: Packages, dependencyId: PackageID): PackageID[] {
  return values(packages)
    .filter(packageInfo => {
      return values(packageInfo.variants).some(variantInfo => {
        return !!variantInfo.dependencies?.some(dependency => dependency.id === dependencyId)
      })
    })
    .map(packageInfo => packageInfo.id)
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

  if (filters.state && !getState(filters.state, packageInfo, variantInfo, profileInfo)) {
    return false
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
  state: MainState,
  triggeredByFilters: boolean,
): Pick<MainState, "filteredPackages" | "packageUi"> {
  const profileInfo = getCurrentProfile(state)
  const packageFilters = state.packageFilters
  const packages = state.packages
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

  const filteredPackages = values(packages).filter(packageInfo => {
    const packageId = packageInfo.id
    const packageConfig = profileInfo?.packages[packageId]
    const packageStatus = getPackageStatus(packageInfo, profileInfo)

    const allVariants = values(packageInfo.variants)

    const filteredVariants = allVariants.filter(variantInfo => {
      return filterVariant(packageInfo, variantInfo, profileInfo, filters)
    })

    let selectedVariantId =
      packageStatus?.variantId ??
      state.packageUi[packageId]?.variantId ??
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

  const sortedPackages = packageFilters.states.includes(VariantState.NEW)
    ? sortBy(filteredPackages, packageInfo => {
        const variantId = packageUi[packageInfo.id]?.variantId
        return (variantId && packageInfo.variants[variantId]?.lastModified?.valueOf()) ?? 0
      }).map(packageInfo => packageInfo.id)
    : filteredPackages.map(packageInfo => packageInfo.id).sort()

  // Send adjusted variants back to main process
  // Enabled packages do not get adjusted so this should not trigger expensive calculations
  if (profileInfo && !isEmpty(variantChanges)) {
    updateProfile(profileInfo.id, {
      packages: mapValues(variantChanges, variantId => ({ variant: variantId })),
    })
  }

  return {
    filteredPackages: sortedPackages,
    packageUi,
  }
}

export function getOrderedVariants(packageInfo: PackageInfo): VariantInfo[] {
  return prioritize(
    sortBy(values(packageInfo.variants), variant => variant.name ?? variant.id),
    variant => !variant.deprecated,
  )
}
