import { Dialog, DialogContent, DialogTitle } from "@mui/material"
import { Suspense, lazy } from "react"

import type { PackageID } from "@common/packages"
import { store } from "@stores/main"

const PackageOptionsForm = lazy(() => import("./PackageOptionsForm"))

export function PackageOptionsDialog({
  onClose,
  open,
  packageId,
}: {
  onClose: () => void
  open: boolean
  packageId: PackageID
}): JSX.Element {
  const packageName = store.usePackageName(packageId)

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{packageName}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Suspense>
          <PackageOptionsForm packageId={packageId} />
        </Suspense>
      </DialogContent>
    </Dialog>
  )
}
