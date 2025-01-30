import { Close as CloseIcon, Edit as EditIcon, Save as SaveIcon } from "@mui/icons-material"
import { Box, Fab } from "@mui/material"
import { Suspense, lazy, useState } from "react"

import type { PackageID } from "@common/packages"
import type { EditableVariantInfo } from "@common/variants"
import { editVariant } from "@stores/actions"
import { store } from "@stores/main"

import { Loader } from "@components/Loader"
import { PackageSummary } from "./PackageSummary"
import { getErrors, getFinalData } from "./utils"

const PackageSummaryEditor = lazy(() => import("./PackageSummaryEditor"))

export function PackageViewSummary({ packageId }: { packageId: PackageID }): JSX.Element {
  const settings = store.useSettings()
  const variantInfo = store.useCurrentVariant(packageId)

  const [editorVariantInfo, setEditorVariantInfo] = useState<EditableVariantInfo>()

  const isEditing = !!editorVariantInfo
  const isEditable = !!variantInfo.local || !!settings?.db.path

  return (
    <>
      <Box height="100%" overflow="auto" p={2}>
        {isEditing ? (
          <Suspense fallback={<Loader />}>
            <PackageSummaryEditor
              data={editorVariantInfo}
              errors={getErrors(editorVariantInfo)}
              packageId={packageId}
              setData={setEditorVariantInfo}
              variantInfo={variantInfo}
            />
          </Suspense>
        ) : (
          <PackageSummary packageId={packageId} variantInfo={variantInfo} />
        )}
      </Box>

      <>
        {isEditing && (
          <Fab
            color="error"
            onClick={() => setEditorVariantInfo(undefined)}
            sx={{ position: "absolute", bottom: 16, right: 80 }}
          >
            <CloseIcon />
          </Fab>
        )}

        {isEditing && (
          <Fab
            color="primary"
            onClick={async () => {
              if (await editVariant(packageId, variantInfo.id, getFinalData(editorVariantInfo))) {
                setEditorVariantInfo(undefined)
              }
            }}
            sx={{ position: "absolute", bottom: 16, right: 16 }}
          >
            <SaveIcon />
          </Fab>
        )}

        {isEditable && !isEditing && (
          <Fab
            color="primary"
            onClick={() => setEditorVariantInfo(variantInfo)}
            sx={{ position: "absolute", bottom: 16, right: 16 }}
          >
            <EditIcon />
          </Fab>
        )}
      </>
    </>
  )
}
