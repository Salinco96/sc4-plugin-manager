import { DBPFDataType, type DBPFFile, isDBPF } from "@common/dbpf"
import { checkFile } from "@common/packages"
import { globToRegex } from "@common/utils/glob"
import { PackageFile } from "@components/PackageFile/PackageFile"
import { List, ListItem } from "@mui/material"
import { sortBy, values } from "@salinco/nice-utils"
import { useCurrentVariant, usePackageStatus } from "@utils/packages"
import {
  useCurrentProfile,
  useFeatures,
  useSettings,
  useStore,
  useStoreActions,
} from "@utils/store"
import { useEffectEvent } from "@utils/useEffectEvent"
import { useEffect, useState } from "react"
import type { PackageViewTabInfoProps } from "./tabs"

export default function PackageViewFiles({ packageId }: PackageViewTabInfoProps): JSX.Element {
  const actions = useStoreActions()
  const features = useFeatures()
  const settings = useSettings()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const packageStatus = usePackageStatus(packageId)
  const patterns = packageStatus?.files?.map(pattern => globToRegex(pattern))
  const variantInfo = useCurrentVariant(packageId)

  const [files, setFiles] = useState<{ [path in string]?: DBPFFile }>({})

  const preloadFiles = useEffectEvent(async () => {
    if (variantInfo.files) {
      const result: { [path in string]?: DBPFFile } = {}

      for (const file of variantInfo.files) {
        result[file.path] = await actions.loadDBPFEntries(packageId, variantInfo.id, file.path)
      }

      setFiles(files => ({ ...files, ...result }))
    }
  })

  useEffect(() => {
    preloadFiles()
  }, [preloadFiles])

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
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {sortBy(variantInfo.files ?? [], file => file.path).map(file => (
        <ListItem key={file.path} sx={{ padding: 0 }}>
          <PackageFile
            disabled={!enabledFiles?.includes(file)}
            file={file}
            fileData={files[file.path]}
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
        </ListItem>
      ))}
    </List>
  )
}
