import {
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  Folder as OpenLocationIcon,
} from "@mui/icons-material"
import { Card, Typography, useTheme } from "@mui/material"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { type DBPFFile, isDBPF } from "@common/dbpf"
import { type PackageID, checkFile } from "@common/packages"
import { type PackageFile as PackageFileType, VariantState, isOverride } from "@common/types"
import { globToRegex } from "@common/utils/glob"
import { FlexBox } from "@components/FlexBox"
import { PackageTag } from "@components/Tags/PackageTag"
import { TagType } from "@components/Tags/utils"
import { ToolButton } from "@components/ToolButton"
import { useCurrentVariant, usePackageStatus } from "@utils/packages"
import {
  useCurrentProfile,
  useFeatures,
  useSettings,
  useStore,
  useStoreActions,
} from "@utils/store"

import { CategoryID } from "@common/categories"
import { PackageEntries } from "./PackageEntries"

export interface PackageFileProps {
  file: PackageFileType
  packageId: PackageID
}

export function PackageFile({ file, packageId }: PackageFileProps): JSX.Element {
  const actions = useStoreActions()
  const features = useFeatures()
  const settings = useSettings()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
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
    profileOptions,
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
            {isPatched && <PackageTag dense type={TagType.STATE} value={VariantState.PATCHED} />}
            {isOverride(file) && (
              <PackageTag color="info" dense type={TagType.CATEGORY} value={CategoryID.OVERRIDES} />
            )}
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
        <PackageEntries
          file={file}
          fileData={fileData}
          packageId={packageId}
          setFileData={setFileData}
        />
      )}
    </Card>
  )
}
