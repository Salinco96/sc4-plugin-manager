import { useState } from "react"

import {
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  Folder as OpenLocationIcon,
  ManageAccountsOutlined as PatchedIcon,
} from "@mui/icons-material"
import { Card, List, Typography, useTheme } from "@mui/material"
import { useTranslation } from "react-i18next"

import { DBPFFile, isDBPF } from "@common/dbpf"
import { PackageID, checkFile } from "@common/packages"
import { type PackageFile } from "@common/types"
import { globToRegex } from "@common/utils/glob"
import { values } from "@common/utils/objects"
import { ToolButton } from "@components/ToolButton"
import { useCurrentVariant, usePackageStatus } from "@utils/packages"
import {
  useCurrentProfile,
  useFeatures,
  useGlobalOptions,
  useSettings,
  useStoreActions,
} from "@utils/store"

import { FlexBox } from "../FlexBox"

import { PackageEntry } from "./PackageEntry"

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

  const isPatched = !!file.patches

  const [fileData, setFileData] = useState<DBPFFile>()
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
    !packageStatus?.included,
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
          <FlexBox alignItems="center" gap={0.5}>
            {file.path.replaceAll(/[\\/]/g, " / ")}
            {isPatched && <ToolButton description={t("patched")} icon={PatchedIcon} />}
          </FlexBox>
        </Typography>
        <FlexBox alignItems="center" gap={0.5} mx={0.5}>
          {isDBPF(file.path) && (
            <ToolButton
              description={t(expanded ? "hideContents" : "showContents")}
              icon={expanded ? CollapseIcon : ExpandIcon}
              onClick={async () => {
                if (!fileData) {
                  setFileData(await actions.loadDBPFEntries(packageId, variantInfo.id, file.path))
                }

                setExpanded(!expanded)
              }}
            />
          )}
          <ToolButton
            description={t("openFileLocation")}
            icon={OpenLocationIcon}
            onClick={async () => {
              await actions.openPackageFile(packageId, variantInfo.id, parentPath)
            }}
          />
        </FlexBox>
      </FlexBox>
      {fileData && expanded && (
        <List disablePadding>
          {values(fileData.entries).map(entry => (
            <PackageEntry
              entry={entry}
              file={file}
              fileData={fileData}
              key={entry.id}
              packageId={packageId}
              setFileData={setFileData}
            />
          ))}
        </List>
      )}
    </Card>
  )
}