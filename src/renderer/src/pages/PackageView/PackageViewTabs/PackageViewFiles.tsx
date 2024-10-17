import { Button, List, ListItem } from "@mui/material"
import { useTranslation } from "react-i18next"

import { PackageID, checkFile } from "@common/packages"
import { globToRegex } from "@common/utils/glob"
import { useCurrentVariant, usePackageStatus } from "@utils/packages"
import {
  useCurrentProfile,
  useFeatures,
  useGlobalOptions,
  useSettings,
  useStoreActions,
} from "@utils/store"

export function PackageViewFiles({ packageId }: { packageId: PackageID }): JSX.Element {
  const actions = useStoreActions()
  const features = useFeatures()
  const settings = useSettings()
  const globalOptions = useGlobalOptions()
  const profileInfo = useCurrentProfile()
  const packageStatus = usePackageStatus(packageId)
  const variantInfo = useCurrentVariant(packageId)
  const patterns = packageStatus?.files?.map(globToRegex)

  const { t } = useTranslation("PackageViewFiles")

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo.files
        ?.sort((a, b) => a.path.localeCompare(b.path))
        .map(file => {
          const disabled = !checkFile(
            file,
            packageId,
            variantInfo,
            profileInfo,
            globalOptions,
            features,
            settings,
            patterns,
          )

          return (
            <ListItem key={file.path} sx={{ padding: 0 }}>
              <Button
                color="inherit"
                disabled={disabled}
                onClick={async () => {
                  const path = file.path.replace(/[\\/]?[^\\/]+$/, "")
                  await actions.openPackageFile(packageId, variantInfo.id, path)
                }}
                sx={{ justifyContent: "start", textTransform: "unset", width: "100%" }}
                title={t("openFile")}
                variant="outlined"
              >
                {file.path.replaceAll(/[\\/]/g, " / ")}
              </Button>
            </ListItem>
          )
        })}
    </List>
  )
}
