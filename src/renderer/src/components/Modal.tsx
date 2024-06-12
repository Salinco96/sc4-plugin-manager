import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material"

import { useStore } from "@utils/store"

export function Modal(): JSX.Element {
  const modal = useStore(store => store.modal)

  return (
    <Dialog
      open={!!modal}
      onClose={() => modal?.action(false)}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <DialogTitle id="modal-title">Missing packages</DialogTitle>
      <DialogContent id="modal-description">
        <DialogContentText>{modal?.data.packageIds.join(", ")}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={() => modal?.action(false)}>
          Cancel
        </Button>
        <Button onClick={() => modal?.action(true)} autoFocus>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}
