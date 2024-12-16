import { Card, CardContent, List, ListItem } from "@mui/material"
import { collect, entries, mapValues, sortBy } from "@salinco/nice-utils"
import { useEffect, useMemo } from "react"

import { getTextureIdRange } from "@common/dbpf"
import { checkFile } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { Text } from "@components/Text"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useFeatures, useSettings, useStore } from "@utils/store"

import { ExemplarRef } from "../ExemplarRef"
import type { PackageViewTabInfoProps } from "./tabs"

export default function PackageViewTextures({ packageId }: PackageViewTabInfoProps): JSX.Element {
  const elementId = useStore(store => store.packageView.elementId)
  const features = useFeatures()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const settings = useSettings()

  const variantInfo = useCurrentVariant(packageId)

  useEffect(() => {
    if (elementId) {
      document.getElementById(elementId)?.scrollIntoView({ block: "center", inline: "center" })
    }
  }, [elementId])

  const textures = useMemo(() => {
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

    // Collect unique textures by ID
    return sortBy(
      collect(
        mapValues(
          entries(variantInfo.textures ?? {}).reduce(
            (result, [file, ids]) => {
              for (const id of ids) {
                result[id] ??= []
                result[id].push(file)
              }

              return result
            },
            {} as { [textureId in string]?: string[] },
          ),
          (files, textureId) => {
            if (files.length !== 1) {
              const included = files.filter(file => includedFiles.has(file))
              if (included.length === 1) {
                return included[0]
              }

              console.warn(`Duplicate texture ${textureId}`)
            }

            return files[0]
          },
        ),
        (file, textureId) => ({ file, id: textureId }),
      ),
      texture => texture.id,
    )
  }, [features, packageId, profileInfo, profileOptions, settings, variantInfo])

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {textures.map(texture => {
        return (
          <ListItem key={texture.id} sx={{ padding: 0 }}>
            <Card elevation={1} sx={{ display: "flex", width: "100%" }}>
              <CardContent sx={{ width: "100%" }}>
                <FlexBox id={`texture-${texture.id}`} direction="column" gap={2}>
                  <FlexBox alignItems="center">
                    <FlexBox direction="column" width="100%">
                      <FlexBox alignItems="center" gap={1} sx={{ flex: 1 }}>
                        <Text maxLines={1} variant="h6">
                          Texture
                        </Text>
                      </FlexBox>

                      <ExemplarRef file={texture.file} id={getTextureIdRange(texture.id)} />
                    </FlexBox>
                  </FlexBox>
                </FlexBox>
              </CardContent>
            </Card>
          </ListItem>
        )
      })}
    </List>
  )
}
