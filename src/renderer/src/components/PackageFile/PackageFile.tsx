import {
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  Folder as OpenLocationIcon,
} from "@mui/icons-material"
import { Card, Typography, useTheme } from "@mui/material"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { CategoryID } from "@common/categories"
import { type DBPFFile, type TGI, isDBPF } from "@common/dbpf"
import type { PackageID } from "@common/packages"
import { VariantState, isOverride } from "@common/types"
import type { FileInfo } from "@common/variants"
import { FlexBox } from "@components/FlexBox"
import { PackageTag } from "@components/Tags/PackageTag"
import { TagType } from "@components/Tags/utils"
import { ToolButton } from "@components/ToolButton"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { PackageEntries } from "./PackageEntries"

export interface PackageFileProps {
  disabled: boolean
  file: FileInfo
  fileData?: DBPFFile
  overriddenEntries?: TGI[]
  packageId: PackageID
  setFileData: (data: DBPFFile) => void
}

export function PackageFile({
  disabled,
  file,
  fileData,
  overriddenEntries,
  packageId,
  setFileData,
}: PackageFileProps): JSX.Element {
  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)
  const theme = useTheme()

  const isPatched = !!file.patches

  const [expanded, setExpanded] = useState(false)

  const { t } = useTranslation("PackageViewFiles")

  const parentPath = file.path.replace(/[\\/]?[^\\/]+$/, "")

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
          overriddenEntries={overriddenEntries}
          packageId={packageId}
          setFileData={setFileData}
        />
      )}
    </Card>
  )
}
