import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
import { Card, CardContent, Checkbox, List, ListItem, Typography } from "@mui/material"
import { collect, groupBy, mapValues, remove, values } from "@salinco/nice-utils"
import { Fragment, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { getCategories } from "@common/categories"
import { getOptionValue, getRequirementLabel, getRequirementValueLabel } from "@common/options"
import { LOTS_OPTION_ID, checkCondition } from "@common/packages"
import { getMenuLabel } from "@common/variants"
import { FlexBox } from "@components/FlexBox"
import { PackageTag } from "@components/Tags/PackageTag"
import { TagType, createTag, serializeTag } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { Thumbnail } from "@components/Thumbnail"
import { ImageViewer } from "@components/Viewer/ImageViewer"
import { useCurrentVariant } from "@utils/packages"
import {
  useCurrentProfile,
  useFeatures,
  useSettings,
  useStore,
  useStoreActions,
} from "@utils/store"
import type { PackageViewTabInfoProps } from "./tabs"

export default function PackageViewLots({ packageId }: PackageViewTabInfoProps): JSX.Element {
  const actions = useStoreActions()
  const features = useFeatures()
  const settings = useSettings()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const packageConfig = profileInfo?.packages[packageId]
  const variantInfo = useCurrentVariant(packageId)

  const [openImages, setOpenImages] = useState<string>()

  const { t } = useTranslation("PackageViewLots")

  const groupedLots = useMemo(() => {
    // Collect unique buildings by ID
    const buildings = mapValues(
      groupBy(variantInfo.buildings ?? [], building => building.id),
      (buildings, buildingId) => {
        if (buildings.length === 1) {
          // TODO: Check filenames whether a single building is currently enabled via options
          if (buildings.length !== 1) {
            console.warn(`Duplicate lot ${buildingId}`)
          }

          return buildings[0]
        }
      },
    )

    // Collect unique lots by ID
    const lots = mapValues(
      groupBy(variantInfo.lots ?? [], lot => lot.id),
      (lots, lotId) => {
        if (lots.length === 1) {
          // TODO: Check filenames whether a single lot is currently enabled via options
          if (lots.length !== 1) {
            console.warn(`Duplicate lot ${lotId}`)
          }

          return lots[0]
        }
      },
    )

    // Group lots by building
    return values(
      mapValues(
        groupBy(values(lots), lot => lot.building ?? lot.id),
        (lots, buildingId) => ({
          building: buildings[buildingId],
          lots,
        }),
      ),
    )
  }, [variantInfo])

  const option = variantInfo.options?.find(option => option.id === LOTS_OPTION_ID)
  if (!option) {
    return <></>
  }

  const enabledLots = getOptionValue(option, {
    ...packageConfig?.options,
    ...profileInfo?.options,
  }) as string[]

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {groupedLots.map(({ building, lots }) => {
        const categories = building?.categories ?? getCategories(variantInfo)
        const tags = categories.map(category => createTag(TagType.CATEGORY, category))

        const menus =
          (features.submenus && building?.submenus) ||
          (building?.menu ? [building.menu] : undefined)

        return (
          <Fragment key={building?.id ?? lots[0].id}>
            {lots.map(lot => {
              const enabled = !lot.filename || enabledLots.includes(lot.id)

              const incompatible = !checkCondition(
                lot.requirements,
                packageId,
                variantInfo,
                profileInfo,
                profileOptions,
                features,
                settings,
              )

              const tgi = lot.id.match(/^[a-f0-9]{8}$/) ? `6534284a-a8fbd372-${lot.id}` : undefined

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
                      <FlexBox direction="column" gap={2}>
                        <FlexBox alignItems="center">
                          {!!lot.images?.length && (
                            <>
                              <ImageViewer
                                images={lot.images}
                                onClose={() => setOpenImages(undefined)}
                                open={openImages === lot.id}
                              />
                              <Thumbnail
                                mr={2}
                                mt={1}
                                onClick={() => setOpenImages(lot.id)}
                                size={84}
                                src={lot.images[0]}
                              />
                            </>
                          )}
                          <FlexBox direction="column" width="100%">
                            <Text maxLines={1} sx={{ flex: 1 }} variant="h6">
                              {building?.label ?? lot.name}
                            </Text>

                            {(lot.filename || tgi) && (
                              <FlexBox direction="row" gap={2}>
                                {lot.filename && (
                                  <Typography variant="body2">{lot.filename}</Typography>
                                )}
                                {tgi && lot.filename && <Typography variant="body2">|</Typography>}
                                {tgi && <Typography variant="body2">{tgi}</Typography>}
                              </FlexBox>
                            )}

                            {!!tags.length && (
                              <FlexBox direction="row" gap={1} mt={1}>
                                {tags.map(tag => (
                                  <PackageTag key={serializeTag(tag.type, tag.value)} {...tag} />
                                ))}
                              </FlexBox>
                            )}
                          </FlexBox>

                          <FlexBox alignSelf="start">
                            <Checkbox
                              icon={incompatible ? <IncompatibleIcon /> : undefined}
                              checked={enabled && !incompatible}
                              color="primary"
                              disabled={!lot.filename?.endsWith(".SC4Lot") || incompatible}
                              name={lot.name}
                              onClick={async event => {
                                const { checked } = event.target as HTMLInputElement
                                if (lot.filename && checked !== enabled) {
                                  await actions.setPackageOption(
                                    packageId,
                                    option.id,
                                    enabled
                                      ? remove(enabledLots, lot.id)
                                      : [...enabledLots, lot.id],
                                  )
                                }
                              }}
                              title={enabled ? t("excludeLot") : t("includeLot")}
                            />
                          </FlexBox>
                        </FlexBox>

                        {building?.description && (
                          <Typography
                            sx={{ fontStyle: "italic", whiteSpace: "pre" }}
                            variant="body2"
                          >
                            {building.description}
                          </Typography>
                        )}

                        <FlexBox direction="column" gap={1}>
                          {/* TODO: Better formatting */}
                          {lot.stage && (
                            <Typography variant="body2">
                              <b>{`${t("stage")}: `}</b>
                              {lot.stage}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {menus?.length && (
                            <Typography variant="body2">
                              <b>{`${t("menu")}: `}</b>
                              {menus.map(getMenuLabel).join(", ")}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.cost !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("cost")}: `}</b>
                              {building.cost} §
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.maintenance !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("maintenance")}: `}</b>
                              {building.maintenance} § / month
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.bulldoze !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("bulldoze")}: `}</b>
                              {building.bulldoze} §
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {lot.size && (
                            <Typography variant="body2">
                              <b>{`${t("size")}: `}</b>
                              {lot.size}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.capacity && (
                            <Typography variant="body2">
                              <b>{`${t("demand")}: `}</b>
                              {Object.entries(building.capacity)
                                .reverse()
                                .map(([type, capacity]) => `${capacity} ${type.toUpperCase()}`)
                                .join("; ")}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.landmark !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("landmark")}: `}</b>
                              {t("overTiles", {
                                amount: building.landmark,
                                count: building.landmarkRadius ?? 0,
                              })}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.rating !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("rating")}: `}</b>
                              {t("overTiles", {
                                amount: building.rating,
                                count: building.ratingRadius ?? 0,
                              })}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.powerProduction !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("powerProduction")}: `}</b>
                              {building.powerProduction}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.power !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("power")}: `}</b>
                              {building.power}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.waterProduction !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("waterProduction")}: `}</b>
                              {building.waterProduction}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.water !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("water")}: `}</b>
                              {building.water}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.pollution !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("pollution")}: `}</b>
                              {t("overTiles", {
                                amount: building.pollution,
                                count: building.pollutionRadius ?? 0,
                              })}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.waterPollution !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("waterPollution")}: `}</b>
                              {t("overTiles", {
                                amount: building.waterPollution,
                                count: building.waterPollutionRadius ?? 0,
                              })}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.garbage !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("garbage")}: `}</b>
                              {t("overTiles", {
                                amount: building.garbage,
                                count: building.garbageRadius ?? 0,
                              })}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.radiation !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("radiation")}: `}</b>
                              {t("overTiles", {
                                amount: building.radiation,
                                count: building.radiationRadius ?? 0,
                              })}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {building?.flamability !== undefined && (
                            <Typography variant="body2">
                              <b>{`${t("flamability")}: `}</b>
                              {building.flamability}
                            </Typography>
                          )}

                          {/* TODO: Better formatting */}
                          {lot.requirements && (
                            <>
                              <Typography variant="body2">
                                <b>{`${t("requirements")}: `}</b>
                              </Typography>
                              <ul style={{ marginBlockStart: 0 }}>
                                {collect(lot.requirements, (value, requirement) => (
                                  <li key={requirement}>
                                    {`${getRequirementLabel(
                                      t,
                                      requirement,
                                      variantInfo.options,
                                      profileOptions,
                                    )}: ${getRequirementValueLabel(
                                      t,
                                      requirement,
                                      value,
                                      variantInfo.options,
                                      profileOptions,
                                    )}`}
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </FlexBox>
                      </FlexBox>
                    </CardContent>
                  </Card>
                </ListItem>
              )
            })}
          </Fragment>
        )
      })}
    </List>
  )
}
