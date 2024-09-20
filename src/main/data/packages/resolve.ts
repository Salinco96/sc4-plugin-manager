import { OptionInfo, Options, isOptionDefaultValue } from "@common/options"
import {
  PackageID,
  getPackageStatus,
  isEnabled,
  isIncluded,
  isIncompatible,
  isInvalid,
} from "@common/packages"
import { ProfileInfo, ProfileUpdate } from "@common/profiles"
import {
  DependencyInfo,
  EXTERNAL,
  Feature,
  Features,
  Issue,
  PackageInfo,
  PackageStatus,
  Packages,
  VariantInfo,
  VariantIssue,
} from "@common/types"
import { containsWhere, removeElement, union } from "@common/utils/arrays"
import { filterValues, forEach, keys, mapValues, reduce, values } from "@common/utils/objects"
import { isEnum } from "@common/utils/types"
import { VariantID } from "@common/variants"

function getVariantIncompatibilities(
  packageInfo: Readonly<Omit<PackageInfo, "status">>,
  variantInfo: Readonly<VariantInfo>,
  globalOptions: Readonly<Options>,
  features: Readonly<Features>,
): VariantIssue[] {
  const incompatibilities: VariantIssue[] = []

  // Check feature conflicts
  if (packageInfo.features) {
    for (const feature of packageInfo.features) {
      const conflictPackageIds = features[feature]?.filter(id => id !== packageInfo.id)
      if (conflictPackageIds?.length) {
        incompatibilities.push({
          id: Issue.CONFLICTING_FEATURE,
          external: conflictPackageIds.includes(EXTERNAL),
          feature,
          packages: removeElement(conflictPackageIds, EXTERNAL) as PackageID[],
        })
      }
    }
  }

  // Check requirements
  if (variantInfo.requirements) {
    for (const requirement of keys(variantInfo.requirements)) {
      if (isEnum(requirement, Feature)) {
        const featurePackageIds = features[requirement]
        const isEnabled = !!featurePackageIds?.length
        const isRequired = !!variantInfo.requirements[requirement]

        // Check feature requirements
        if (isRequired !== isEnabled) {
          if (isEnabled) {
            incompatibilities.push({
              id: Issue.INCOMPATIBLE_FEATURE,
              external: featurePackageIds.includes(EXTERNAL),
              feature: requirement,
              packages: removeElement(featurePackageIds, EXTERNAL) as PackageID[],
            })
          } else {
            incompatibilities.push({
              id: Issue.MISSING_FEATURE,
              feature: requirement,
              // TODO: List of packages including the feature
            })
          }
        }
      } else {
        const requiredValue = variantInfo.requirements[requirement]
        const value = globalOptions[requirement] // TODO: Default value
        if (requiredValue !== value) {
          incompatibilities.push({
            id: Issue.INCOMPATIBLE_OPTION,
            option: requirement,
            value: requiredValue,
          })
        }
      }
    }
  }

  return incompatibilities
}

export function getDefaultVariant(
  packageInfo: Readonly<PackageInfo>,
  profileInfo: Readonly<ProfileInfo>,
): VariantInfo {
  const packageStatus = packageInfo.status[profileInfo.id]

  const compatibleVariant = values(packageInfo.variants).find(
    variantInfo => !isIncompatible(variantInfo, packageStatus),
  )

  return compatibleVariant ?? values(packageInfo.variants)[0]
}

export function getFeatures(
  packages: Readonly<Packages>,
  profileInfo: Readonly<ProfileInfo>,
): Features {
  return reduce(
    profileInfo.packages,
    (result, packageConfig, packageId) => {
      if (packageConfig.enabled) {
        const packageInfo = packages[packageId]

        if (packageInfo?.features) {
          for (const feature of packageInfo.features) {
            result[feature] ??= []
            result[feature].push(packageId)
          }
        }
      }

      return result
    },
    reduce(
      profileInfo.features,
      (result, enabled, feature) => {
        if (enabled) {
          result[feature] ??= []
          result[feature].push(EXTERNAL)
        }

        return result
      },
      {} as Features,
    ),
  )
}

export function resolvePackages(
  packages: Readonly<Packages>,
  profileInfo: Readonly<ProfileInfo>,
): {
  /** Resulting features */
  resultingFeatures: Features
  /** Resulting package status */
  resultingStatus: { [packageId in PackageID]?: PackageStatus }
} {
  // Calculate resulting features
  const resultingFeatures = getFeatures(packages, profileInfo)

  const resultingStatus: { [packageId in PackageID]?: PackageStatus } = {}

  function resolvePackage(packageInfo: PackageInfo, dependencyInfo?: DependencyInfo): boolean {
    const packageId = packageInfo.id

    const packageConfig = profileInfo.packages[packageId]

    let packageStatus = resultingStatus[packageId]

    if (!packageStatus) {
      let selectedVariantId: VariantID | undefined

      // Select configured variant if it exists
      if (packageConfig?.variant) {
        if (packageInfo.variants[packageConfig.variant]) {
          selectedVariantId = packageConfig.variant
        } else {
          console.warn(`Unknown variant '${packageId}#${packageConfig.variant}'`)
        }
      }

      // Set temporary status to avoid circular dependencies
      resultingStatus[packageId] = {
        variantId: selectedVariantId ?? keys(packageInfo.variants)[0],
      }

      const issues = mapValues(packageInfo.variants, (variantInfo, variantId) => {
        if (packageConfig?.variant === variantId && packageConfig.version) {
          if (packageConfig.version === variantInfo.update?.version) {
            variantInfo = variantInfo.update
          } else if (packageConfig.version !== variantInfo.version) {
            console.warn(`Unknown version '${packageId}#${variantId}@${packageConfig.version}'`)
          }
        }

        // Calculate incompatibilities
        const issues = getVariantIncompatibilities(
          packageInfo,
          variantInfo,
          profileInfo.options,
          resultingFeatures,
        )

        // Calculate incompatibilities of dependencies
        if (variantInfo.dependencies) {
          const incompatibleDependencies = variantInfo.dependencies.filter(subDependencyInfo => {
            const subPackageInfo = packages[subDependencyInfo.id]
            return !!subPackageInfo && !resolvePackage(subPackageInfo, subDependencyInfo)
          })

          if (incompatibleDependencies.length) {
            issues.push({
              id: Issue.INCOMPATIBLE_DEPENDENCIES,
              packages: incompatibleDependencies.map(subDependencyInfo => subDependencyInfo.id),
            })
          }
        }

        return issues
      })

      // Select first compatible variant if not explicit
      selectedVariantId ??= keys(packageInfo.variants).find(variantId => !issues[variantId]?.length)

      // Select first variant if none compatible
      selectedVariantId ??= keys(packageInfo.variants)[0]

      // Set final status
      packageStatus = {
        issues,
        variantId: selectedVariantId,
      }

      resultingStatus[packageId] = packageStatus
    }

    const issues = packageStatus?.issues?.[packageStatus.variantId]

    // Ignore incompatible dependencies if not transitive
    if (!dependencyInfo || dependencyInfo.transitive) {
      return !issues?.length
    } else {
      return !issues?.some(issue => issue.id !== Issue.INCOMPATIBLE_DEPENDENCIES)
    }
  }

  // Resolve the compatible/selected variants of all packages
  forEach(packages, packageInfo => {
    resolvePackage(packageInfo)
  })

  function includePackage(
    packageId: PackageID,
    requiredBy?: PackageID,
    dependencyInfo?: DependencyInfo,
  ): void {
    const packageConfig = profileInfo.packages[packageId]
    const packageInfo = packages[packageId]
    const packageStatus = resultingStatus[packageId]

    if (!packageInfo || !packageStatus) {
      console.warn(`Unknown package '${packageId}'`)
      return
    }

    if (requiredBy) {
      packageStatus.requiredBy ??= []
      packageStatus.requiredBy.push(requiredBy)
    } else {
      packageStatus.enabled = true
    }

    if (dependencyInfo?.include) {
      if (packageStatus.files) {
        packageStatus.files = union(packageStatus.files, dependencyInfo.include)
      } else if (!packageStatus.included) {
        packageStatus.files = dependencyInfo.include
      } else {
        delete packageStatus.files
      }
    }

    packageStatus.included = true

    // Include dependencies if transitive
    if (!packageStatus.transitive) {
      packageStatus.transitive = !dependencyInfo || dependencyInfo.transitive

      if (packageStatus.transitive) {
        const variantId = packageStatus.variantId

        let variantInfo = packages[packageId]?.variants[variantId]
        if (variantInfo) {
          if (packageConfig?.version && packageConfig.version === variantInfo.update?.version) {
            variantInfo = variantInfo.update
          }

          if (variantInfo.dependencies) {
            for (const subDependencyInfo of variantInfo.dependencies) {
              includePackage(subDependencyInfo.id, packageId, subDependencyInfo)
            }
          }
        } else {
          console.warn(`Unknown variant '${packageId}#${variantId}'`)
        }
      }
    }
  }

  // Include enabled packages and their dependencies recursively
  forEach(profileInfo.packages, (packageConfig, packageId) => {
    if (packageConfig.enabled) {
      includePackage(packageId)
    }
  })

  return { resultingFeatures, resultingStatus }
}

export function resolvePackageUpdates(
  packages: Readonly<Packages>,
  profileInfo: Readonly<ProfileInfo>,
  globalOptions: ReadonlyArray<Readonly<OptionInfo>>,
  updates: ProfileUpdate,
): {
  /** Packages that will be disabled */
  disablingPackages: PackageID[]
  /** Packages that will be enabled */
  enablingPackages: PackageID[]
  /** Packages that will be excluded */
  excludingPackages: PackageID[]
  /** Incompatible packages with an available compatible variant (not installed) */
  explicitVariantChanges: { [packageId in PackageID]?: { old: VariantID; new: VariantID } }
  /** Incompatible packages with an available compatible variant (installed) */
  implicitVariantChanges: { [packageId in PackageID]?: { old: VariantID; new: VariantID } }
  /** Packages that will be included */
  includingPackages: PackageID[]
  /** Incompatible externally-installed features */
  incompatibleExternals: Feature[]
  /** Fully-incompatible packages (no compatible variant available) */
  incompatiblePackages: PackageID[]
  /** Variants that will to be installed */
  installingVariants: { [packageId in PackageID]?: VariantID }
  /** Resulting features */
  resultingFeatures: Features
  /** Resulting profile */
  resultingProfile: ProfileInfo
  /** Resulting package status */
  resultingStatus: { [packageId in PackageID]?: PackageStatus }
  /** Packages that will have their variant changed */
  selectingVariants: { [packageId in PackageID]?: VariantID }
  /** Whether to trigger side-effects such as linking */
  shouldRecalculate: boolean
} {
  const resultingProfile = { ...profileInfo }

  let shouldRecalculate = false

  // Calculate resulting externals (do not mutate current externals)
  if (updates.features) {
    resultingProfile.features = reduce(
      updates.features,
      (result, newEnabled, feature) => {
        // Must recalculate if external is changed
        shouldRecalculate ||= result[feature] !== newEnabled
        result[feature] = newEnabled
        return result
      },
      { ...profileInfo.features },
    )
  }

  // Calculate resulting global options (do not mutate current options)
  if (updates.options) {
    resultingProfile.options = reduce(
      updates.options,
      (result, newValue, optionId) => {
        const globalOption = globalOptions.find(option => option.id === optionId)
        if (!globalOption) {
          throw Error(`Unknown global option '${optionId}'`)
        }

        if (isOptionDefaultValue(globalOption, newValue)) {
          // Must recalculate if global option is changed
          shouldRecalculate ||= result[optionId] !== undefined
          delete result[optionId]
        } else {
          // Must recalculate if global option is changed
          shouldRecalculate ||= result[optionId] !== newValue
          result[optionId] = newValue
        }

        return result
      },
      { ...profileInfo.options },
    )
  }

  // Calculate resulting configs (do not mutate current configs)
  if (updates.packages) {
    resultingProfile.packages = reduce(
      updates.packages,
      (result, newConfig, packageId) => {
        const oldConfig = profileInfo.packages[packageId]

        // Must recalculate if package is enabled or disabled
        shouldRecalculate ||= oldConfig?.enabled !== newConfig.enabled

        // Must recalculate if included package is changed
        shouldRecalculate ||= !!packages[packageId]?.status[resultingProfile.id]?.included

        result[packageId] = {
          ...oldConfig,
          ...newConfig,
          options: {
            ...oldConfig?.options,
            ...newConfig?.options,
          },
        }

        return result
      },
      { ...profileInfo.packages },
    )
  }

  // Calculate resulting status
  const { resultingFeatures, resultingStatus } = resolvePackages(packages, resultingProfile)

  const disablingPackages: PackageID[] = []
  const enablingPackages: PackageID[] = []

  const excludingPackages: PackageID[] = []
  const includingPackages: PackageID[] = []

  const explicitVariantChanges: {
    [packageId in PackageID]?: { old: VariantID; new: VariantID }
  } = {}

  const implicitVariantChanges: {
    [packageId in PackageID]?: { old: VariantID; new: VariantID }
  } = {}

  const incompatibleExternals: Feature[] = []
  const incompatiblePackages: PackageID[] = []

  const installingVariants: { [packageId in PackageID]?: VariantID } = {}
  const selectingVariants: { [packageId in PackageID]?: VariantID } = {}

  forEach(resultingStatus, (newStatus, packageId) => {
    const packageConfig = resultingProfile.packages[packageId]
    const packageInfo = packages[packageId]
    if (!packageInfo) {
      throw Error(`Unknown package '${packageId}'`)
    }

    const variantInfo = packageInfo.variants[newStatus.variantId]
    if (!variantInfo) {
      throw Error(`Unknown variant '${packageId}#${newStatus.variantId}'`)
    }

    const oldStatus = getPackageStatus(packageInfo, profileInfo)
    if (!oldStatus) {
      throw Error(`Unknown package '${packageId}'`)
    }

    if (oldStatus.variantId !== newStatus.variantId) {
      selectingVariants[packageId] = newStatus.variantId
    }

    const defaultVariant = getDefaultVariant(packageInfo, resultingProfile)

    if (isEnabled(newStatus)) {
      if (!isEnabled(oldStatus)) {
        enablingPackages.push(packageId)
      }
    } else if (isEnabled(oldStatus)) {
      disablingPackages.push(packageId)
    }

    if (isIncluded(newStatus)) {
      if (!isIncluded(oldStatus)) {
        includingPackages.push(packageId)
      }

      const compatibleVariants = values(packageInfo.variants).filter(
        variantInfo => !isInvalid(variantInfo, newStatus),
      )

      const packageUpdate = updates.packages?.[packageId]

      const isChanged = !oldStatus.included || oldStatus.variantId !== newStatus.variantId
      const isConflicted = !containsWhere(compatibleVariants, { id: newStatus.variantId })
      const isFullyIncompatible = !compatibleVariants.length
      const isInstalled = !!variantInfo.installed
      const isUpdated = !!packageUpdate?.enabled || !!packageUpdate?.variant

      const wasFullyIncompatible = !values(packageInfo.variants).some(
        variantInfo => !isInvalid(variantInfo, oldStatus),
      )

      // If selected variant is not compatible, mark as conflict
      // Ignore conflicts from packages that were already incompatible or that are explicitly changed by this action
      if (isConflicted && !wasFullyIncompatible && !isUpdated) {
        if (isFullyIncompatible) {
          incompatiblePackages.push(packageId)
        } else {
          // If compatible variant is already installed and current variant is not explicitly selected, switch implicitly
          if (defaultVariant.installed && !packageConfig?.variant) {
            implicitVariantChanges[packageId] = {
              old: oldStatus.variantId,
              new: defaultVariant.id,
            }
          } else {
            explicitVariantChanges[packageId] = {
              old: oldStatus.variantId,
              new: defaultVariant.id,
            }
          }
        }
      }

      // If selected variant is not installed, mark it for installation
      if (!isInstalled && (isChanged || isUpdated)) {
        installingVariants[packageId] = newStatus.variantId
      }

      // If selected variant is being updated, mark it for installation
      if (packageConfig?.version && packageConfig.version === variantInfo.update?.version) {
        installingVariants[packageId] = newStatus.variantId
      }
    } else if (oldStatus.included) {
      excludingPackages.push(packageId)
    }

    // Remove explicit variant if it is the default
    if (packageConfig?.variant === defaultVariant.id) {
      delete packageConfig.variant
    }

    // Remove explicit default options
    if (packageConfig?.options) {
      packageConfig.options = filterValues(packageConfig.options, (optionValue, optionId) => {
        const option = variantInfo.options?.find(option => option.id === optionId)
        return !!option && !isOptionDefaultValue(option, optionValue)
      })

      if (Object.keys(packageConfig.options).length === 0) {
        delete packageConfig.options
      }
    }
  })

  // Check incompatible externals
  forEach(resultingProfile.features, (enabled, feature) => {
    if (enabled) {
      const isConflicted = !!resultingFeatures[feature]?.some(id => id !== EXTERNAL)
      const isUpdated = !!updates.features?.[feature]

      // Ignore conflicts from externals that are explicitly enabled by this action
      if (isConflicted && !isUpdated) {
        incompatibleExternals.push(feature)
      }
    }
  })

  console.debug("Updating profile", updates)

  console.debug("Resulting profile", resultingProfile)

  console.debug("Resulting changes", {
    disablingPackages,
    enablingPackages,
    excludingPackages,
    includingPackages,
    installingVariants,
    selectingVariants,
  })

  console.debug("Resulting conflicts", {
    explicitVariantChanges,
    implicitVariantChanges,
    incompatibleExternals,
    incompatiblePackages,
  })

  return {
    disablingPackages,
    enablingPackages,
    excludingPackages,
    explicitVariantChanges,
    implicitVariantChanges,
    includingPackages,
    incompatibleExternals,
    incompatiblePackages,
    installingVariants,
    resultingStatus,
    resultingFeatures,
    resultingProfile,
    selectingVariants,
    shouldRecalculate,
  }
}
