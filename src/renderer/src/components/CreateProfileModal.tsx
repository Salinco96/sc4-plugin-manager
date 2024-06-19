import { useState } from "react"

import { HelpOutline as HelpIcon } from "@mui/icons-material"
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  Icon,
  InputAdornment,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from "@mui/material"
import { useTranslation } from "react-i18next"

import { createUniqueProfileId } from "@common/profiles"
import { ProfileInfo } from "@common/types"
import { useCurrentProfile, useStore, useStoreActions } from "@utils/store"

export interface CreateProfileModalProps {
  onClose(): void
  open: boolean
}

const emptyValue = "template:empty"

const templateProfiles: {
  description?: string
  id: string
  name: string
}[] = [
  {
    description: "Contains only basic mods and bugfixes.",
    id: "template:essentials",
    name: "Essentials",
  },
]

export interface CreateProfileFormProps {
  onClose(): void
}

export function CreateProfileForm({ onClose }: CreateProfileFormProps): JSX.Element {
  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()
  const profiles = useStore(store => store.profiles) || {}
  const profileIds = Object.keys(profiles)
  const hasProfiles = profileIds.length !== 0

  const { t } = useTranslation("CreateProfileModal")

  const [templateId, setTemplateId] = useState(currentProfile?.id ?? templateProfiles[0].id)
  const [name, setName] = useState<string>()

  const sourceProfile = profiles[templateId] as ProfileInfo | undefined
  const sourceTemplate = templateProfiles.find(profile => profile.id === templateId)
  const defaultName = sourceProfile ? `${sourceProfile.name} (Copy)` : hasProfiles ? "" : "Default"

  const nameValue = name ?? defaultName
  const nameError = nameValue.trim() ? undefined : t("name.errors.required", { ns: "Profile" })

  const id = createUniqueProfileId(nameValue, profileIds)

  return (
    <>
      <DialogTitle>{t(hasProfiles ? "title" : "titleFirst")}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <DialogContentText>{t("description")}</DialogContentText>
        <TextField
          autoFocus
          fullWidth
          id="name"
          label={t("name.label", { ns: "Profile" })}
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
          label={t("id.label", { ns: "Profile" })}
          name="id"
          value={id}
          variant="standard"
        />
        <FormControl fullWidth variant="standard">
          <InputLabel htmlFor="template" id="template-label">
            {t(hasProfiles ? "from.label" : "fromTemplate.label")}
          </InputLabel>
          <Select
            aria-describedby="template-description"
            fullWidth
            id="template"
            sx={{ "& .MuiSelect-icon": { marginRight: 3 } }}
            endAdornment={
              <Tooltip title={t("from.description")}>
                <InputAdornment position="end">
                  <Icon aria-label="Help">
                    <HelpIcon />
                  </Icon>
                </InputAdornment>
              </Tooltip>
            }
            labelId="template-label"
            MenuProps={{ sx: { maxHeight: 320 } }}
            name="template"
            onChange={event => setTemplateId(event.target.value)}
            required
            value={templateId}
            variant="standard"
          >
            <MenuItem value={emptyValue}>{t("from.emptyValue")}</MenuItem>
            <Divider />
            <ListSubheader>{t("from.template")}</ListSubheader>
            {templateProfiles.map(template => (
              <MenuItem key={template.id} value={template.id}>
                {template.name}
              </MenuItem>
            ))}
            {hasProfiles && <Divider />}
            {hasProfiles && <ListSubheader>{t("from.profile")}</ListSubheader>}
            {profileIds.map(profileId => (
              <MenuItem key={profileId} value={profileId}>
                {profiles[profileId].name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText id="template-description">
            {templateId === emptyValue
              ? t("from.emptyValueDescription")
              : sourceTemplate?.description}
          </FormHelperText>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onClose}>
          {t("actions.cancel.label")}
        </Button>
        <Button
          disabled={!!nameError}
          onClick={() => {
            if (templateId !== emptyValue) {
              actions.createProfile(nameValue.trim(), templateId)
            } else {
              actions.createProfile(nameValue.trim())
            }

            onClose()
          }}
        >
          {t("actions.create.label")}
        </Button>
      </DialogActions>
    </>
  )
}

export function CreateProfileModal({ onClose, open }: CreateProfileModalProps): JSX.Element {
  return (
    <Dialog open={open}>
      <CreateProfileForm onClose={onClose} />
    </Dialog>
  )
}
