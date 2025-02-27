import { Box } from "@mui/material"
import { Suspense, lazy } from "react"

import type { PackageID } from "@common/packages"
import { Loader } from "@components/Loader"
import { store } from "@stores/main"
import { usePageState } from "@stores/ui"
import { Page } from "@utils/navigation"

import { PackageSummary } from "./PackageSummary"
import { getErrors } from "./utils"

const PackageSummaryEditor = lazy(() => import("./PackageSummaryEditor"))

export function PackageViewSummary({ packageId }: { packageId: PackageID }): JSX.Element {
  const variantInfo = store.useCurrentVariant(packageId)

  const [{ editorVariantInfo }, setPageState] = usePageState(Page.PackageView)

  const isEditing = editorVariantInfo?.id === variantInfo.id

  return (
    <Box height="100%" overflow="auto" p={2}>
      {isEditing ? (
        <Suspense fallback={<Loader />}>
          <PackageSummaryEditor
            data={editorVariantInfo}
            errors={getErrors(editorVariantInfo)}
            packageId={packageId}
            setData={data => setPageState({ editorVariantInfo: data })}
            variantInfo={variantInfo}
          />
        </Suspense>
      ) : (
        <PackageSummary packageId={packageId} variantInfo={variantInfo} />
      )}
    </Box>
  )
}
