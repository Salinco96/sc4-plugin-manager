import { SwitchAccount as SwitchProfileIcon } from "@mui/icons-material"
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  AppBar as MuiAppBar,
  Select,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  styled,
} from "@mui/material"
import { collect } from "@salinco/nice-utils"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type { ProfileID, ProfileInfo } from "@common/profiles"
import { useCurrentProfile, useStore, useStoreActions } from "@utils/store"
import { spacing } from "@utils/styles"

import { CreateProfileModal } from "./CreateProfileModal"

const newProfileId = "@new"

const ProfileNameInput = styled(TextField)`
  & input {
    color: inherit;
    font-size: 1.25rem;
    font-weight: 500;
    letter-spacing: 0.0075em;
    line-height: 1.6;
    margin: 0;
    padding: 0;
  }
`

const ProfileSelect = styled(Select<string>)`
  color: inherit;
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.0075em;
  line-height: 1.6;
  margin: 0;
  margin-right: ${spacing(4)};

  & .MuiSelect-select {
    padding: 0;
  }
`

export function AppBar(): JSX.Element {
  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()
  const profiles = useStore(store => store.profiles)
  const simtropolis = useStore(store => store.simtropolis)

  const isLoadingProfiles = !profiles
  const hasProfiles = profiles && Object.keys(profiles).length !== 0

  const [isCreating, setCreating] = useState(false)
  const [isRenaming, setRenaming] = useState(false)
  const [isSelecting, setSelecting] = useState(false)

  const { t } = useTranslation("AppBar")

  useEffect(() => {
    if (hasProfiles === false) {
      setCreating(true)
    }
  }, [hasProfiles])

  const renameProfile = (profile: ProfileInfo, value: string): void => {
    if (value && value !== profile.name) {
      actions.updateProfile(profile.id, { name: value })
    }

    setRenaming(false)
  }

  return (
    <MuiAppBar position="fixed" sx={{ zIndex: theme => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <Box sx={{ alignItems: "center", display: "flex", flexGrow: 1 }}>
          <Tooltip title={t(`actions.${hasProfiles ? "selectProfile" : "createProfile"}.label`)}>
            <IconButton
              aria-label={t(`actions.${hasProfiles ? "selectProfile" : "createProfile"}.label`)}
              color="inherit"
              disabled={isLoadingProfiles}
              onClick={() => (hasProfiles ? setSelecting(true) : setCreating(true))}
              sx={{ marginRight: 1 }}
            >
              <SwitchProfileIcon />
            </IconButton>
          </Tooltip>

          {isSelecting && profiles ? (
            <ProfileSelect
              MenuProps={{ sx: { marginLeft: -2 } }}
              defaultOpen
              defaultValue={currentProfile?.id ?? ""}
              disableUnderline
              fullWidth
              inputProps={{
                IconComponent: () => null,
              }}
              onChange={event => {
                const value = event.target.value as ProfileID

                setSelecting(false)

                if (value && value !== currentProfile?.id) {
                  if (value === newProfileId) {
                    setCreating(true)
                  } else {
                    actions.switchProfile(value)
                  }
                }
              }}
              onClose={() => setSelecting(false)}
              variant="standard"
            >
              {collect(profiles, (profileInfo, id) => (
                <MenuItem key={id} value={id}>
                  {profileInfo.name}
                </MenuItem>
              ))}
              <MenuItem value={newProfileId}>{t("actions.createProfile.label")}...</MenuItem>
            </ProfileSelect>
          ) : !currentProfile ? (
            <Typography component="h1" variant="h6" color="inherit" noWrap>
              {t("app", { ns: "General" })}
            </Typography>
          ) : isRenaming ? (
            <ProfileNameInput
              autoFocus
              defaultValue={currentProfile.name}
              fullWidth
              InputProps={{
                disableUnderline: true,
                onKeyDown: event => {
                  if (event.key === "Enter") {
                    const value = event.currentTarget.value
                    renameProfile(currentProfile, value)
                  }

                  if (event.key === "Escape") {
                    setRenaming(false)
                  }
                },
                sx: { color: "inherit" },
              }}
              onBlur={event => {
                const value = event.currentTarget.value
                renameProfile(currentProfile, value)
              }}
              variant="standard"
            />
          ) : (
            <>
              <Tooltip title={t("actions.renameProfile.label")}>
                <Typography
                  component="h1"
                  variant="h6"
                  color="inherit"
                  noWrap
                  onClick={() => setRenaming(true)}
                  sx={{ cursor: "pointer", width: "max-content" }}
                >
                  {currentProfile.name}
                </Typography>
              </Tooltip>
            </>
          )}
        </Box>

        {simtropolis === undefined && <CircularProgress color="inherit" size={24} />}

        {simtropolis === null && (
          <Tooltip title={t("actions.signIn.description")}>
            <Button color="inherit" onClick={actions.simtropolisLogin} variant="outlined">
              {t("actions.signIn.label")}
            </Button>
          </Tooltip>
        )}

        {simtropolis && (
          <>
            <Tooltip title={t("userId.description")}>
              <Typography variant="body1" color="inherit" noWrap sx={{ marginRight: 2 }}>
                {t("userId.label")}: {simtropolis.userId}
              </Typography>
            </Tooltip>
            <Tooltip title={t("actions.signOut.description")}>
              <Button color="inherit" onClick={actions.simtropolisLogout} variant="outlined">
                {t("actions.signOut.label")}
              </Button>
            </Tooltip>
          </>
        )}

        <CreateProfileModal onClose={() => setCreating(false)} open={isCreating} />
      </Toolbar>
    </MuiAppBar>
  )
}
