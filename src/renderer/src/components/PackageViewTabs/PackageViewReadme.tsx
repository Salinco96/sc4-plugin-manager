import { ErrorOutline as ErrorIcon, Description as ReadmeIcon } from "@mui/icons-material"
import { Alert, MenuItem, Select, Typography } from "@mui/material"
import { useEffect, useState } from "react"

import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { FlexBox, FlexCol } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { MarkdownView } from "@components/MarkdownView"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

export default function PackageViewReadme({
  packageId,
}: { packageId: PackageID }): JSX.Element | null {
  const variantInfo = useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const filePaths = variantInfo.readme ?? []

  const [filePath, setFilePath] = useState(filePaths.at(0))

  return (
    <FlexCol fullHeight>
      {filePaths.length > 1 && (
        <Alert
          action={
            <Select
              onChange={event => setFilePath(event.target.value)}
              margin="none"
              size="small"
              sx={{ backgroundColor: "white", marginRight: 2, width: "100%" }}
              value={filePath ?? ""}
            >
              {filePaths.map(filePath => (
                <MenuItem key={filePath} value={filePath}>
                  {filePath}
                </MenuItem>
              ))}
            </Select>
          }
          icon={<ReadmeIcon fontSize="inherit" />}
          severity="info"
          sx={{
            alignItems: "center",
            display: "flex",
            "& .MuiAlert-action": { width: 400, maxWidth: "50%", paddingY: 0.5 },
          }}
        >
          Select a file
        </Alert>
      )}
      {filePath && (
        <FlexCol flex={1} overflow="hidden">
          <ReadmeView filePath={filePath} packageId={packageId} variantId={variantId} />
        </FlexCol>
      )}
    </FlexCol>
  )
}

function ReadmeView({
  filePath,
  packageId,
  variantId,
}: {
  filePath: string
  packageId: PackageID
  variantId: VariantID
}): JSX.Element | null {
  const actions = useStoreActions()

  const [error, setError] = useState<string>()
  const [readme, setReadme] = useState<{ html?: string; md?: string }>()

  useEffect(() => {
    actions
      .getPackageReadme(packageId, variantId, filePath)
      .then(setReadme)
      .catch(error => setError(error.message))
  }, [actions, filePath, packageId, variantId])

  if (error) {
    return (
      <FlexBox centered color="red" fontSize={40} fullHeight fullWidth p={10}>
        <ErrorIcon fontSize="inherit" />
        <Typography variant="subtitle1">Failed to open file</Typography>
        <code
          style={{
            backgroundColor: "rgba(255, 0, 0, 0.05)",
            border: "1px solid currentColor",
            fontSize: 20,
            marginTop: 8,
            padding: 8,
            wordBreak: "break-word",
          }}
        >
          {error}
        </code>
      </FlexBox>
    )
  }

  if (!readme) {
    return <Loader />
  }

  if (readme.html) {
    // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe
    return <div dangerouslySetInnerHTML={{ __html: readme.html }} style={{ height: "100%" }} />
  }

  if (readme.md) {
    return <MarkdownView md={readme.md} />
  }

  return null
}
