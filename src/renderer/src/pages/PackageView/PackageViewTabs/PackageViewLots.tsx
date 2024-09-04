import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
import { Card, CardContent, Checkbox, List, ListItem, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"

import { getCategoryLabel } from "@common/categories"
import { getOptionValue, getRequirementLabel, getRequirementValueLabel } from "@common/options"
import { checkCondition } from "@common/packages"
import { toggleElement } from "@common/utils/arrays"
import { entries } from "@common/utils/objects"
import { FlexBox } from "@components/FlexBox"
import { Text } from "@components/Text"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useStore, useStoreActions } from "@utils/store"

const OPTIONID = "lots"

export function PackageViewLots({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const features = useStore(store => store.features)
  const globalOptions = useStore(store => store.globalOptions)
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.globalOptions)
  const packageConfig = profileInfo?.packages[packageId]
  const variantInfo = useCurrentVariant(packageId)

  const option = variantInfo.options?.find(option => option.id === OPTIONID)
  if (!option) {
    return <></>
  }

  const enabledLots = getOptionValue(option, {
    ...packageConfig?.options,
    ...profileInfo?.options,
  }) as string[]

  const { t } = useTranslation("PackageViewLots")

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo?.lots?.map(lot => {
        const enabled = !lot.filename || enabledLots.includes(lot.id)

        const incompatible = !checkCondition(
          lot.requirements,
          packageId,
          variantInfo,
          profileInfo,
          profileOptions,
          features,
        )

        return (
          <ListItem key={lot.id} sx={{ padding: 0 }}>
            <Card
              elevation={1}
              sx={{
                color: incompatible ? "rgba(0, 0, 0, 0.36)" : undefined,
                display: "flex",
                width: "100%",
              }}
            >
              <CardContent sx={{ width: "100%" }}>
                <FlexBox alignItems="center">
                  <Text maxLines={1} sx={{ flex: 1 }} variant="h6">
                    {lot.label}
                  </Text>
                  <FlexBox alignItems="center">
                    <Checkbox
                      icon={incompatible ? <IncompatibleIcon /> : undefined}
                      checked={enabled && !incompatible}
                      color="primary"
                      disabled={!lot.filename || incompatible}
                      // name={option.id}
                      onClick={async event => {
                        const { checked } = event.target as HTMLInputElement
                        if (lot.filename && checked !== enabled) {
                          await actions.setPackageOption(
                            packageId,
                            OPTIONID,
                            toggleElement(enabledLots, lot.id),
                          )
                        }
                      }}
                      title={enabled ? t("excludeLot") : t("includeLot")}
                    />
                  </FlexBox>
                </FlexBox>

                {/* TODO: Better formatting */}
                {!!lot.id.match(/^[a-f0-9]{8}$/) && (
                  <Typography variant="body2">
                    <b>{t("tgi")}:</b> 6534284a - a8fbd372 - {lot.id}
                  </Typography>
                )}

                {/* TODO: Better formatting */}
                <Typography variant="body2">
                  <b>{t("category")}:</b>{" "}
                  {(lot.categories ?? variantInfo.categories)
                    .map(categoryId => getCategoryLabel(categoryId))
                    .join(", ")}
                </Typography>

                {/* TODO: Better formatting */}
                {lot.stage && (
                  <Typography variant="body2">
                    <b>{t("stage")}:</b> {lot.stage}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.cost !== undefined && (
                  <Typography variant="body2">
                    <b>{t("cost")}:</b> {lot.cost} §
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.bulldoze !== undefined && (
                  <Typography variant="body2">
                    <b>{t("bulldoze")}:</b> {lot.bulldoze} §
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.size && (
                  <Typography variant="body2">
                    <b>{t("size")}:</b> {lot.size}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.demand && (
                  <Typography variant="body2">
                    <b>{t("demand")}:</b>{" "}
                    {Object.entries(lot.demand)
                      .reverse()
                      .map(([type, capacity]) => `${capacity} ${type.toUpperCase()}`)
                      .join("; ")}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.yimby !== undefined && (
                  <Typography variant="body2">
                    <b>{t("yimby")}:</b> {lot.yimby}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.powerProduction !== undefined && (
                  <Typography variant="body2">
                    <b>{t("powerProduction")}:</b> {lot.powerProduction}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.power !== undefined && (
                  <Typography variant="body2">
                    <b>{t("power")}:</b> {lot.power}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.waterProduction !== undefined && (
                  <Typography variant="body2">
                    <b>{t("waterProduction")}:</b> {lot.waterProduction}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.water !== undefined && (
                  <Typography variant="body2">
                    <b>{t("water")}:</b> {lot.water}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.pollution !== undefined && (
                  <Typography variant="body2">
                    <b>{t("pollution")}:</b> {lot.pollution}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.waterPollution !== undefined && (
                  <Typography variant="body2">
                    <b>{t("waterPollution")}:</b> {lot.waterPollution}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.garbage !== undefined && (
                  <Typography variant="body2">
                    <b>{t("garbage")}:</b> {lot.garbage}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.flamability !== undefined && (
                  <Typography variant="body2">
                    <b>{t("flamability")}:</b> {lot.flamability}
                  </Typography>
                )}
                {/* TODO: Better formatting */}
                {lot.requirements && (
                  <Typography variant="body2">
                    <b>{t("requirements")}:</b>
                    <ul>
                      {entries(lot.requirements).map(([requirement, value]) => (
                        <li key={requirement}>
                          {getRequirementLabel(t, requirement, variantInfo.options, globalOptions)}
                          {": "}
                          {getRequirementValueLabel(
                            t,
                            requirement,
                            value,
                            variantInfo.options,
                            globalOptions,
                          )}
                        </li>
                      ))}
                    </ul>
                  </Typography>
                )}
              </CardContent>
            </Card>
          </ListItem>
        )
      })}
    </List>
  )
}
