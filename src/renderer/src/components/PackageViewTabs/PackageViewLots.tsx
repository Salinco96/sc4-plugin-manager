import { getOptionValue, getRequirementLabel, getRequirementValueLabel } from "@common/options"
import { LOTS_OPTION_ID, checkCondition } from "@common/packages"
import { getMenuLabel } from "@common/submenus"
import { FlexBox } from "@components/FlexBox"
import { PackageTag } from "@components/Tags/PackageTag"
import { TagType, createTag, serializeTag } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { Thumbnail } from "@components/Thumbnail"
import { ImageViewer } from "@components/Viewer/ImageViewer"
import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
import { Card, CardContent, Checkbox, Divider, List, ListItem, Typography } from "@mui/material"
import {
  collect,
  containsAll,
  difference,
  groupBy,
  intersection,
  mapValues,
  toggle,
  union,
  values,
} from "@salinco/nice-utils"
import { formatNumber, formatSimoleans } from "@utils/format"
import { useCurrentVariant } from "@utils/packages"
import {
  useCurrentProfile,
  useFeatures,
  useSettings,
  useStore,
  useStoreActions,
} from "@utils/store"
import { Fragment, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
        const tags = building?.categories?.map(category => createTag(TagType.CATEGORY, category))

        const menus =
          (features.submenus && building?.submenus) ||
          (building?.menu ? [building.menu] : undefined)

        const compatible = lots
          .filter(lot =>
            checkCondition(
              lot.requirements,
              packageId,
              variantInfo,
              profileInfo,
              profileOptions,
              features,
              settings,
            ),
          )
          .map(lot => lot.id)

        const togglable = lots
          .filter(lot => !!lot.filename?.endsWith(".SC4Lot") && compatible.includes(lot.id))
          .map(lot => lot.id)

        const enabled = intersection(compatible, enabledLots)

        return (
          <ListItem key={building?.id ?? lots[0].id} sx={{ padding: 0 }}>
            <Card
              elevation={1}
              sx={{
                color: compatible.length ? undefined : "rgba(0, 0, 0, 0.36)",
                display: "flex",
                width: "100%",
              }}
            >
              <CardContent sx={{ width: "100%" }}>
                <FlexBox direction="column" gap={2}>
                  {building && (
                    <FlexBox alignItems="center">
                      {!!building.images?.length && (
                        <>
                          <ImageViewer
                            images={building.images}
                            onClose={() => setOpenImages(undefined)}
                            open={openImages === building.id}
                          />
                          <Thumbnail
                            mr={2}
                            mt={1}
                            onClick={() => setOpenImages(building.id)}
                            size={84}
                            src={building.images[0]}
                          />
                        </>
                      )}
                      <FlexBox direction="column" width="100%">
                        {(building.label ?? building.name) && (
                          <Text maxLines={1} sx={{ flex: 1 }} variant="h6">
                            {building.label ?? building.name}
                          </Text>
                        )}

                        {building.filename && (
                          <FlexBox direction="row" gap={2}>
                            {building?.filename && (
                              <Typography variant="body2">{building.filename}</Typography>
                            )}
                          </FlexBox>
                        )}

                        {!!tags?.length && (
                          <FlexBox direction="row" gap={1} mt={1}>
                            {tags.map(tag => (
                              <PackageTag key={serializeTag(tag.type, tag.value)} {...tag} />
                            ))}
                          </FlexBox>
                        )}
                      </FlexBox>

                      <FlexBox alignSelf="start">
                        <Checkbox
                          icon={compatible.length ? undefined : <IncompatibleIcon />}
                          checked={containsAll(enabled, compatible)}
                          color="primary"
                          disabled={!togglable.length}
                          name={building?.id}
                          onClick={async event => {
                            const { checked } = event.target as HTMLInputElement
                            if (checked !== containsAll(enabled, compatible)) {
                              await actions.setPackageOption(
                                packageId,
                                option.id,
                                containsAll(enabled, compatible)
                                  ? difference(enabledLots, togglable)
                                  : union(enabledLots, togglable),
                              )
                            }
                          }}
                          title={enabled ? t("excludeLot") : t("includeLot")}
                        />
                      </FlexBox>
                    </FlexBox>
                  )}

                  {building?.description && (
                    <Typography sx={{ fontStyle: "italic", whiteSpace: "pre" }} variant="body2">
                      {building.description}
                    </Typography>
                  )}

                  <FlexBox direction="column" gap={1}>
                    {menus?.length && (
                      <Typography variant="body2">
                        <b>{`${t("menu")}: `}</b>
                        {menus.map(getMenuLabel).join(", ")}
                      </Typography>
                    )}

                    {building?.cost !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("cost")}: `}</b>
                        {formatSimoleans(building.cost)}
                      </Typography>
                    )}

                    {building?.maintenance !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("maintenance")}: `}</b>
                        {formatSimoleans(building.maintenance)} / month
                      </Typography>
                    )}

                    {building?.bulldoze !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("bulldoze")}: `}</b>
                        {formatSimoleans(building.bulldoze)}
                      </Typography>
                    )}

                    {building?.capacity && (
                      <Typography variant="body2">
                        <b>{`${t("capacity")}: `}</b>
                        {Object.entries(building.capacity)
                          .reverse()
                          .map(([type, count]) => `${formatNumber(count)} ${type.toUpperCase()}`)
                          .join("; ")}
                      </Typography>
                    )}

                    {building?.jobs && (
                      <Typography variant="body2">
                        <b>{`${t("jobs")}: `}</b>
                        {Object.entries(building.jobs)
                          .reverse()
                          .map(([type, count]) => `${formatNumber(count)} ${type.toUpperCase()}`)
                          .join("; ")}
                      </Typography>
                    )}

                    {building?.relief && (
                      <Typography variant="body2">
                        <b>{`${t("relief")}: `}</b>
                        {Object.entries(building.relief)
                          .reverse()
                          .map(([type, count]) => `${formatNumber(count)} ${type.toUpperCase()}`)
                          .join("; ")}
                      </Typography>
                    )}

                    {building?.landmark !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("landmark")}: `}</b>
                        {t("overTiles", {
                          amount: formatNumber(building.landmark),
                          count: building.landmarkRadius ?? 0,
                        })}
                      </Typography>
                    )}

                    {building?.rating !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("rating")}: `}</b>
                        {t("overTiles", {
                          amount: formatNumber(building.rating),
                          count: building.ratingRadius ?? 0,
                        })}
                      </Typography>
                    )}

                    {building?.powerProduction !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("powerProduction")}: `}</b>
                        {formatNumber(building.powerProduction)}
                      </Typography>
                    )}

                    {building?.power !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("power")}: `}</b>
                        {formatNumber(building.power)}
                      </Typography>
                    )}

                    {building?.waterProduction !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("waterProduction")}: `}</b>
                        {formatNumber(building.waterProduction)}
                      </Typography>
                    )}

                    {building?.water !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("water")}: `}</b>
                        {formatNumber(building.water)}
                      </Typography>
                    )}

                    {building?.pollution !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("pollution")}: `}</b>
                        {t("overTiles", {
                          amount: formatNumber(building.pollution),
                          count: building.pollutionRadius ?? 0,
                        })}
                      </Typography>
                    )}

                    {building?.waterPollution !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("waterPollution")}: `}</b>
                        {t("overTiles", {
                          amount: formatNumber(building.waterPollution),
                          count: building.waterPollutionRadius ?? 0,
                        })}
                      </Typography>
                    )}

                    {building?.garbage !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("garbage")}: `}</b>
                        {t("overTiles", {
                          amount: formatNumber(building.garbage),
                          count: building.garbageRadius ?? 0,
                        })}
                      </Typography>
                    )}

                    {building?.radiation !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("radiation")}: `}</b>
                        {t("overTiles", {
                          amount: formatNumber(building.radiation),
                          count: building.radiationRadius ?? 0,
                        })}
                      </Typography>
                    )}

                    {building?.flamability !== undefined && (
                      <Typography variant="body2">
                        <b>{`${t("flamability")}: `}</b>
                        {formatNumber(building.flamability)}
                      </Typography>
                    )}
                  </FlexBox>
                </FlexBox>
                {lots.map((lot, index) => {
                  const tgi = lot.id.match(/^[a-f0-9]{8}$/)
                    ? `6534284a-a8fbd372-${lot.id}`
                    : undefined

                  return (
                    <Fragment key={lot.id}>
                      {(building || index > 0) && <Divider sx={{ marginY: 2 }} />}
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
                            {lot?.name && (
                              <Text maxLines={1} sx={{ flex: 1 }} variant="h6">
                                {lot.name}
                              </Text>
                            )}

                            {(lot.filename || tgi) && (
                              <FlexBox direction="row" gap={2}>
                                {lot.filename && (
                                  <Typography variant="body2">{lot.filename}</Typography>
                                )}
                                {tgi && lot.filename && <Typography variant="body2">|</Typography>}
                                {tgi && <Typography variant="body2">{tgi}</Typography>}
                              </FlexBox>
                            )}
                          </FlexBox>

                          {(lots.length !== 1 || !building) && (
                            <FlexBox alignSelf="start">
                              <Checkbox
                                icon={
                                  compatible.includes(lot.id) ? undefined : <IncompatibleIcon />
                                }
                                checked={enabled.includes(lot.id)}
                                color="primary"
                                disabled={!togglable.includes(lot.id)}
                                name={lot.id}
                                onClick={async event => {
                                  const { checked } = event.target as HTMLInputElement
                                  if (checked !== enabled.includes(lot.id)) {
                                    await actions.setPackageOption(
                                      packageId,
                                      option.id,
                                      toggle(enabledLots, lot.id),
                                    )
                                  }
                                }}
                                title={enabled ? t("excludeLot") : t("includeLot")}
                              />
                            </FlexBox>
                          )}
                        </FlexBox>

                        <FlexBox direction="column" gap={1}>
                          {!!lot.density?.length && (
                            <Typography variant="body2">
                              <b>{`${t("density")}: `}</b>
                              {lot.density
                                .map(density => t(density, { ns: "ZoneDensity" }))
                                .join(", ")}
                            </Typography>
                          )}

                          {lot.stage && (
                            <Typography variant="body2">
                              <b>{`${t("stage")}: `}</b>
                              {formatNumber(lot.stage)}
                            </Typography>
                          )}

                          {lot.size && (
                            <Typography variant="body2">
                              <b>{`${t("size")}: `}</b>
                              {lot.size}
                            </Typography>
                          )}

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
                    </Fragment>
                  )
                })}
              </CardContent>
            </Card>
          </ListItem>
        )
      })}
    </List>
  )
}
