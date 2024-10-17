import { useState } from "react"

import {
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  Folder as OpenLocationIcon,
} from "@mui/icons-material"
import { Card, Typography, useTheme } from "@mui/material"
import { useTranslation } from "react-i18next"

import { DBPFFile, isDBPF } from "@common/files"
import { PackageID, checkFile } from "@common/packages"
import { type PackageFile } from "@common/types"
import { globToRegex } from "@common/utils/glob"
import { useCurrentVariant, usePackageStatus } from "@utils/packages"
import {
  useCurrentProfile,
  useFeatures,
  useGlobalOptions,
  useSettings,
  useStoreActions,
} from "@utils/store"

import { FlexBox } from "./FlexBox"
import { PackageToolButton } from "./PackageTools/PackageToolButton"

export function PackageFile({
  file,
  packageId,
}: {
  file: PackageFile
  packageId: PackageID
}): JSX.Element {
  const actions = useStoreActions()
  const features = useFeatures()
  const settings = useSettings()
  const globalOptions = useGlobalOptions()
  const profileInfo = useCurrentProfile()
  const packageStatus = usePackageStatus(packageId)
  const variantInfo = useCurrentVariant(packageId)
  const patterns = packageStatus?.files?.map(globToRegex)
  const theme = useTheme()

  const [contents, setContents] = useState<DBPFFile>()
  const [expanded, setExpanded] = useState(false)

  const { t } = useTranslation("PackageViewFiles")

  const parentPath = file.path.replace(/[\\/]?[^\\/]+$/, "")

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
    <Card
      sx={{
        borderColor: "currentColor",
        color: disabled ? theme.palette.text.disabled : theme.palette.text.primary,
        height: "100%",
        paddingX: 2,
        paddingY: 0.75,
        width: "100%",
      }}
      variant="outlined"
    >
      <FlexBox alignItems="center">
        <Typography color="inherit" flex={1} textTransform="unset" variant="button">
          {file.path.replaceAll(/[\\/]/g, " / ")}
        </Typography>
        <FlexBox alignItems="center" gap={0.5} mx={0.5}>
          {isDBPF(file.path) && (
            <PackageToolButton
              description={t(expanded ? "hideContents" : "showContents")}
              icon={expanded ? CollapseIcon : ExpandIcon}
              onClick={async () => {
                if (!contents) {
                  setContents(await actions.listFileContents(packageId, variantInfo.id, file.path))
                }

                setExpanded(!expanded)
              }}
            />
          )}
          <PackageToolButton
            description={t("openFileLocation")}
            icon={OpenLocationIcon}
            onClick={async () => {
              await actions.openPackageFile(packageId, variantInfo.id, parentPath)
            }}
          />
        </FlexBox>
      </FlexBox>
      {contents && expanded && (
        <ul>
          {Object.values(contents.entries)
            .sort(entry => entry.offset)
            .map(entry => (
              <li key={entry.id}>
                {entry.id.split("-").join(" - ")} ({entry.size} bytes)
              </li>
            ))}
        </ul>
      )}
    </Card>
  )
}
