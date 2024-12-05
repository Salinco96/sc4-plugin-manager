import { Card, CardContent, Divider, ListItem, Typography } from "@mui/material"
import { Fragment, useEffect, useState } from "react"

import { DBPFFileType, type TGI } from "@common/dbpf"
import type { FloraInfo } from "@common/mmps"
import { type PackageID, checkFile } from "@common/packages"
import { VariantState } from "@common/types"
import { ExemplarRef } from "@components/ExemplarRef"
import { FlexBox } from "@components/FlexBox"
import { PackageTag } from "@components/Tags/PackageTag"
import { type Tag, TagType, serializeTag } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { ImageViewerThumbnail } from "@components/Viewer/ImageViewerThumbnail"
import { useCurrentVariant } from "@utils/packages"
import {
  useCurrentProfile,
  useFeatures,
  useSettings,
  useStore,
  useStoreActions,
} from "@utils/store"
import { useEffectEvent } from "@utils/useEffectEvent"

export interface PackageViewMMPInfoProps {
  mmp: FloraInfo
  packageId: PackageID
}

const iconSize = 44

export function PackageViewMMPInfo({ mmp, packageId }: PackageViewMMPInfoProps): JSX.Element {
  const actions = useStoreActions()
  const features = useFeatures()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const settings = useSettings()
  const variantInfo = useCurrentVariant(packageId)

  const fileInfo = variantInfo.files?.find(file => file.path === mmp.file)

  const isDisabled =
    !!fileInfo &&
    !checkFile(
      fileInfo,
      packageId,
      variantInfo,
      profileInfo,
      profileOptions,
      features,
      settings,
      undefined,
      true,
    )

  const isPatched = !!fileInfo?.patches // TODO: Check entry, not whole file!

  const [icons, setIcons] = useState<string[]>()

  const loadIcon = useEffectEvent(async () => {
    try {
      const entryId: TGI = `${DBPFFileType.PNG_MENU_ICONS}-${mmp.id}`
      const entry = await actions.loadDBPFEntry(packageId, variantInfo.id, mmp.file, entryId)
      if (entry.data && "base64" in entry.data) {
        const image = document.createElement("img")

        image.onload = () => {
          const canvas = document.createElement("canvas")
          const context = canvas.getContext("2d")
          if (context) {
            canvas.height = iconSize
            canvas.width = iconSize
            setIcons(
              [3, 2, 1, 0].map(index => {
                context.drawImage(image, -index * iconSize, 0)
                return canvas.toDataURL()
              }),
            )
          }
        }

        image.src = `data:image/${entry.type};base64, ${entry.data.base64}`
      }
    } catch (error) {
      if (error instanceof Error && error.message.match(/missing entry/i)) {
        setIcons(undefined)
      } else {
        console.error(error)
      }
    }
  })

  useEffect(() => {
    if (fileInfo) {
      loadIcon()
    }
  }, [fileInfo, loadIcon])

  const images = mmp.images?.length ? mmp.images : (icons ?? [])

  const tags: Tag[] = [] // todo

  return (
    <ListItem sx={{ padding: 0 }}>
      <Card
        elevation={1}
        id={`mmp-${mmp.id}`}
        sx={{
          color: isDisabled ? "rgba(0, 0, 0, 0.36)" : undefined,
          display: "flex",
          width: "100%",
        }}
      >
        <CardContent sx={{ width: "100%" }}>
          <FlexBox alignItems="center">
            <ImageViewerThumbnail
              images={images}
              mr={2}
              mt={1}
              size={mmp.images?.length ? 84 : iconSize}
            />

            <FlexBox direction="column" width="100%">
              <FlexBox alignItems="center" gap={1} sx={{ flex: 1 }}>
                <Text maxLines={1} variant="h6">
                  {mmp.label ?? mmp.name ?? "MMP"}
                </Text>
                {isPatched && (
                  <PackageTag dense type={TagType.STATE} value={VariantState.PATCHED} />
                )}
              </FlexBox>

              <ExemplarRef file={mmp.file} id={mmp.id} />

              {!!tags?.length && (
                <FlexBox direction="row" gap={1} mt={1}>
                  {tags.map(tag => (
                    <PackageTag key={serializeTag(tag.type, tag.value)} {...tag} />
                  ))}
                </FlexBox>
              )}
            </FlexBox>
          </FlexBox>

          <FlexBox direction="column" gap={1}>
            {mmp.description && (
              <Typography sx={{ fontStyle: "italic", whiteSpace: "pre" }} variant="body2">
                {mmp.description}
              </Typography>
            )}
          </FlexBox>

          {mmp.stages?.map(stage => (
            <Fragment key={stage.id}>
              <Divider sx={{ marginY: 2 }} />

              <FlexBox direction="column" id={`mmp-${stage.id}`} width="100%">
                {stage.name && (
                  <FlexBox alignItems="center" gap={1} sx={{ flex: 1 }}>
                    <Text maxLines={1} variant="h6">
                      {stage.name ?? "MMP"}
                    </Text>
                  </FlexBox>
                )}

                <ExemplarRef file={mmp.file} id={stage.id} />
              </FlexBox>
            </Fragment>
          ))}
        </CardContent>
      </Card>
    </ListItem>
  )
}
