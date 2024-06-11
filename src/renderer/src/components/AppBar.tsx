import { useEffect, useState } from "react"

import { SwitchAccount as SwitchProfileIcon } from "@mui/icons-material"
import {
  AppBar as MuiAppBar,
  Box,
  IconButton,
  MenuItem,
  Select,
  styled,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material"

import { ProfileInfo } from "@common/types"
import { useCurrentProfile, useStore, useStoreActions } from "@renderer/utils/store"

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
  margin-right: ${({ theme }): string => theme.spacing(4)};

  & .MuiSelect-select {
    padding: 0;
  }
`

export function AppBar(): JSX.Element {
  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()
  const profiles = useStore(store => store.profiles)
  const settings = useStore(store => store.settings)
  const userId = useStore(store => store.sessions.simtropolis.userId)

  const isLoadingProfiles = profiles === undefined
  const hasProfiles = profiles && Object.keys(profiles).length !== 0

  const [isCreating, setCreating] = useState(false)
  const [isRenaming, setRenaming] = useState(false)
  const [isSelecting, setSelecting] = useState(false)

  useEffect(() => {
    if (hasProfiles === false) {
      setCreating(true)
    }
  }, [hasProfiles])

  // TODO: Remove this
  useEffect(() => {
    if (profiles?.length && settings && !currentProfile) {
      actions.switchProfile(profiles[0].id)
    }
  }, [currentProfile, profiles, settings])

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
          <Tooltip title={hasProfiles ? "Select profile" : "Create profile"}>
            <IconButton
              aria-label={hasProfiles ? "Select profile" : "Create profile"}
              color="inherit"
              disabled={isLoadingProfiles}
              onClick={() => (hasProfiles ? setSelecting(true) : setCreating(true))}
              sx={{ marginRight: 1 }}
            >
              <SwitchProfileIcon />
            </IconButton>
          </Tooltip>

          {isSelecting ? (
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
                const value = event.target.value

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
              {Object.values(profiles ?? {}).map(profile => (
                <MenuItem key={profile.id} value={profile.id}>
                  {profile.name}
                </MenuItem>
              ))}
              <MenuItem value={newProfileId}>Create profile...</MenuItem>
            </ProfileSelect>
          ) : !currentProfile ? (
            <Typography component="h1" variant="h6" color="inherit" noWrap>
              SC4 Plugin Manager
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
              <Tooltip title="Rename profile">
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

        {userId === undefined && <CircularProgress color="inherit" size={24} />}

        {userId === null && (
          <Tooltip title="Simtropolis has a daily limit of 20 downloads for anonymous users. Sign it to bypass the limit.">
            <Button color="inherit" onClick={actions.simtropolisLogin} variant="outlined">
              Sign In
            </Button>
          </Tooltip>
        )}

        {userId && (
          <>
            <Tooltip title="Simtropolis user ID">
              <Typography variant="body1" color="inherit" noWrap sx={{ marginRight: 2 }}>
                User ID: {userId}
              </Typography>
            </Tooltip>
            <Tooltip title="Sign out of Simtropolis">
              <Button color="inherit" onClick={actions.simtropolisLogout} variant="outlined">
                Sign Out
              </Button>
            </Tooltip>
          </>
        )}

        <CreateProfileModal onClose={() => setCreating(false)} open={isCreating} />
      </Toolbar>
    </MuiAppBar>
  )
}
