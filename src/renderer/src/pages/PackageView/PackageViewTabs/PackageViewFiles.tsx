import { Button, List, ListItem } from "@mui/material"
import { useTranslation } from "react-i18next"

import { checkFile } from "@common/packages"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useStore, useStoreActions } from "@utils/store"

export function PackageViewFiles({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const features = useStore(store => store.features)
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.globalOptions)
  const variantInfo = useCurrentVariant(packageId)

  const { t } = useTranslation("PackageViewFiles")

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo?.files
        ?.sort((a, b) => a.path.localeCompare(b.path))
        .map(file => (
          <ListItem key={file.path} sx={{ padding: 0 }}>
            <Button
              color="inherit"
              disabled={
                !checkFile(file, packageId, variantInfo, profileInfo, profileOptions, features)
              }
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
        ))}
    </List>
  )
}
