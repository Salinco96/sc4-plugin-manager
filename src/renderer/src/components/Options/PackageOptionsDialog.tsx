import { Dialog, DialogContent, DialogTitle } from "@mui/material"

import { usePackageInfo } from "@utils/packages"

import { PackageOptionsForm } from "./PackageOptionsForm"

export function PackageOptionsDialog({
  onClose,
  open,
  packageId,
}: {
  onClose: () => void
  open: boolean
  packageId: string
}): JSX.Element {
  const packageInfo = usePackageInfo(packageId)

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{packageInfo.name}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <PackageOptionsForm packageId={packageId} />
      </DialogContent>
    </Dialog>
  )
}
