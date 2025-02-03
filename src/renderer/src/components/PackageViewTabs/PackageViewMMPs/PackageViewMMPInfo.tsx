import { Card, CardContent, Divider, ListItem, Typography } from "@mui/material"
import { Fragment, useEffect, useState } from "react"

import { GroupID, type TGI, TypeID } from "@common/dbpf"
import type { FloraInfo } from "@common/mmps"
import { type PackageID, checkFile } from "@common/packages"
import { VariantState } from "@common/types"
import { ExemplarRef } from "@components/ExemplarRef"
import { FlexCol, FlexRow } from "@components/FlexBox"
import { Tag } from "@components/Tags/Tag"
import { TagType } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { ImageViewerThumbnail } from "@components/Viewer/ImageViewerThumbnail"
import { loadVariantFileEntry } from "@stores/actions"
import { store } from "@stores/main"
import { useEffectEvent } from "@utils/useEffectEvent"

export interface PackageViewMMPInfoProps {
  mmp: FloraInfo
  packageId: PackageID
}

const iconSize = 44

export function PackageViewMMPInfo({ mmp, packageId }: PackageViewMMPInfoProps): JSX.Element {
  const features = store.useFeatures()
  const profileInfo = store.useCurrentProfile()
  const profileOptions = store.useProfileOptions()
  const settings = store.useSettings()
  const variantInfo = store.useCurrentVariant(packageId)

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
      const entryId: TGI = `${TypeID.PNG}-${GroupID.PNG_MENU_ICONS}-${mmp.id}`
      const entry = await loadVariantFileEntry(packageId, variantInfo.id, mmp.file, entryId)
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
          <FlexRow centered>
            <ImageViewerThumbnail
              images={images}
              mr={2}
              mt={1}
              size={mmp.images?.length ? 84 : iconSize}
            />

            <FlexCol fullWidth>
              <FlexRow centered flex={1} gap={1}>
                <Text maxLines={1} variant="h6">
                  {mmp.label ?? mmp.name ?? "MMP"}
                </Text>
                {isPatched && (
                  <Tag dense tag={{ type: TagType.STATE, value: VariantState.PATCHED }} />
                )}
              </FlexRow>

              <ExemplarRef file={mmp.file} group={mmp.group} id={mmp.id} type={TypeID.EXEMPLAR} />
            </FlexCol>
          </FlexRow>

          <FlexCol gap={1}>
            {mmp.description && (
              <Typography fontStyle="italic" variant="body2" whiteSpace="pre">
                {mmp.description}
              </Typography>
            )}
          </FlexCol>

          {mmp.stages?.map(stage => (
            <Fragment key={stage.id}>
              <Divider sx={{ marginY: 2 }} />

              <FlexCol fullWidth id={`mmp-${stage.id}`}>
                {stage.name && (
                  <FlexRow centered flex={1} gap={1}>
                    <Text maxLines={1} variant="h6">
                      {stage.name ?? "MMP"}
                    </Text>
                  </FlexRow>
                )}

                <ExemplarRef file={mmp.file} id={stage.id} />
              </FlexCol>
            </Fragment>
          ))}
        </CardContent>
      </Card>
    </ListItem>
  )
}
