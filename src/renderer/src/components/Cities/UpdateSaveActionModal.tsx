import {
  Agriculture as AgricultureIcon,
  CorporateFare as CommercialIcon,
  Apartment as HighDensityIcon,
  Factory as IndustrialIcon,
  House as LowDensityIcon,
  HomeWork as MediumDensityIcon,
  Apartment as ResidentialIcon,
} from "@mui/icons-material"
import {
  Alert,
  AlertTitle,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormLabel,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { RCIType, ZoneDensity } from "@common/lots"
import {
  type CityBackupInfo,
  type CityID,
  type RegionID,
  type UpdateSaveAction,
  hasBackup,
} from "@common/regions"
import { FlexCol } from "@components/FlexBox"
import { updateSave } from "@stores/actions"
import { store } from "@stores/main"

export interface UpdateSaveActionModalProps {
  action?: UpdateSaveAction["action"]
  backup?: CityBackupInfo
  cityId: CityID
  onClose: () => void
  regionId: RegionID
}

export function UpdateSaveActionModal(props: UpdateSaveActionModalProps): JSX.Element {
  return (
    <Dialog
      aria-describedby="UpdateSaveActionModal-description"
      aria-labelledby="UpdateSaveActionModal-title"
      onClose={props.onClose}
      open={!!props.action}
      PaperProps={{ sx: { width: 600 } }}
    >
      {props.action && (
        <UpdateSaveActionModalForm {...props} action={props.action} key={props.action} />
      )}
    </Dialog>
  )
}

function UpdateSaveActionModalForm({
  action,
  backup,
  cityId,
  onClose,
  regionId,
}: UpdateSaveActionModalProps & { action: UpdateSaveAction["action"] }): JSX.Element {
  const city = store.useCityInfo(regionId, cityId)
  const alreadyBackedUp = !backup && hasBackup(city)

  const { t } = useTranslation("CityView")

  const [isUpdating, setUpdating] = useState(false)
  const [options, setOptions] = useState(getDefaultOptions(action, alreadyBackedUp))

  return (
    <>
      <DialogTitle id="UpdateSaveActionModal-title">
        {city.name} - {t(`actions.${action}.modalTitle`)}
      </DialogTitle>
      <DialogContent id="UpdateSaveActionModal-description">
        <FlexCol gap={1}>
          <DialogContentText>{t(`actions.${action}.modalDescription`)}</DialogContentText>
          <Divider sx={{ mt: 1 }} />

          {"rciTypes" in options && (
            <FormControl
              fullWidth
              sx={{ alignItems: "center", flexDirection: "row" }}
              title="Which RCI types should be affected?"
            >
              <FormLabel id="rciTypes-label" sx={{ flex: 1 }}>
                RCI types
              </FormLabel>
              <ToggleButtonGroup
                aria-labelledby="rciTypes-label"
                onChange={(_event, rciTypes) => setOptions({ ...options, rciTypes })}
                size="small"
                value={options.rciTypes}
              >
                <ToggleButton
                  aria-label="Residential"
                  color="success"
                  value={RCIType.Residential}
                  title="Residential"
                >
                  <ResidentialIcon />
                </ToggleButton>
                <ToggleButton
                  aria-label="Commercial"
                  color="info"
                  value={RCIType.Commercial}
                  title="Commercial"
                >
                  <CommercialIcon />
                </ToggleButton>
                <ToggleButton
                  aria-label="Industry"
                  color="warning"
                  value={RCIType.Industrial}
                  title="Industry"
                >
                  <IndustrialIcon />
                </ToggleButton>
                <ToggleButton
                  aria-label="Agriculture"
                  color="warning"
                  value={RCIType.Agriculture}
                  title="Agriculture"
                >
                  <AgricultureIcon />
                </ToggleButton>
              </ToggleButtonGroup>
            </FormControl>
          )}

          {"density" in options && options.rciTypes.some(type => type !== RCIType.Agriculture) && (
            <FormControl
              fullWidth
              sx={{ alignItems: "center", flexDirection: "row" }}
              title="Which zone density should be used if one cannot be picked automatically?"
            >
              <FormLabel id="density-label" sx={{ flex: 1 }}>
                Preferred zone density
              </FormLabel>
              <ToggleButtonGroup
                aria-labelledby="density-label"
                exclusive
                onChange={(_event, density) => density && setOptions({ ...options, density })}
                size="small"
                value={options.density}
              >
                <ToggleButton value={ZoneDensity.LOW} aria-label="Low density" title="Low density">
                  <LowDensityIcon />
                </ToggleButton>
                <ToggleButton
                  value={ZoneDensity.MEDIUM}
                  aria-label="Medium density"
                  title="Medium density"
                >
                  <MediumDensityIcon />
                </ToggleButton>
                <ToggleButton
                  value={ZoneDensity.HIGH}
                  aria-label="High density"
                  title="High density"
                >
                  <HighDensityIcon />
                </ToggleButton>
              </ToggleButtonGroup>
            </FormControl>
          )}

          {"historical" in options && (
            <FormControl
              fullWidth
              sx={{ alignItems: "center", flexDirection: "row", minHeight: 40 }}
              title="Mark growified buildings as historical so they will not redevelop (recommended)"
            >
              <FormLabel id="historical-label" sx={{ flex: 1 }}>
                Make historical?
              </FormLabel>
              <Checkbox
                aria-labelledby="historical-label"
                checked={!!options.historical}
                color="primary"
                id="historical"
                name="historical"
                onChange={event => setOptions({ ...options, historical: event.target.checked })}
                sx={{ marginRight: "-9px" }}
              />
            </FormControl>
          )}

          <FormControl
            disabled={alreadyBackedUp}
            fullWidth
            sx={{ alignItems: "center", flexDirection: "row", minHeight: 40 }}
            title={
              alreadyBackedUp
                ? "A backup of this version already exists"
                : "Create a backup before updating (recommended)"
            }
          >
            <FormLabel id="backup-label" sx={{ flex: 1 }}>
              Create backup?
            </FormLabel>
            <Checkbox
              aria-labelledby="backup-label"
              checked={!!options.backup}
              color="primary"
              id="backup"
              name="backup"
              onChange={event => setOptions({ ...options, backup: event.target.checked })}
              sx={{ marginRight: "-9px" }}
            />
          </FormControl>

          <Divider sx={{ mb: 1 }} />

          {action === "growify" && (
            <Alert severity="warning">
              Using growified or plopped RCI may unbalance the simulation, especially if there is
              not enough existing demand when building. Some abnormalities may be resolved by
              running the simulation for a few in-game months.
            </Alert>
          )}

          {action === "growify" && options.rciTypes.some(type => type !== RCIType.Residential) && (
            <Alert severity="warning">
              <AlertTitle>Functional landmarks</AlertTitle>
              This action will also convert functional landmarks, making them susceptible to
              abandonment and redevelopment. Additionally, civics and networks can be built directly
              onto such buildings, destroying them without warning, just like normal growables.
            </Alert>
          )}

          {!options.backup && !alreadyBackedUp && (
            <Alert severity="warning">
              <AlertTitle>Backup disabled</AlertTitle>
              The original version will be permanently lost.
            </Alert>
          )}
        </FlexCol>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          disabled={isUpdating || !isValidOptions(options)}
          onClick={async () => {
            try {
              setUpdating(true)
              if (await updateSave(regionId, cityId, backup?.file ?? null, options)) {
                onClose()
              }
            } finally {
              setUpdating(false)
            }
          }}
          type="submit"
          variant="outlined"
        >
          Confirm
        </Button>
      </DialogActions>
    </>
  )
}

function getDefaultOptions(
  action: UpdateSaveAction["action"],
  alreadyBackedUp: boolean,
): UpdateSaveAction {
  switch (action) {
    case "growify": {
      return {
        action,
        backup: !alreadyBackedUp,
        density: ZoneDensity.LOW,
        historical: true,
        rciTypes: [RCIType.Residential],
      }
    }

    case "historical": {
      return {
        action,
        backup: !alreadyBackedUp,
        rciTypes: [
          RCIType.Residential,
          RCIType.Commercial,
          RCIType.Industrial,
          RCIType.Agriculture,
        ],
      }
    }
  }
}

function isValidOptions(action: UpdateSaveAction): boolean {
  switch (action.action) {
    case "growify": {
      return action.rciTypes.length > 0
    }

    case "historical": {
      return action.rciTypes.length > 0
    }
  }
}

export function useUpdateSaveActionModal(props: {
  backup?: CityBackupInfo
  cityId: CityID
  regionId: RegionID
}): [
  modalProps: UpdateSaveActionModalProps,
  openModal: (action: UpdateSaveAction["action"]) => void,
] {
  const [action, setAction] = useState<UpdateSaveAction["action"]>()

  const onClose = useCallback(() => setAction(undefined), [])

  return [{ ...props, action, onClose }, setAction]
}
