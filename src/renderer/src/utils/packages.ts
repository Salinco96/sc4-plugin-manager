import { useCallback } from "react"

import { PackageInfo, PackageStatus, ProfileInfo, VariantInfo } from "@common/types"

import { getCurrentProfile, getPackageInfo, useStore } from "./store"

export function getCurrentVariant(
  packageInfo: PackageInfo,
  profileInfo?: ProfileInfo,
): VariantInfo {
  const status = profileInfo && packageInfo.status[profileInfo.id]
  return status ? packageInfo.variants[status.variantId] : Object.values(packageInfo.variants)[0]
}

export function getPackageStatus(
  packageInfo: PackageInfo,
  profileInfo?: ProfileInfo,
): PackageStatus {
  const status = profileInfo && packageInfo.status[profileInfo.id]

  return (
    status || {
      enabled: false,
      issues: {},
      options: {},
      requiredBy: [],
      variantId: Object.keys(packageInfo.variants)[0],
    }
  )
}

export function useCurrentVariant(packageId: string): VariantInfo {
  return useStore(
    useCallback(
      store => {
        const packageInfo = getPackageInfo(store, packageId)!
        const profileInfo = getCurrentProfile(store)
        return getCurrentVariant(packageInfo, profileInfo)
      },
      [packageId],
    ),
  )
}

export function usePackageInfo(packageId: string): PackageInfo {
  return useStore(useCallback(store => getPackageInfo(store, packageId)!, [packageId]))
}

export function usePackageStatus(packageId: string): PackageStatus {
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
