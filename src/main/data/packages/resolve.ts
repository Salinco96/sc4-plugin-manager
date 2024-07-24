import { getOptionDefaultValue } from "@common/packages"
import {
  Feature,
  Features,
  Issue,
  OptionInfo,
  Options,
  PackageConfig,
  PackageInfo,
  PackageStatus,
  ProfileInfo,
  VariantIssue,
} from "@common/types"
import { removeElement } from "@common/utils/arrays"
import { ReadonlyDeep, keys } from "@common/utils/objects"
import { isEnum } from "@common/utils/types"

export const EXTERNAL_PACKAGE_ID = "<external>"

function getVariantIncompatibilities(
  packageInfo: ReadonlyDeep<Omit<PackageInfo, "status">>,
  variantId: string,
  options: ReadonlyDeep<Options>,
  features: ReadonlyDeep<Partial<Record<Feature, string[]>>>,
): VariantIssue[] {
  const variantInfo = packageInfo.variants[variantId]

  const incompatibilities: VariantIssue[] = []

  // Check feature conflicts
  if (variantInfo.features) {
    for (const feature of variantInfo.features) {
      const conflictPackageIds = features[feature]?.filter(id => id !== packageInfo.id)
      if (conflictPackageIds?.length) {
        incompatibilities.push({
          id: Issue.CONFLICTING_FEATURE,
          external: conflictPackageIds.includes(EXTERNAL_PACKAGE_ID),
          feature,
          packages: removeElement(conflictPackageIds, EXTERNAL_PACKAGE_ID),
        })
      }
    }
  }

  // Check requirements
  if (variantInfo.requirements) {
    for (const requirement in variantInfo.requirements) {
      if (isEnum(requirement, Feature)) {
        const featurePackageIds = features[requirement]
        const isEnabled = !!featurePackageIds?.length
        const isRequired = !!variantInfo.requirements[requirement]

        // Check feature requirements
        if (isRequired !== isEnabled) {
          if (isEnabled) {
            incompatibilities.push({
              id: Issue.INCOMPATIBLE_FEATURE,
              external: featurePackageIds.includes(EXTERNAL_PACKAGE_ID),
              feature: requirement,
              packages: removeElement(featurePackageIds, EXTERNAL_PACKAGE_ID),
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
        const value = options[requirement] // TODO: Default value
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

function isVariantCompatible(
  packageInfo: ReadonlyDeep<Omit<PackageInfo, "status">>,
  variantId: string,
  options: ReadonlyDeep<Options>,
  features: ReadonlyDeep<Partial<Record<Feature, string[]>>>,
): boolean {
  return getVariantIncompatibilities(packageInfo, variantId, options, features).length === 0
}

function getCompatibleVariantIds(
  packageInfo: ReadonlyDeep<Omit<PackageInfo, "status">>,
  options: ReadonlyDeep<Options>,
  features: ReadonlyDeep<Partial<Record<Feature, string[]>>>,
): string[] {
  const variantIds = Object.keys(packageInfo.variants)
  return variantIds.filter(variantId =>
    isVariantCompatible(packageInfo, variantId, options, features),
  )
}

export function getFeatures(
  packages: ReadonlyDeep<Record<string, Omit<PackageInfo, "status">>>,
  status: ReadonlyDeep<Record<string, PackageStatus>>,
  externals: ReadonlyDeep<Features>,
): Partial<Record<Feature, string[]>> {
  const features: Partial<Record<Feature, string[]>> = {}

  for (const packageId in packages) {
    const packageStatus = status[packageId]
    if (packageStatus.enabled) {
      const packageInfo = packages[packageId]
      const variantInfo = packageInfo.variants[packageStatus.variantId]
      if (variantInfo?.features) {
        for (const feature of variantInfo.features) {
          const featurePackages = (features[feature] ??= [])
          featurePackages.push(packageId)
        }
      }
    }
  }

  for (const feature of keys(externals)) {
    if (externals[feature]) {
      const featurePackages = (features[feature] ??= [])
      featurePackages.unshift(EXTERNAL_PACKAGE_ID)
    }
  }

  return features
}

export function resolvePackages(
  packages: ReadonlyDeep<Record<string, Omit<PackageInfo, "status">>>,
  configs: ReadonlyDeep<Partial<Record<string, PackageConfig>>>,
  options: ReadonlyDeep<Options>,
  externals: ReadonlyDeep<Features>,
): {
  /** Resulting features */
  resultingFeatures: Partial<Record<Feature, string[]>>
  /** Resulting package status */
  resultingStatus: { [packageId: string]: PackageStatus }
} {
  const resultingStatus: Record<string, PackageStatus> = {}

  // Calculate initial status from explicit configs
  for (const packageId in packages) {
    const packageConfig = configs[packageId]
    const packageInfo = packages[packageId]

    const enabled = !!packageConfig?.enabled

    let variantId: string | undefined

    // Select configured variant if it exists
    if (packageConfig?.variant) {
      if (packageInfo.variants[packageConfig.variant]) {
        variantId = packageConfig.variant
      } else {
        console.warn(`Unknown package variant '${packageId}#${packageConfig.variant}'`)
      }
    }

    // Otherwise select the default (first) variant
    if (!variantId) {
      variantId = Object.keys(packageInfo.variants)[0]
    }

    const packageStatus: PackageStatus = {
      enabled,
      issues: {},
      options: packageConfig?.options ?? {},
      requiredBy: [],
      variantId,
    }

    resultingStatus[packageId] = packageStatus
  }

  // Calculate initial features
  const initialFeatures = getFeatures(packages, resultingStatus, externals)

  // Select default compatible variant for packages without an explicit variant
  for (const packageId in packages) {
    if (!configs[packageId]?.variant) {
      const packageInfo = packages[packageId]
      const packageStatus = resultingStatus[packageId]
      if (packageStatus.variantId) {
        const variantIds = getCompatibleVariantIds(packageInfo, options, initialFeatures)
        if (variantIds.length && !variantIds.includes(packageStatus.variantId)) {
          packageStatus.variantId = variantIds[0]
        }
      }
    }
  }

  const enableRecursively = (packageId: string) => {
    const packageConfig = configs[packageId]
    const packageInfo = packages[packageId]
    const packageStatus = resultingStatus[packageId]
    if (!packageInfo) {
      console.warn(`Unknown package '${packageId}'`)
      return
    }

    // Enabled packages must have a variant so select the default one
    const variantId = packageStatus.variantId ?? Object.keys(packageInfo.variants)[0]

    let variantInfo = packageInfo.variants[variantId]

    // Use the specified version if available, otherwise the currently-installed version
    if (packageConfig?.version) {
      if (packageConfig.version === variantInfo.update?.version) {
        variantInfo = variantInfo.update
      } else if (packageConfig.version !== variantInfo.version) {
        console.warn(
          `Unknown package version '${packageId}#${packageStatus.variantId}@${packageConfig.version}'`,
        )
      }
    }

    if (variantInfo.dependencies) {
      for (const dependencyId of variantInfo.dependencies) {
        const dependencyStatus = resultingStatus[dependencyId]
        dependencyStatus.requiredBy.push(packageId)
        if (!dependencyStatus.enabled) {
          dependencyStatus.enabled = true
          enableRecursively(dependencyId)
        }
      }
    }
  }

  // Enable dependencies recursively
  for (const packageId in configs) {
    if (configs[packageId]?.enabled) {
      enableRecursively(packageId)
    }
  }

  // Calculate final features
  const resultingFeatures = getFeatures(packages, resultingStatus, externals)

  const cache = new Map<string, boolean>()
  const checkRecursively = (packageId: string) => {
    const cached = cache.get(packageId)
    if (cached !== undefined) {
      return cached
    }

    // Treated as compatible case of circular dependency
    cache.set(packageId, true)

    const packageConfig = configs[packageId]
    const packageInfo = packages[packageId]
    const packageStatus = resultingStatus[packageId]
    if (!packageInfo) {
      return true
    }

    const compatibleVariantIds: string[] = []
    for (const variantId in packageInfo.variants) {
      let variantInfo = packageInfo.variants[variantId]

      if (packageConfig?.version && packageStatus.variantId === variantId) {
        if (packageConfig.version === variantInfo.update?.version) {
          variantInfo = variantInfo.update
        } else if (packageConfig.version !== variantInfo.version) {
          console.warn(
            `Unknown package version '${packageId}#${variantId}@${packageConfig.version}'`,
          )
        }
      }

      const incompatibilities = getVariantIncompatibilities(
        packageInfo,
        variantId,
        options,
        resultingFeatures,
      )

      // Variants with incompatible dependencies are also themselves incompatible
      if (!incompatibilities.length && variantInfo.dependencies) {
        const incompatibleIds = variantInfo.dependencies.filter(dependencyId => {
          return !checkRecursively(dependencyId)
        })

        if (incompatibleIds.length) {
          incompatibilities.push({
            id: Issue.INCOMPATIBLE_DEPENDENCIES,
            packages: incompatibleIds,
          })
        }
      }

      if (incompatibilities.length) {
        packageStatus.issues[variantId] = incompatibilities
      } else {
        compatibleVariantIds.push(variantId)
      }
    }

    const isCompatible = compatibleVariantIds.length !== 0

    // If at least one variant is compatible
    if (isCompatible) {
      // If implicitly-selected variant is incompatible, select the default compatible one
      if (
        packageStatus.variantId &&
        !packageConfig?.variant &&
        !compatibleVariantIds.includes(packageStatus.variantId)
      ) {
        packageStatus.variantId = compatibleVariantIds[0]
      }
    }

    // If no variants are compatible
    cache.set(packageId, isCompatible)
    return isCompatible
  }

  // Calculate incompatibilities recursively
  for (const packageId in packages) {
    checkRecursively(packageId)
  }

  return { resultingFeatures, resultingStatus }
}

export function resolvePackageUpdates(
  packages: ReadonlyDeep<Record<string, PackageInfo>>,
  profile: ReadonlyDeep<ProfileInfo>,
  options: ReadonlyDeep<OptionInfo[]>,
  configUpdates: ReadonlyDeep<Partial<Record<string, PackageConfig>>>,
  optionUpdates: ReadonlyDeep<Options>,
  externalUpdates: ReadonlyDeep<Features>,
): {
  /** Packages that will be disabled */
  disablingPackages: string[]
  /** Packages that will be enabled */
  enablingPackages: string[]
  /** Incompatible packages with an available compatible variant (not installed) */
  explicitVariantChanges: { [packageId: string]: [old: string, new: string] }
  /** Incompatible packages with an available compatible variant (installed) */
  implicitVariantChanges: { [packageId: string]: [old: string, new: string] }
  /** Incompatible externally-installed features */
  incompatibleExternals: Feature[]
  /** Fully-incompatible packages (no compatible variant available) */
  incompatiblePackages: string[]
  /** Variants that will to be installed */
  installingVariants: { [packageId: string]: string }
  /** Resulting package configs */
  resultingConfigs: { [packageId: string]: PackageConfig }
  /** Resulting externals */
  resultingExternals: Features
  /** Resulting features */
  resultingFeatures: Partial<Record<Feature, string[]>>
  /** Resulting profile options */
  resultingOptions: Options
  /** Resulting package status */
  resultingStatus: { [packageId: string]: PackageStatus }
  /** Packages that will have their variant changed */
  selectingVariants: { [packageId: string]: string }
  /** Whether to trigger side-effects such as linking */
  shouldRecalculate: boolean
} {
  let shouldRecalculate = false

  const resultingConfigs = { ...profile.packages } as { [packageId: string]: PackageConfig }
  const resultingExternals = { ...profile.features }
  const resultingOptions = { ...profile.options }

  // Calculate resulting configs (do not mutate current configs)
  for (const packageId in configUpdates) {
    const oldStatus = packages[packageId].status[profile.id]
    const oldConfig = profile.packages[packageId]
    const newConfig = configUpdates[packageId]
    resultingConfigs[packageId] = {
      ...oldConfig,
      ...newConfig,
      options: {
        ...oldConfig?.options,
        ...newConfig?.options,
      },
    }

    shouldRecalculate ||= !!oldStatus?.enabled || !!newConfig?.enabled
  }

  // Calculate resulting externals (do not mutate current externals)
  for (const feature of keys(externalUpdates)) {
    const oldValue = profile.features[feature] ?? false
    const newValue = externalUpdates[feature] ?? oldValue
    resultingExternals[feature] = newValue
    shouldRecalculate ||= oldValue !== newValue
  }

  // Calculate resulting options (do not mutate current options)
  for (const optionId in optionUpdates) {
    const option = options.find(option => option.id === optionId)
    const oldValue = profile.options[optionId] ?? false // TODO: Default value
    const newValue = optionUpdates[optionId] ?? oldValue
    if (option && newValue === getOptionDefaultValue(option)) {
      delete resultingOptions[optionId]
    } else {
      resultingOptions[optionId] = newValue
    }

    shouldRecalculate ||= oldValue !== newValue
  }

  // Calculate resulting status
  const { resultingFeatures, resultingStatus } = resolvePackages(
    packages,
    resultingConfigs,
    resultingOptions,
    resultingExternals,
  )

  const disablingPackages: string[] = []
  const enablingPackages: string[] = []
  const explicitVariantChanges: { [packageId: string]: [old: string, new: string] } = {}
  const implicitVariantChanges: { [packageId: string]: [old: string, new: string] } = {}
  const incompatibleExternals: Feature[] = []
  const incompatiblePackages: string[] = []
  const installingVariants: { [packageId: string]: string } = {}
  const selectingVariants: { [packageId: string]: string } = {}

  for (const packageId in resultingStatus) {
    const packageConfig = resultingConfigs[packageId]
    const packageInfo = packages[packageId]
    const oldStatus = packageInfo.status[profile.id]
    const newStatus = resultingStatus[packageId]

    const variantInfo = packageInfo.variants[newStatus.variantId]

    if (oldStatus) {
      if (oldStatus.variantId !== newStatus.variantId) {
        selectingVariants[packageId] = newStatus.variantId
      }

      const newCompatibleVariantIds = Object.keys(packageInfo.variants).filter(
        variantId => !newStatus.issues[variantId]?.length,
      )

      const oldCompatibleVariantIds = Object.keys(packageInfo.variants).filter(
        variantId => !oldStatus.issues[variantId]?.length,
      )

      const defaultVariantId = newCompatibleVariantIds[0]

      if (newStatus.enabled) {
        if (!oldStatus.enabled) {
          enablingPackages.push(packageId)
        }

        // Ignore conflicts from packages that were already incompatible or that are explicitly changed by this action
        const ignoreConflicts = oldCompatibleVariantIds.length === 0 || !!configUpdates[packageId]

        const isChanged = !oldStatus.enabled || oldStatus.variantId !== newStatus.variantId
        const isConflicted = !newCompatibleVariantIds.includes(newStatus.variantId)
        const isInstalled = !!variantInfo.installed

        // If selected variant is not compatible, mark as conflict
        if (isConflicted && !ignoreConflicts) {
          if (newCompatibleVariantIds.length) {
            const defaultVariantInfo = packageInfo.variants[defaultVariantId]
            if (defaultVariantInfo.installed && !packageConfig?.variant) {
              implicitVariantChanges[packageId] = [oldStatus.variantId, defaultVariantId]
            } else {
              explicitVariantChanges[packageId] = [oldStatus.variantId, defaultVariantId]
            }
          } else {
            incompatiblePackages.push(packageId)
          }
        }

        // If selected variant is not installed, mark it for installation
        if (!isInstalled && (isChanged || configUpdates[packageId])) {
          installingVariants[packageId] = newStatus.variantId
        }

        // If selected variant is being updated, mark it for installation
        if (packageConfig?.version && packageConfig.version === variantInfo.update?.version) {
          installingVariants[packageId] = newStatus.variantId
        }
      } else if (oldStatus.enabled) {
        disablingPackages.push(packageId)
      }
    }
  }

  // Check incompatible externals
  for (const feature of keys(resultingExternals)) {
    if (resultingExternals[feature]) {
      // Ignore conflicts from externals that are explicitly enabled by this action
      const ignoreConflicts = !!externalUpdates[feature]
      const isConflicted = resultingFeatures[feature]?.some(id => id !== EXTERNAL_PACKAGE_ID)

      if (isConflicted && !ignoreConflicts) {
        incompatibleExternals.push(feature)
      }
    }
  }

  // Remove explicit variant if it is the default
  for (const packageId in resultingConfigs) {
    const packageConfig = resultingConfigs[packageId]
    const packageInfo = packages[packageId]
    const variantInfo = packageInfo.variants[resultingStatus[packageId].variantId]

    if (packageConfig?.variant) {
      const defaultVariantId =
        Object.keys(packageInfo.variants).find(
          variantId => !resultingStatus[packageId].issues[variantId]?.length,
        ) ?? Object.keys(packageInfo.variants)[0]

      if (packageConfig.variant === defaultVariantId) {
        delete packageConfig.variant
      }
    }

    if (packageConfig?.options) {
      for (const requirement in packageConfig.options) {
        const option = variantInfo.options?.find(option => option.id === requirement)
        if (option) {
          const defaultValue = getOptionDefaultValue(option)
          if (packageConfig.options?.[requirement] === defaultValue) {
            delete packageConfig.options[requirement]
          }
        }
      }

      if (Object.keys(packageConfig.options).length === 0) {
        delete packageConfig.options
      }
    }
  }

  // console.debug("Updating configs", {
  //   features: externalUpdates,
  //   options: optionUpdates,
  //   packages: configUpdates,
  // })

  // console.debug("Resulting configs", {
  //   features: resultingExternals,
  //   options: resultingOptions,
  //   packages: resultingConfigs,
  //   shouldRecalculate,
  // })

  // console.debug("Resulting changes", {
  //   disablingPackages,
  //   enablingPackages,
  //   installingVariants,
  //   selectingVariants,
  // })

  // console.debug("Resulting conflicts", {
  //   explicitVariantChanges,
  //   implicitVariantChanges,
  //   incompatibleExternals,
  //   incompatiblePackages,
  // })

  return {
    disablingPackages,
    enablingPackages,
    explicitVariantChanges,
    implicitVariantChanges,
    incompatibleExternals,
    incompatiblePackages,
    installingVariants,
    resultingStatus,
    resultingConfigs,
    resultingExternals,
    resultingFeatures,
    resultingOptions,
    selectingVariants,
    shouldRecalculate,
  }
}
