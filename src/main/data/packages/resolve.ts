import { PackageConfig, PackageInfo, PackageStatus, ProfileInfo } from "@common/types"

export const EXTERNAL_PACKAGE_ID = "<external>"

export type ReadonlyDeep<T> = {
  readonly [P in keyof T]: ReadonlyDeep<T[P]>
}

function getVariantIncompatibilities(
  packageInfo: ReadonlyDeep<Omit<PackageInfo, "status">>,
  variantId: string,
  conflictGroups: ReadonlyDeep<Record<string, string[]>>,
): string[] {
  const variantInfo = packageInfo.variants[variantId]

  const incompatibilities: string[] = []

  // Check conflict groups
  if (variantInfo.conflictGroups) {
    for (const groupId of variantInfo.conflictGroups) {
      const conflictPackageId = conflictGroups[groupId]?.find(id => id !== packageInfo.id)
      if (conflictPackageId) {
        // TODO: Use ID/data object here, and convert to message in UI code
        incompatibilities.push(`Conflicting with ${conflictPackageId}`)
      }
    }
  }

  // Check requirements
  if (variantInfo.requirements) {
    for (const groupId in variantInfo.requirements) {
      const value = variantInfo.requirements[groupId]

      // Check conflict group requirements
      if (value !== !!conflictGroups[groupId]?.length) {
        // TODO: Use ID/data object here, and convert to message in UI code
        incompatibilities.push(`Requires ${groupId}${value ? "" : " not"} to be present`)
      }
    }
  }

  return incompatibilities
}

function isVariantCompatible(
  packageInfo: ReadonlyDeep<Omit<PackageInfo, "status">>,
  variantId: string,
  conflictGroups: ReadonlyDeep<Record<string, string[]>>,
): boolean {
  return getVariantIncompatibilities(packageInfo, variantId, conflictGroups).length === 0
}

function getCompatibleVariantIds(
  packageInfo: ReadonlyDeep<Omit<PackageInfo, "status">>,
  conflictGroups: ReadonlyDeep<Record<string, string[]>>,
): string[] {
  const variantIds = Object.keys(packageInfo.variants)
  return variantIds.filter(variantId => isVariantCompatible(packageInfo, variantId, conflictGroups))
}

export function getConflictGroups(
  packages: ReadonlyDeep<Record<string, Omit<PackageInfo, "status">>>,
  status: ReadonlyDeep<Record<string, PackageStatus>>,
  externals: ReadonlyDeep<Partial<Record<string, boolean>>>,
): Record<string, string[]> {
  const conflictGroups: Record<string, string[]> = {}

  for (const packageId in packages) {
    const packageStatus = status[packageId]
    if (packageStatus.enabled) {
      const packageInfo = packages[packageId]
      const variantInfo = packageInfo.variants[packageStatus.variantId]
      if (variantInfo?.conflictGroups) {
        for (const groupId of variantInfo.conflictGroups) {
          conflictGroups[groupId] ??= []
          conflictGroups[groupId].push(packageId)
        }
      }
    }
  }

  for (const groupId in externals) {
    if (externals[groupId]) {
      conflictGroups[groupId] ??= []
      conflictGroups[groupId].unshift(EXTERNAL_PACKAGE_ID)
    }
  }

  return conflictGroups
}

export function resolvePackages(
  packages: ReadonlyDeep<Record<string, Omit<PackageInfo, "status">>>,
  configs: ReadonlyDeep<Partial<Record<string, PackageConfig>>>,
  externals: ReadonlyDeep<Partial<Record<string, boolean>>>,
): {
  /** Resulting conflict groups */
  conflictGroups: { [groupId: string]: string[] }
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

  // Calculate initial conflict groups
  const initialConflictGroups = getConflictGroups(packages, resultingStatus, externals)

  // Select default compatible variant for packages without an explicit variant
  for (const packageId in packages) {
    if (!configs[packageId]?.variant) {
      const packageInfo = packages[packageId]
      const packageStatus = resultingStatus[packageId]
      if (packageStatus.variantId) {
        const variantIds = getCompatibleVariantIds(packageInfo, initialConflictGroups)
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

  // Calculate final conflict groups
  const conflictGroups = getConflictGroups(packages, resultingStatus, externals)

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

      const incompatibilities = getVariantIncompatibilities(packageInfo, variantId, conflictGroups)

      // Variants with incompatible dependencies are also themselves incompatible
      if (!incompatibilities.length && variantInfo.dependencies) {
        const incompatibleIds = variantInfo.dependencies.filter(dependencyId => {
          return !checkRecursively(dependencyId)
        })

        if (incompatibleIds.length) {
          if (incompatibleIds.length === 1) {
            incompatibilities.push(`Dependency ${incompatibleIds[0]} is not compatible`)
          } else {
            incompatibilities.push(`${incompatibleIds.length} dependencies are not compatible`)
          }
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

  return { conflictGroups, resultingStatus: resultingStatus }
}

export function resolvePackageUpdates(
  packages: ReadonlyDeep<Record<string, PackageInfo>>,
  profile: ReadonlyDeep<ProfileInfo>,
  configUpdates: ReadonlyDeep<Partial<Record<string, PackageConfig>>>,
  externalUpdates: ReadonlyDeep<Partial<Record<string, boolean>>>,
): {
  /** Packages that will be disabled */
  disablingPackages: string[]
  /** Packages that will be enabled */
  enablingPackages: string[]
  /** Incompatible packages with an available compatible variant (not installed) */
  explicitVariantChanges: { [packageId: string]: [old: string, new: string] }
  /** Incompatible packages with an available compatible variant (installed) */
  implicitVariantChanges: { [packageId: string]: [old: string, new: string] }
  /** Incompatible externally-installed package groups */
  incompatibleExternals: string[]
  /** Fully-incompatible packages (no compatible variant available) */
  incompatiblePackages: string[]
  /** Variants that will to be installed */
  installingVariants: { [packageId: string]: string }
  /** Resulting package configs */
  resultingConfigs: { [packageId: string]: PackageConfig | undefined }
  /** Resulting externals */
  resultingExternals: { [groupId: string]: boolean | undefined }
  /** Resulting package status */
  resultingStatus: { [packageId: string]: PackageStatus }
  /** Packages that will have their variant changed */
  selectingVariants: { [packageId: string]: string }
  /** Whether to trigger side-effects such as linking */
  shouldRecalculate: boolean
} {
  let shouldRecalculate = false

  const resultingConfigs = { ...profile.packages }
  const resultingExternals = { ...profile.externals }

  // Calculate resulting configs (do not mutate current configs)
  for (const packageId in configUpdates) {
    const oldStatus = packages[packageId].status[profile.id]
    const oldConfig = profile.packages[packageId]
    const newConfig = configUpdates[packageId]
    resultingConfigs[packageId] = { ...oldConfig, ...newConfig }
    shouldRecalculate ||= !!oldStatus?.enabled || !!newConfig?.enabled
  }

  // Calculate resulting externals (do not mutate current externals)
  for (const groupId in externalUpdates) {
    const oldValue = profile.externals[groupId] ?? false
    const newValue = externalUpdates[groupId] ?? oldValue
    resultingExternals[groupId] = newValue
    shouldRecalculate ||= oldValue !== newValue
  }

  // Calculate resulting status
  const { conflictGroups, resultingStatus } = resolvePackages(
    packages,
    resultingConfigs,
    resultingExternals,
  )

  const disablingPackages: string[] = []
  const enablingPackages: string[] = []
  const explicitVariantChanges: { [packageId: string]: [old: string, new: string] } = {}
  const implicitVariantChanges: { [packageId: string]: [old: string, new: string] } = {}
  const incompatibleExternals: string[] = []
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
  for (const groupId in resultingExternals) {
    if (resultingExternals[groupId]) {
      // Ignore conflicts from externals that are explicitly enabled by this action
      const ignoreConflicts = !!externalUpdates[groupId]

      const isConflicted = conflictGroups[groupId]?.some(id => id !== EXTERNAL_PACKAGE_ID)

      if (isConflicted && !ignoreConflicts) {
        incompatibleExternals.push(groupId)
      }
    }
  }

  // Remove explicit variant if it is the default
  for (const packageId in resultingStatus) {
    const packageConfig = resultingConfigs[packageId]
    const packageInfo = packages[packageId]

    const defaultVariantId =
      Object.keys(packageInfo.variants).find(
        variantId => !resultingStatus[packageId].issues[variantId]?.length,
      ) ?? Object.keys(packageInfo.variants)[0]

    if (packageConfig?.variant === defaultVariantId) {
      resultingConfigs[packageId] = { ...packageConfig, variant: undefined }
    }
  }

  console.debug("Updating configs", {
    packages: configUpdates,
    externals: externalUpdates,
  })

  console.debug("Resulting configs", {
    packages: resultingConfigs,
    externals: resultingExternals,
    shouldRecalculate,
  })

  console.debug("Resulting changes", {
    disablingPackages,
    enablingPackages,
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
    explicitVariantChanges,
    implicitVariantChanges,
    incompatibleExternals,
    incompatiblePackages,
    installingVariants,
    resultingStatus,
    resultingConfigs,
    resultingExternals,
    selectingVariants,
    shouldRecalculate,
  }
}
