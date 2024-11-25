import {
  filterValues,
  forEach,
  isArray,
  isEmpty,
  isEqual,
  keys,
  mapDefined,
  mapValues,
  reduce,
  remove,
  union,
  unique,
  values,
} from "@salinco/nice-utils"

import {
  type OptionID,
  type OptionInfo,
  type Options,
  getOptionInfo,
  getOptionValue,
  isOptionDefaultValue,
} from "@common/options"
import {
  LOTS_OPTION_ID,
  MIN_VERSION_OPTION_ID,
  type PackageID,
  checkCondition,
  getPackageStatus,
  isIncluded,
  isIncompatible,
  isInvalid,
} from "@common/packages"
import type { ProfileInfo, ProfileUpdate } from "@common/profiles"
import type { Settings } from "@common/settings"
import {
  EXTERNAL,
  type Feature,
  type Features,
  type LotInfo,
  type PackageInfo,
  type PackageStatus,
  type Packages,
} from "@common/types"
import {
  type DependencyInfo,
  Issue,
  type VariantID,
  type VariantInfo,
  type VariantIssue,
} from "@common/variants"
import { type Warning, getWarningId, getWarningMessage, getWarningTitle } from "@common/warnings"
import type { TaskContext } from "@utils/tasks"

function getVariantIncompatibilities(
  packageInfo: Readonly<Omit<PackageInfo, "status">>,
  variantInfo: Readonly<VariantInfo>,
  profileOptions: Readonly<Options>,
  globalOptions: ReadonlyArray<OptionInfo>,
  features: Readonly<Features>,
  settings: Readonly<Settings>,
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
          packages: remove(conflictPackageIds, EXTERNAL) as PackageID[],
        })
      }
    }
  }

  // Check requirements
  if (variantInfo.requirements) {
    forEach(variantInfo.requirements, (requiredValue, requirement) => {
      if (requirement === MIN_VERSION_OPTION_ID) {
        const minVersion = Number(requiredValue)
        const patchVersion = settings.install?.version?.split(".")[2]
        if (patchVersion && Number(patchVersion) < minVersion) {
          incompatibilities.push({
            id: Issue.INCOMPATIBLE_VERSION,
            minVersion: `1.1.${minVersion}.0`,
          })
        }
      } else {
        const option = getOptionInfo(requirement as OptionID, undefined, globalOptions)
        if (option) {
          const value = getOptionValue(option, profileOptions)
          if (requiredValue !== value) {
            incompatibilities.push({
              id: Issue.INCOMPATIBLE_OPTION,
              option: option.id,
              value: requiredValue,
            })
          }
        } else {
          const featurePackageIds = features[requirement as Feature]
          const isEnabled = !!featurePackageIds?.length
          const isRequired = !!requiredValue

          // Check feature requirements
          if (isRequired !== isEnabled) {
            if (isEnabled) {
              incompatibilities.push({
                id: Issue.INCOMPATIBLE_FEATURE,
                external: featurePackageIds.includes(EXTERNAL),
                feature: requirement as Feature,
                packages: remove(featurePackageIds, EXTERNAL) as PackageID[],
              })
            } else {
              incompatibilities.push({
                id: Issue.MISSING_FEATURE,
                feature: requirement as Feature,
                // TODO: List of packages including the feature
              })
            }
          }
        }
      }
    })
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
  globalOptions: ReadonlyArray<OptionInfo>,
  settings: Readonly<Settings>,
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

      const issues = mapValues(packageInfo.variants, (originalVariantInfo, variantId) => {
        let variantInfo = originalVariantInfo

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
          globalOptions,
          resultingFeatures,
          settings,
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
    }

    return !issues?.some(issue => issue.id !== Issue.INCOMPATIBLE_DEPENDENCIES)
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
        packageStatus.files = undefined
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
  context: TaskContext,
  packages: Readonly<Packages>,
  profileInfo: Readonly<ProfileInfo>,
  profileOptions: ReadonlyArray<OptionInfo>,
  features: Readonly<Features>,
  settings: Readonly<Settings>,
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
  /** Implicit option changes (e.g. different lot IDs across variants) */
  implicitOptionChanges: { [packageId in PackageID]?: { old: Options; new: Options } }
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
  /** Warnings to show */
  warnings: { [id: string]: Warning }
} {
  const resultingProfile = { ...profileInfo }

  let shouldRecalculate = false

  // Calculate resulting externals (do not mutate current externals)
  if (updates.features) {
    resultingProfile.features = reduce(
      updates.features,
      (result, newEnabled, feature) => {
        if (result[feature] !== newEnabled) {
          result[feature] = newEnabled
          shouldRecalculate = true
        }

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
        const globalOption = profileOptions.find(option => option.id === optionId)
        if (!globalOption) {
          throw Error(`Unknown global option '${optionId}'`)
        }

        if (isOptionDefaultValue(globalOption, newValue)) {
          if (result[optionId] !== undefined) {
            delete result[optionId]
            shouldRecalculate = true
          }
        } else if (result[optionId] !== newValue) {
          result[optionId] = newValue
          shouldRecalculate = true
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

        // Must recalculate if package is newly enabled or disabled
        if (!!oldConfig?.enabled !== newConfig.enabled) {
          shouldRecalculate = true
        }

        // Must recalculate if included package is changed
        if (packages[packageId]?.status[resultingProfile.id]?.included) {
          shouldRecalculate = true
        }

        result[packageId] = {
          ...oldConfig,
          ...newConfig,
          options: newConfig.options
            ? { ...oldConfig?.options, ...newConfig.options }
            : newConfig.options === null
              ? undefined
              : oldConfig?.options,
        }

        return result
      },
      { ...profileInfo.packages },
    )
  }

  // Calculate resulting status
  const { resultingFeatures, resultingStatus } = resolvePackages(
    packages,
    resultingProfile,
    profileOptions,
    settings,
  )

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

  const implicitOptionChanges: {
    [packageId in PackageID]?: { old: Options; new: Options }
  } = {}

  const incompatibleExternals: Feature[] = []
  const incompatiblePackages: PackageID[] = []

  const installingVariants: { [packageId in PackageID]?: VariantID } = {}
  const selectingVariants: { [packageId in PackageID]?: VariantID } = {}

  const warnings: { [id: string]: Warning } = {}

  if (shouldRecalculate) {
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

        const enabledLots = packageConfig?.options?.[LOTS_OPTION_ID]
        if (isArray(enabledLots)) {
          const replacedLots = mapDefined(enabledLots, id =>
            variantInfo.lots?.find(lot => lot.id === id)
              ? id
              : variantInfo.lots?.find(lot => lot.replace === id)?.id,
          )

          if (!isEqual(enabledLots, replacedLots)) {
            implicitOptionChanges[packageId] ??= { new: {}, old: {} }
            implicitOptionChanges[packageId].old[LOTS_OPTION_ID] = enabledLots
            implicitOptionChanges[packageId].new[LOTS_OPTION_ID] = replacedLots
          }
        }

        if (newStatus.enabled && oldStatus.enabled) {
          if (variantInfo.warnings) {
            for (const warning of variantInfo.warnings) {
              if (warning.on === "variant") {
                const id = getWarningId(warning, packageId)

                warnings[id] ??= {
                  id,
                  message: getWarningMessage(warning),
                  packageIds: [],
                  title: getWarningTitle(warning),
                }

                warnings[id].packageIds.push(packageId)
              }
            }
          }
        }
      }

      const defaultVariant = getDefaultVariant(packageInfo, resultingProfile)

      if (newStatus.enabled) {
        if (!oldStatus.enabled) {
          enablingPackages.push(packageId)

          if (variantInfo.warnings) {
            for (const warning of variantInfo.warnings) {
              if (warning.on === "enable") {
                const id = getWarningId(warning, packageId)

                warnings[id] ??= {
                  id,
                  message: getWarningMessage(warning),
                  packageIds: [],
                  title: getWarningTitle(warning),
                }

                warnings[id].packageIds.push(packageId)
              }
            }
          }
        }
      } else if (oldStatus.enabled) {
        disablingPackages.push(packageId)

        if (variantInfo.warnings) {
          for (const warning of variantInfo.warnings) {
            if (warning.on === "disable") {
              const id = getWarningId(warning, packageId)

              warnings[id] ??= {
                id,
                message: getWarningMessage(warning),
                packageIds: [],
                title: getWarningTitle(warning),
              }

              warnings[id].packageIds.push(packageId)
            }
          }
        }
      }

      if (isIncluded(variantInfo, newStatus)) {
        if (!isIncluded(variantInfo, oldStatus)) {
          includingPackages.push(packageId)
        }

        const compatibleVariants = values(packageInfo.variants).filter(
          variantInfo => !isInvalid(variantInfo, newStatus),
        )

        const packageUpdate = updates.packages?.[packageId]

        const isChanged = !oldStatus.included || oldStatus.variantId !== newStatus.variantId
        const isConflicted = !compatibleVariants.some(variant => variant.id === newStatus.variantId)
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
          } else if (defaultVariant.installed && !packageConfig?.variant) {
            // If compatible variant is already installed and current variant is not explicitly selected, switch implicitly
            implicitVariantChanges[packageId] = {
              old: oldStatus.variantId,
              new: defaultVariant.id,
            }
          } else {
            // Otherwise, require confirmation from user
            explicitVariantChanges[packageId] = {
              old: oldStatus.variantId,
              new: defaultVariant.id,
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
        packageConfig.variant = undefined
      }

      // Remove explicit default options
      if (packageConfig?.options) {
        packageConfig.options = filterValues(packageConfig.options, (optionValue, optionId) => {
          const option = variantInfo.options?.find(option => option.id === optionId)
          return !!option && !isOptionDefaultValue(option, optionValue)
        })

        if (isEmpty(packageConfig.options)) {
          packageConfig.options = undefined
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
  }

  console.debug("Updating profile", updates)

  console.debug("Resulting profile", resultingProfile)

  if (shouldRecalculate) {
    const oldLots = getEnabledLots(
      context,
      packages,
      undefined,
      profileInfo,
      profileOptions,
      features,
      settings,
    )

    const newLots = getEnabledLots(
      context,
      packages,
      resultingStatus,
      resultingProfile,
      profileOptions,
      resultingFeatures,
      settings,
    )

    const replacingLots: {
      [lotId: string]: { newInfo: LotInfo; oldInfo: LotInfo; packageId: PackageID }
    } = {}

    const replacingMaxisLots: {
      [lotId: string]: { lotInfo: LotInfo; packageId: PackageID }
    } = {}

    for (const lotId in newLots) {
      const { lotInfo, packageId } = newLots[lotId]

      if (lotInfo.replace && oldLots[lotInfo.replace]) {
        if (oldLots[lotId].lotInfo !== lotInfo) {
          replacingLots[lotId] = {
            newInfo: lotInfo,
            oldInfo: oldLots[lotInfo.replace].lotInfo,
            packageId,
          }
        }

        delete oldLots[lotInfo.replace]
        delete newLots[lotId]
      } else if (oldLots[lotId]) {
        delete oldLots[lotId]
        delete newLots[lotId]
      } else if (lotInfo.replaceMaxis) {
        replacingMaxisLots[lotId] = {
          lotInfo,
          packageId,
        }

        delete newLots[lotId]
      }
    }

    if (!isEmpty(replacingMaxisLots)) {
      const lotNames = unique(
        values(replacingMaxisLots).map(({ lotInfo, packageId }) => {
          const lotName = lotInfo.label ?? lotInfo.name
          const packageName = packages[packageId]?.name ?? packageId
          return lotName
            ? `${packageName} - ${lotName} (0x${lotInfo.id})`
            : `${packageName} (0x${lotInfo.id})`
        }),
      ).sort()

      warnings.replacingMaxisLots = {
        id: "replacingMaxisLots",
        message: `The following lots are overrides of Maxis lots. To avoid issues such as the 'Phantom Slider' bug, you must bulldoze all Maxis instances from your regions before enabling these overrides:\n${lotNames.map(name => ` - ${name} `).join("\n")}`,
        packageIds: unique(values(replacingMaxisLots).map(({ packageId }) => packageId)),
        title: "Replacing Maxis lots",
      }
    }

    if (!isEmpty(oldLots)) {
      const lotNames = unique(
        values(oldLots).map(({ lotInfo, packageId }) => {
          const lotName = lotInfo.label ?? lotInfo.name
          const packageName = packages[packageId]?.name ?? packageId
          return lotName
            ? `${packageName} - ${lotName} (0x${lotInfo.id})`
            : `${packageName} (0x${lotInfo.id})`
        }),
      ).sort()

      warnings.disablingLots = {
        id: "disablingLots",
        message: `Before disabling the following lots, you must bulldoze all instances from your regions:\n${lotNames.map(name => ` - ${name} `).join("\n")}`,
        packageIds: unique(values(oldLots).map(({ packageId }) => packageId)),
        title: "Disabling lots",
      }
    }

    if (!isEmpty(replacingLots)) {
      const lotNames = unique(
        values(replacingLots).map(({ oldInfo, packageId }) => {
          const lotName = oldInfo.label ?? oldInfo.name
          const packageName = packages[packageId]?.name ?? packageId
          return lotName
            ? `${packageName} - ${lotName} (0x${oldInfo.id})`
            : `${packageName} (0x${oldInfo.id})`
        }),
      ).sort()

      warnings.replacingLots = {
        id: "replacingLots",
        message: `The following lots are not compatible across variants. Before selecting a new variant, you must bulldoze all instances from your regions:\n${lotNames.map(name => ` - ${name} `).join("\n")}`,
        packageIds: unique(values(replacingLots).map(({ packageId }) => packageId)),
        title: "Replacing lots",
      }
    }

    console.debug("Resulting changes", {
      disablingLots: oldLots,
      disablingPackages,
      enablingLots: newLots,
      enablingPackages,
      excludingPackages,
      includingPackages,
      installingVariants,
      replacingLots,
      selectingVariants,
      shouldRecalculate,
    })

    console.debug("Resulting conflicts", {
      explicitVariantChanges,
      implicitOptionChanges,
      implicitVariantChanges,
      incompatibleExternals,
      incompatiblePackages,
      warnings,
    })
  }

  return {
    disablingPackages,
    enablingPackages,
    excludingPackages,
    explicitVariantChanges,
    implicitOptionChanges,
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
    warnings,
  }
}

function getEnabledLots(
  context: TaskContext,
  packages: Readonly<Packages>,
  packageStatus: { [packageId in PackageID]?: PackageStatus } | undefined,
  profileInfo: ProfileInfo,
  profileOptions: ReadonlyArray<OptionInfo>,
  features: Readonly<Features>,
  settings: Readonly<Settings>,
): { [lotId: string]: { lotInfo: LotInfo; packageId: PackageID } } {
  const lots: { [lotId: string]: { lotInfo: LotInfo; packageId: PackageID } } = {}

  forEach(profileInfo.packages, (packageConfig, packageId) => {
    if (packageConfig.enabled) {
      const packageInfo = packages[packageId]
      const variantId = packageStatus
        ? packageStatus[packageId]?.variantId
        : packageInfo?.status[profileInfo.id]?.variantId
      if (!packageInfo || !variantId) {
        return context.raiseInDev(`Unknown package '${packageId}'`)
      }

      const variantInfo = packageInfo.variants[variantId]
      if (!variantInfo) {
        return context.raiseInDev(`Unknown variant '${packageId}#${variantId}'`)
      }

      if (!variantInfo.lots) {
        return
      }

      for (const lotInfo of variantInfo.lots) {
        // TODO: ID should always be a TGI
        if (!lotInfo.id.match(/^[0-9a-f]{8}$/i)) {
          continue
        }

        // Check if lot is enabled
        const option = getOptionInfo(LOTS_OPTION_ID, variantInfo.options, profileOptions)

        if (option) {
          const enabledLots = getOptionValue(option, {
            ...packageConfig?.options,
            ...profileInfo?.options,
          }) as string[]

          if (!enabledLots.includes(lotInfo.id)) {
            continue
          }
        }

        // Check if lot is supported
        const isSupported = checkCondition(
          lotInfo.requirements,
          packageId,
          variantInfo,
          profileInfo,
          profileOptions,
          features,
          settings,
        )

        if (!isSupported) {
          continue
        }

        lots[lotInfo.id] = { lotInfo, packageId }
      }
    }
  })

  return lots
}
