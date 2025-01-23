import { difference, mapDefined } from "@salinco/nice-utils"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { CollectionID } from "@common/collections"
import { getPackageStatus, isEnabled, isIncompatible } from "@common/packages"
import { type Action, ActionButton } from "@components/ActionButton"
import { Header, type HeaderProps } from "@components/Header"
import { disableCollection, enableCollection } from "@stores/actions"
import { store } from "@stores/main"
import { Page } from "@utils/navigation"

import { CollectionTags } from "./CollectionTags"

export function CollectionHeader({
  collectionId,
  isListItem,
  setActive,
}: HeaderProps<{ collectionId: CollectionID }>): JSX.Element {
  const collection = store.useCollectionInfo(collectionId)
  const packages = store.usePackages()
  const profileInfo = store.useCurrentProfile()

  const { t } = useTranslation("CollectionActions")

  const collectionActions = useMemo(() => {
    const collectionActions: Action[] = []

    const allPackages = mapDefined(collection.packages, packageId => packages?.[packageId])

    const compatiblePackages = allPackages.filter(packageInfo => {
      const packageStatus = getPackageStatus(packageInfo, profileInfo)
      const variantInfo = packageStatus && packageInfo.variants[packageStatus?.variantId]
      return !!variantInfo && !isIncompatible(variantInfo, packageStatus)
    })

    const enabledPackages = allPackages.filter(packageInfo => {
      const packageStatus = getPackageStatus(packageInfo, profileInfo)
      return isEnabled(packageStatus)
    })

    if (enabledPackages.length < allPackages.length) {
      collectionActions.push({
        action: () => enableCollection(collection.id),
        color: "success",
        description: t("enable.description"),
        disabled: !difference(compatiblePackages, enabledPackages).length,
        id: "enable",
        label: t("enable.label"),
      })
    }

    if (enabledPackages.length) {
      collectionActions.push({
        action: () => disableCollection(collection.id),
        color: "error",
        description: t("disable.description"),
        id: "disable",
        label: t("disable.label"),
      })
    }

    return collectionActions
  }, [collection, packages, profileInfo, t])

  return (
    <Header
      actions={<ActionButton actions={collectionActions} />}
      description={collection.description}
      images={collection.images}
      isListItem={isListItem}
      location={{ data: { collectionId }, page: Page.CollectionView }}
      setActive={setActive}
      subtitle={collectionId}
      summary={collection.summary}
      tags={<CollectionTags collectionId={collectionId} />}
      thumbnail={collection.thumbnail}
      title={`${collection.name} (${collection.packages.length} packages)`}
    />
  )
}
