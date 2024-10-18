import { useState } from "react"

import {
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  Folder as OpenLocationIcon,
  Preview as PreviewIcon,
} from "@mui/icons-material"
import { Card, Typography, useTheme } from "@mui/material"
import { useTranslation } from "react-i18next"

import { DBPFDataType, DBPFEntryData, DBPFFile, TGI, getFileTypeLabel, isDBPF } from "@common/dbpf"
import { ExemplarValueType } from "@common/exemplars"
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
import { ToolButton } from "./ToolButton"
import { ImageViewer } from "./Viewer/ImageViewer"
import { TextViewer } from "./Viewer/TextViewer"

// TODO: FSH, S3D, audio files...
const IMAGETYPES = [DBPFDataType.BMP, DBPFDataType.JFIF, DBPFDataType.PNG] as const
const TEXTTYPES = [DBPFDataType.XML] as const
const VIEWABLETYPES: DBPFDataType[] = [...IMAGETYPES, ...TEXTTYPES, DBPFDataType.EXMP]

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

  const [entries, setEntries] = useState<{ [id: TGI]: DBPFEntryData }>({})
  const [contents, setContents] = useState<DBPFFile>()
  const [expanded, setExpanded] = useState(false)
  const [expandedEntry, setExpandedEntry] = useState<TGI>()

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
            <ToolButton
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
          <ToolButton
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
            .map(entry => {
              const tgi = entry.id.split("-")
              const data = entries[entry.id]
              const viewable = VIEWABLETYPES.includes(entry.dataType)
              const compression = entry.uncompressed ? 1 - entry.size / entry.uncompressed : 0

              return (
                <li style={{ alignItems: "center", display: "flex", gap: 4 }} key={entry.id}>
                  {t(entry.uncompressed !== undefined ? "entry.labelCompressed" : "entry.label", {
                    t: tgi[0],
                    g: tgi[1],
                    i: tgi[2],
                    compression: 100 * compression,
                    size: entry.size,
                    type: getFileTypeLabel(entry.id),
                  })}
                  {viewable && (
                    <ToolButton
                      description={t("entry.view")}
                      icon={PreviewIcon}
                      onClick={async () => {
                        const data = await actions.loadDBPFEntry(
                          packageId,
                          variantInfo.id,
                          file.path,
                          entry,
                        )

                        setEntries(entries => ({ ...entries, [entry.id]: data }))
                        setExpandedEntry(entry.id)
                      }}
                    />
                  )}
                  {expandedEntry === entry.id && data && "base64" in data && (
                    <ImageViewer
                      images={[`data:image/${data.type};base64, ${data.base64}`]}
                      onClose={() => setExpandedEntry(undefined)}
                      open
                    />
                  )}
                  {expandedEntry === entry.id && data && "text" in data && (
                    <TextViewer onClose={() => setExpandedEntry(undefined)} open text={data.text} />
                  )}
                  {expandedEntry === entry.id && data && "properties" in data && (
                    <TextViewer
                      onClose={() => setExpandedEntry(undefined)}
                      open
                      text={`- Parent Cohort ID: ${data.parentCohortId}
${data.properties.map(property =>
  property.info
    ? `- ${property.info.name} (0x${property.id.toString(16).padStart(8, "0")}): (${ExemplarValueType[property.type]}) ${JSON.stringify(property.value)}`
    : `- 0x${property.id.toString(16).padStart(8, "0")}: (${ExemplarValueType[property.type]}) ${JSON.stringify(property.value)}`,
).join(`
`)}`}
                    />
                  )}
                </li>
              )
            })}
        </ul>
      )}
    </Card>
  )
}
