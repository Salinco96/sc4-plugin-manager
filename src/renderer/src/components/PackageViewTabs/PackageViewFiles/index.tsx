import { sortBy, values } from "@salinco/nice-utils"
import { useEffect, useState } from "react"

import { DBPFDataType, type DBPFFile, isDBPF } from "@common/dbpf"
import { type PackageID, checkFile } from "@common/packages"
import { globToRegex } from "@common/utils/glob"
import type { VariantID } from "@common/variants"
import { List } from "@components/List"
import { loadVariantFileEntries } from "@stores/actions"
import { store } from "@stores/main"
import { useEffectEvent } from "@utils/useEffectEvent"

import { PackageFileListItem } from "./PackageFileListItem"

export default function PackageViewFiles({ packageId }: { packageId: PackageID }): JSX.Element {
  const features = store.useFeatures()
  const packageStatus = store.usePackageStatus(packageId)
  const profileInfo = store.useCurrentProfile()
  const profileOptions = store.useProfileOptions()
  const settings = store.useSettings()
  const variantInfo = store.useCurrentVariant(packageId)

  const patterns = packageStatus?.files?.map(pattern => globToRegex(pattern))

  const [files, setFiles] = useState<{ [path in string]?: DBPFFile }>({})

  const preloadFiles = useEffectEvent(async (variantId: VariantID) => {
    if (variantInfo.files) {
      const files: { [path in string]?: DBPFFile } = {}

      for (const file of variantInfo.files) {
        files[file.path] = await loadVariantFileEntries(packageId, variantId, file.path)
      }

      setFiles(files)
    }
  })

  useEffect(() => {
    preloadFiles(variantInfo.id)
  }, [preloadFiles, variantInfo.id])

  const enabledFiles = variantInfo.files?.filter(file =>
    checkFile(
      file,
      packageId,
      variantInfo,
      profileInfo,
      profileOptions,
      features,
      settings,
      patterns,
      !packageStatus?.included,
    ),
  )

  const dbpfFiles = enabledFiles?.filter(file => isDBPF(file.path)) ?? []

  return (
    <List
      items={sortBy(variantInfo.files ?? [], file => file.path)}
      renderItem={file => (
        <PackageFileListItem
          file={file}
          fileData={files[file.path]}
          isDisabled={!enabledFiles?.includes(file)}
          overriddenEntries={
            isDBPF(file.path) && files[file.path]?.entries && enabledFiles?.includes(file)
              ? dbpfFiles.flatMap(other => {
                  const entries = files[file.path]?.entries
                  const otherEntries = files[other.path]?.entries
                  if (!entries || !otherEntries) {
                    return []
                  }

                  const priority = file.priority ?? variantInfo.priority
                  const otherPriority = other.priority ?? variantInfo.priority
                  if (priority > otherPriority) {
                    return []
                  }

                  if (priority === otherPriority && file.path >= other.path) {
                    return []
                  }

                  return values(otherEntries)
                    .filter(entry => entries[entry.id] && entry.type !== DBPFDataType.LD)
                    .map(entry => entry.id)
                })
              : undefined
          }
          packageId={packageId}
          setFileData={fileData => setFiles(files => ({ ...files, [file.path]: fileData }))}
        />
      )}
    />
  )
}
