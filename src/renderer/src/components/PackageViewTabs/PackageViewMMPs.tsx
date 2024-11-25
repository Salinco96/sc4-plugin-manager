import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
import { Card, CardContent, Checkbox, List, ListItem, Typography } from "@mui/material"
import { entries, remove } from "@salinco/nice-utils"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { getCategories } from "@common/categories"
import { getOptionValue, getRequirementLabel, getRequirementValueLabel } from "@common/options"
import { MMPS_OPTION_ID, checkCondition } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { MarkdownView } from "@components/MarkdownView"
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

export default function PackageViewMMPs({ packageId }: PackageViewTabInfoProps): JSX.Element {
  const actions = useStoreActions()
  const features = useFeatures()
  const settings = useSettings()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const packageConfig = profileInfo?.packages[packageId]
  const variantInfo = useCurrentVariant(packageId)

  const [openImages, setOpenImages] = useState<string>()

  const { t } = useTranslation("PackageViewMMPs")

  const option = variantInfo.options?.find(option => option.id === MMPS_OPTION_ID)
  if (!option) {
    return <></>
  }

  const enabledMMPs = getOptionValue(option, {
    ...packageConfig?.options,
    ...profileInfo?.options,
  }) as string[]

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo.mmps?.map(mmp => {
        const enabled = !mmp.filename || enabledMMPs.includes(mmp.id)

        const incompatible = !checkCondition(
          mmp.requirements,
          packageId,
          variantInfo,
          profileInfo,
          profileOptions,
          features,
          settings,
        )

        const categories = mmp.categories ?? getCategories(variantInfo)
        const tags = categories.map(category => createTag(TagType.CATEGORY, category))

        const tgi = mmp.id.match(/^[a-f0-9]{8}$/) ? `6534284a - e83e0437 - ${mmp.id}` : undefined

        return (
          <ListItem key={mmp.id} sx={{ padding: 0 }}>
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
                    {!!mmp.images?.length && (
                      <>
                        <ImageViewer
                          images={mmp.images}
                          onClose={() => setOpenImages(undefined)}
                          open={openImages === mmp.id}
                        />
                        <Thumbnail
                          mr={2}
                          mt={1}
                          onClick={() => setOpenImages(mmp.id)}
                          size={84}
                          src={mmp.images[0]}
                        />
                      </>
                    )}
                    <FlexBox direction="column" width="100%">
                      <Text maxLines={1} sx={{ flex: 1 }} variant="h6">
                        {mmp.label}
                      </Text>

                      {(mmp.filename || tgi) && (
                        <FlexBox direction="row" gap={2}>
                          {mmp.filename && <Typography variant="body2">{mmp.filename}</Typography>}
                          {tgi && mmp.filename && <Typography variant="body2">|</Typography>}
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
                        disabled={!mmp.filename || incompatible}
                        // name={option.id}
                        onClick={async event => {
                          const { checked } = event.target as HTMLInputElement
                          if (mmp.filename && checked !== enabled) {
                            await actions.setPackageOption(
                              packageId,
                              option.id,
                              enabled ? remove(enabledMMPs, mmp.id) : [...enabledMMPs, mmp.id],
                            )
                          }
                        }}
                        title={enabled ? t("excludeMMP") : t("includeMMP")}
                      />
                    </FlexBox>
                  </FlexBox>

                  {mmp.description && (
                    <Typography component="div" variant="body2">
                      <MarkdownView md={mmp.description} />
                    </Typography>
                  )}

                  {/* TODO: Better formatting */}
                  {mmp.requirements && (
                    <Typography variant="body2">
                      <b>{`${t("requirements")}: `}</b>
                      <ul>
                        {entries(mmp.requirements).map(([requirement, value]) => (
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
                    </Typography>
                  )}
                </FlexBox>
              </CardContent>
            </Card>
          </ListItem>
        )
      })}
    </List>
  )
}
