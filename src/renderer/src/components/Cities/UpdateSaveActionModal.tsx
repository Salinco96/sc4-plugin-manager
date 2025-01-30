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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
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
import { BooleanInput } from "@components/Input/BooleanInput"
import { PickerInput, type PickerOption } from "@components/Input/PickerInput"
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

  const { t } = useTranslation("UpdateSaveActionModal")

  const [isUpdating, setUpdating] = useState(false)
  const [options, setOptions] = useState(getDefaultOptions(action, alreadyBackedUp))

  return (
    <>
      <DialogTitle id="UpdateSaveActionModal-title">
        {city.name} - {t(`actions.${action}.title`)}
      </DialogTitle>
      <DialogContent id="UpdateSaveActionModal-description">
        <FlexCol gap={1}>
          <DialogContentText>{t(`actions.${action}.description`)}</DialogContentText>
          <Divider sx={{ mt: 1 }} />

          {"rciTypes" in options && (
            <PickerInput
              description={t("rciTypes.description")}
              label={t("rciTypes.label")}
              multiple
              name="rciTypes"
              onChange={rciTypes => setOptions({ ...options, rciTypes })}
              options={rciTypeOptions}
              required
              value={options.rciTypes}
            />
          )}

          {"density" in options && options.rciTypes.some(type => type !== RCIType.Agriculture) && (
            <PickerInput
              description={t("density.description")}
              label={t("density.label")}
              name="density"
              onChange={density => setOptions({ ...options, density })}
              options={densityOptions}
              required
              value={options.density}
            />
          )}

          {"historical" in options && (
            <BooleanInput
              description={t("historical.description")}
              label={t("historical.label")}
              name="historical"
              onChange={historical => setOptions({ ...options, historical })}
              value={options.historical}
            />
          )}

          <BooleanInput
            description={t(alreadyBackedUp ? "backup.alreadyBackedUp" : "backup.description")}
            disabled={alreadyBackedUp}
            label={t("backup.label")}
            name="backup"
            onChange={backup => setOptions({ ...options, backup })}
            value={options.backup}
          />

          <Divider sx={{ mb: 1 }} />

          {options.action === "growify" && (
            <>
              <Alert severity="warning">{t("warnings.growify.message")}</Alert>
              {options.rciTypes.some(type => type !== RCIType.Residential) && (
                <Alert severity="warning">
                  <AlertTitle> {t("warnings.growifyFunctionalLandmarks.title")}</AlertTitle>
                  {t("warnings.growifyFunctionalLandmarks.message")}
                </Alert>
              )}
            </>
          )}

          {!options.backup && !alreadyBackedUp && (
            <Alert severity="warning">
              <AlertTitle>{t("warnings.backupDisabled.title")}</AlertTitle>
              {t("warnings.backupDisabled.message")}
            </Alert>
          )}
        </FlexCol>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onClose} variant="outlined">
          {t("cancel", { ns: "General" })}
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
          {t("confirm", { ns: "General" })}
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
    case "fix": {
      return {
        action,
        backup: !alreadyBackedUp,
      }
    }

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
    case "fix": {
      return true
    }

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

const densityOptions: PickerOption<ZoneDensity>[] = [
  {
    description: "Low density",
    icon: LowDensityIcon,
    value: ZoneDensity.LOW,
  },
  {
    description: "Medium density",
    icon: MediumDensityIcon,
    value: ZoneDensity.MEDIUM,
  },
  {
    description: "High density",
    icon: HighDensityIcon,
    value: ZoneDensity.HIGH,
  },
]

const rciTypeOptions: PickerOption<RCIType>[] = [
  {
    color: "success",
    description: "Residential",
    icon: ResidentialIcon,
    value: RCIType.Residential,
  },
  {
    color: "info",
    description: "Commercial",
    icon: CommercialIcon,
    value: RCIType.Commercial,
  },
  {
    color: "warning",
    description: "Industry",
    icon: IndustrialIcon,
    value: RCIType.Industrial,
  },
  {
    color: "warning",
    description: "Agriculture",
    icon: AgricultureIcon,
    value: RCIType.Agriculture,
  },
]
