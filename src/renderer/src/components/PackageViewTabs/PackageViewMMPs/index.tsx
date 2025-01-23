import { List } from "@mui/material"
import { collect, get, groupBy } from "@salinco/nice-utils"
import { useEffect, useMemo } from "react"

import { type PackageID, checkFile } from "@common/packages"
import { store } from "@stores/main"
import { ui } from "@stores/ui"
import { Page } from "@utils/navigation"

import { PackageViewMMPInfo } from "./PackageViewMMPInfo"

export default function PackageViewMMPs({ packageId }: { packageId: PackageID }): JSX.Element {
  const elementId = ui.useStore(state => state.pages[Page.PackageView]?.elementId)

  const features = store.useFeatures()
  const profileInfo = store.useCurrentProfile()
  const profileOptions = store.useProfileOptions()
  const settings = store.useSettings()
  const variantInfo = store.useCurrentVariant(packageId)

  useEffect(() => {
    if (elementId) {
      document.getElementById(elementId)?.scrollIntoView({ block: "center", inline: "center" })
    }
  }, [elementId])

  const mmps = useMemo(() => {
    const includedFiles = new Set(
      variantInfo.files
        ?.filter(file =>
          checkFile(
            file,
            packageId,
            variantInfo,
            profileInfo,
            profileOptions,
            features,
            settings,
            undefined,
            true,
          ),
        )
        .map(file => file.path),
    )

    return collect(groupBy(variantInfo.mmps ?? [], get("id")), (mmps, mmpId) => {
      if (mmps.length !== 1) {
        const included = mmps.filter(mmp => includedFiles.has(mmp.file))
        if (included.length === 1) {
          return included[0]
        }

        console.warn(`Duplicate MMP ${mmpId}`)
      }

      return mmps[0]
    })
  }, [features, packageId, profileInfo, profileOptions, settings, variantInfo])

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {mmps.map(mmp => (
        <PackageViewMMPInfo key={mmp.id} mmp={mmp} packageId={packageId} />
      ))}
    </List>
  )
}
