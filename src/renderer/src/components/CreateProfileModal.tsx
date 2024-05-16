import { useState } from "react"

import HelpIcon from "@mui/icons-material/HelpOutline"
import Button from "@mui/material/Button"
import Dialog from "@mui/material/Dialog"
import DialogActions from "@mui/material/DialogActions"
import DialogContent from "@mui/material/DialogContent"
import DialogContentText from "@mui/material/DialogContentText"
import DialogTitle from "@mui/material/DialogTitle"
import Divider from "@mui/material/Divider"
import FormControl from "@mui/material/FormControl"
import FormHelperText from "@mui/material/FormHelperText"
import Icon from "@mui/material/Icon"
import InputAdornment from "@mui/material/InputAdornment"
import InputLabel from "@mui/material/InputLabel"
import ListSubheader from "@mui/material/ListSubheader"
import MenuItem from "@mui/material/MenuItem"
import Select from "@mui/material/Select"
import TextField from "@mui/material/TextField"
import Tooltip from "@mui/material/Tooltip"

import { ProfileInfo } from "@common/types"
import { createUniqueProfileId } from "@renderer/utils/profiles"
import { useCurrentProfile, useStore, useStoreActions } from "@renderer/utils/store"

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
  const allProfiles = Object.values(profiles)
  const hasProfiles = allProfiles.length !== 0

  const [templateId, setTemplateId] = useState(currentProfile?.id ?? templateProfiles[0].id)
  const [name, setName] = useState<string>()

  const sourceProfile = profiles[templateId] as ProfileInfo | undefined
  const sourceTemplate = templateProfiles.find(profile => profile.id === templateId)
  const defaultName = sourceProfile ? `${sourceProfile.name} (Copy)` : hasProfiles ? "" : "Default"

  const nameValue = name ?? defaultName
  const nameError = nameValue.trim() ? undefined : "Required"

  const id = createUniqueProfileId(nameValue, allProfiles)

  return (
    <>
      <DialogTitle>{hasProfiles ? "Create profile" : "Create your first profile"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <DialogContentText>
          Profiles allow you to enable different mods while playing different regions, without
          having to manually move and rename folders, and without storing copies of any files.
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          id="name"
          label="Profile name"
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
              <Tooltip title="Unique ID corresponding to the configuration filename in Profiles folder. Cannot be modified later.">
                <InputAdornment position="end">
                  <Icon aria-label="Help">
                    <HelpIcon />
                  </Icon>
                </InputAdornment>
              </Tooltip>
            ),
          }}
          label="Profile ID"
          name="id"
          value={id}
          variant="standard"
        />
        <FormControl fullWidth variant="standard">
          <InputLabel htmlFor="template" id="template-label">
            {hasProfiles ? "Create from" : "Create from template"}
          </InputLabel>
          <Select
            aria-describedby="template-description"
            fullWidth
            id="template"
            sx={{ "& .MuiSelect-icon": { marginRight: 3 } }}
            endAdornment={
              <Tooltip title="You can either duplicate one of your existing profiles or create a new profile from a predefined template.">
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
            <MenuItem value={emptyValue}>Empty</MenuItem>
            <Divider />
            <ListSubheader>Template</ListSubheader>
            {templateProfiles.map(template => (
              <MenuItem key={template.id} value={template.id}>
                {template.name}
              </MenuItem>
            ))}
            {hasProfiles && <Divider />}
            {hasProfiles && <ListSubheader>Profile</ListSubheader>}
            {allProfiles.map(profile => (
              <MenuItem key={profile.id} value={profile.id}>
                {profile.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText id="template-description">
            {templateId === emptyValue ? "Create an empty profile." : sourceTemplate?.description}
          </FormHelperText>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!!nameError}
          onClick={() => {
            actions.createProfile({
              packages: {},
              ...sourceTemplate,
              ...sourceProfile,
              id,
              name: nameValue.trim(),
            })

            onClose()
          }}
        >
          Create
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
