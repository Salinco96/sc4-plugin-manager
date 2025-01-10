import { Card, CardContent, Divider, List, ListItem } from "@mui/material"
import { forEach, get, groupBy, mapValues, sortBy, values } from "@salinco/nice-utils"
import { Fragment, useEffect, useMemo, useState } from "react"

import { TypeID } from "@common/dbpf"
import type { FamilyID, FamilyInfo } from "@common/families"
import { type PackageID, checkFile } from "@common/packages"
import type { PropID, PropInfo } from "@common/props"
import { ExemplarRef } from "@components/ExemplarRef"
import { FlexBox } from "@components/FlexBox"
import { Text } from "@components/Text"
import { Thumbnail } from "@components/Thumbnail"
import { ImageViewer } from "@components/Viewer/ImageViewer"
import { Page } from "@utils/navigation"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useFeatures, useSettings, useStore } from "@utils/store"

export default function PackageViewProps({ packageId }: { packageId: PackageID }): JSX.Element {
  const elementId = useStore(store => store.views[Page.PackageView]?.elementId)
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

    // Collect unique prop families by ID
    const propFamilies = mapValues(
      groupBy(variantInfo.propFamilies ?? [], get("id")),
      (families, familyId) => {
        if (families.length !== 1) {
          const included = families.filter(family => family.file && includedFiles.has(family.file))
          if (included.length === 1) {
            return included[0]
          }

          console.warn(`Duplicate prop family  ${familyId}`)
        }

        return families[0]
      },
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

    const groupedByFamily: {
      [id in FamilyID | PropID]?: { family?: FamilyInfo; familyId?: FamilyID; props: PropInfo[] }
    } = {}

    // Group props by family
    forEach(props, (prop, id) => {
      if (prop.families?.length) {
        for (const familyId of prop.families) {
          groupedByFamily[familyId] ??= { family: propFamilies[familyId], familyId, props: [] }
          groupedByFamily[familyId].props.push(prop)
        }
      } else {
        groupedByFamily[id] ??= { props: [] }
        groupedByFamily[id].props.push(prop)
      }
    })

    // Sort props within families
    forEach(groupedByFamily, group => {
      group.props = sortBy(group.props, prop => prop.name || prop.id)
    })

    // Sort families
    return [
      ...sortBy(
        values(groupedByFamily),
        group => group.familyId || group.props[0].name || group.props[0].id,
      ),
      ...sortBy(
        values(propFamilies)
          .filter(family => !groupedByFamily[family.id])
          .map(family => ({ family, familyId: family.id, props: [] })),
        group => group.familyId,
      ),
    ]
  }, [features, packageId, profileInfo, profileOptions, settings, variantInfo])

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {groupedProps.map(({ family, familyId, props }) => {
        return (
          <ListItem key={familyId ?? props[0].id} sx={{ padding: 0 }}>
            <Card elevation={1} sx={{ display: "flex", width: "100%" }}>
              <CardContent sx={{ width: "100%" }}>
                {familyId && (
                  <FlexBox direction="column" id={`propFamily-${familyId}`}>
                    <Text maxLines={1} variant="h6">
                      {family?.name ?? "Prop family"}
                    </Text>

                    <ExemplarRef file={family?.file} id={familyId} />
                  </FlexBox>
                )}

                {familyId && props.length === 0 && (
                  <>
                    <Divider sx={{ marginY: 2 }} />
                    <Text maxLines={1} sx={{ fontStyle: "italic" }} variant="body2">
                      This package does not include any props in this family.
                    </Text>
                  </>
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

                            <ExemplarRef
                              file={prop.file}
                              group={prop.group}
                              id={prop.id}
                              type={TypeID.EXEMPLAR}
                            />
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
