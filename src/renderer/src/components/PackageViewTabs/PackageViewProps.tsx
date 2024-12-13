import { Card, CardContent, Divider, List, ListItem } from "@mui/material"
import { get, groupBy, mapValues, sortBy, values } from "@salinco/nice-utils"
import { Fragment, useEffect, useMemo, useState } from "react"

import { FlexBox } from "@components/FlexBox"
import { Text } from "@components/Text"
import { Thumbnail } from "@components/Thumbnail"
import { ImageViewer } from "@components/Viewer/ImageViewer"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useFeatures, useSettings, useStore } from "@utils/store"

import { checkFile } from "@common/packages"
import { ExemplarRef } from "../ExemplarRef"
import type { PackageViewTabInfoProps } from "./tabs"

export default function PackageViewProps({ packageId }: PackageViewTabInfoProps): JSX.Element {
  const elementId = useStore(store => store.packageView.elementId)
  const features = useFeatures()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const settings = useSettings()

  const variantInfo = useCurrentVariant(packageId)

  const [openImages, setOpenImages] = useState<string>()

  useEffect(() => {
    if (elementId) {
      document.getElementById(elementId)?.scrollIntoView({ block: "center", inline: "center" })
    }
  }, [elementId])

  const groupedProps = useMemo(() => {
    const includedFiles = new Set(
      variantInfo.files
        ?.filter(file =>
          checkFile(
            file,
            packageId,
            variantInfo,
            profileInfo,
            profileOptions,
            features,
            settings,
            undefined,
            true,
          ),
        )
        .map(file => file.path),
    )

    // Collect unique props by ID
    const props = mapValues(groupBy(variantInfo.props ?? [], get("id")), (props, propId) => {
      if (props.length !== 1) {
        const included = props.filter(prop => includedFiles.has(prop.file))
        if (included.length === 1) {
          return included[0]
        }

        console.warn(`Duplicate prop ${propId}`)
      }

      return props[0]
    })

    // Group props by family
    return sortBy(
      values(groupBy(values(props), prop => prop.family ?? prop.id)).map(props =>
        sortBy(props, prop => prop.name || prop.id),
      ),
      props => (props.length > 1 && props[0].family) || props[0].name || props[0].id,
    )
  }, [features, packageId, profileInfo, profileOptions, settings, variantInfo])

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {groupedProps.map(props => {
        const familyId = props.length > 1 ? props[0].family : undefined
        const familyName = "Prop family" // TODO: Get family name

        return (
          <ListItem key={familyId ?? props[0].id} sx={{ padding: 0 }}>
            <Card elevation={1} sx={{ display: "flex", width: "100%" }}>
              <CardContent sx={{ width: "100%" }}>
                {familyId && (
                  <FlexBox direction="column" id={`propFamily-${familyId}`}>
                    <Text maxLines={1} variant="h6">
                      {familyName}
                    </Text>

                    <ExemplarRef /* file={prop.file} */ id={familyId} />
                  </FlexBox>
                )}

                {props.map((prop, index) => {
                  return (
                    <Fragment key={prop.id}>
                      {(familyId || index > 0) && <Divider sx={{ marginY: 2 }} />}
                      <FlexBox id={`prop-${prop.id}`} direction="column" gap={2}>
                        <FlexBox alignItems="center">
                          {!!prop.images?.length && (
                            <>
                              <ImageViewer
                                images={prop.images}
                                onClose={() => setOpenImages(undefined)}
                                open={openImages === prop.id}
                              />
                              <Thumbnail
                                mr={2}
                                mt={1}
                                onClick={() => setOpenImages(prop.id)}
                                size={84}
                                src={prop.images[0]}
                              />
                            </>
                          )}

                          <FlexBox direction="column" width="100%">
                            <FlexBox alignItems="center" gap={1} sx={{ flex: 1 }}>
                              <Text maxLines={1} variant="h6">
                                {prop.name ?? "Prop"}
                              </Text>
                            </FlexBox>

                            <ExemplarRef file={prop.file} id={prop.id} />
                          </FlexBox>
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
