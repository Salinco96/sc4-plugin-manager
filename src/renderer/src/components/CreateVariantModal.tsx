import { HelpOutline as HelpIcon } from "@mui/icons-material"
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  Icon,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from "@mui/material"
import { keys, values } from "@salinco/nice-utils"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import { createUniqueId } from "@common/profiles"
import type { VariantID } from "@common/variants"
import { useCurrentVariant, usePackageInfo, useVariantInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"

export interface CreateVariantModalProps {
  onClose(): void
  open: boolean
  packageId: PackageID
}

export interface CreateVariantFormProps {
  onClose(): void
  packageId: PackageID
}

export function CreateVariantForm({ onClose, packageId }: CreateVariantFormProps): JSX.Element {
  const actions = useStoreActions()

  const packageInfo = usePackageInfo(packageId)
  const currentVariant = useCurrentVariant(packageId)

  const variantIds = keys(packageInfo.variants)

  const { t } = useTranslation("CreateVariantModal")

  const [name, setName] = useState<string>()
  const [variantId, setVariantId] = useState(currentVariant.id)
  const [isCreating, setCreating] = useState(false)

  const sourceVariant = useVariantInfo(packageId, variantId)
  const defaultName = `${sourceVariant.name} (Copy)`

  const nameValue = name ?? defaultName
  const nameError = nameValue.trim() ? undefined : t("name.errors.required", { ns: "Variant" })

  const id = createUniqueId(nameValue, variantIds)

  const hasManyFiles = (sourceVariant.files?.length ?? 0) > 2 // 0

  return (
    <>
      <DialogTitle>{t("title")}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <DialogContentText>{t("description")}</DialogContentText>
        <TextField
          autoFocus
          fullWidth
          id="name"
          label={t("name.label", { ns: "Variant" })}
          name="name"
          onChange={event => setName(event.target.value.trimStart())}
          onFocus={event => !name && event.target.select()}
          required
          value={nameValue}
          variant="standard"
        />
        <TextField
          autoFocus
          disabled
          fullWidth
          id="id"
          InputProps={{
            endAdornment: (
              <Tooltip title={t("id.description")}>
                <InputAdornment position="end">
                  <Icon aria-label="Help">
                    <HelpIcon />
                  </Icon>
                </InputAdornment>
              </Tooltip>
            ),
          }}
          label={t("id.label", { ns: "Variant" })}
          name="id"
          value={id}
          variant="standard"
        />
        <FormControl fullWidth variant="standard">
          <InputLabel htmlFor="template" id="template-label">
            {t("from.label")}
          </InputLabel>
          <Select
            MenuProps={{ sx: { maxHeight: 320 } }}
            endAdornment={
              <Tooltip title={t("from.description")}>
                <InputAdornment position="end">
                  <Icon aria-label="Help">
                    <HelpIcon />
                  </Icon>
                </InputAdornment>
              </Tooltip>
            }
            fullWidth
            id="template"
            labelId="template-label"
            name="template"
            onChange={event => setVariantId(event.target.value as VariantID)}
            required
            sx={{ "& .MuiSelect-icon": { marginRight: 3 } }}
            value={variantId}
            variant="standard"
          >
            {values(packageInfo.variants).map(profile => (
              <MenuItem key={profile.id} value={profile.id}>
                {profile.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {!sourceVariant.installed && <Alert severity="info">{t("from.notInstalled")}</Alert>}
        {hasManyFiles && <Alert severity="warning">{t("from.manyFiles")}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onClose}>
          {t("actions.cancel.label")}
        </Button>
        <Button
          disabled={!!nameError || isCreating}
          onClick={async () => {
            try {
              setCreating(true)
              await actions.createVariant(packageId, nameValue.trim(), variantId)
              onClose()
            } finally {
              setCreating(false)
            }
          }}
        >
          {t("actions.create.label")}
        </Button>
      </DialogActions>
    </>
  )
}

export function CreateVariantModal({
  onClose,
  open,
  packageId,
}: CreateVariantModalProps): JSX.Element {
  return (
    <Dialog open={open}>
      <CreateVariantForm onClose={onClose} packageId={packageId} />
    </Dialog>
  )
}
