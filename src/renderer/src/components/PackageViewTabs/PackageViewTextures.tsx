import { Card, CardContent, List, ListItem } from "@mui/material"
import { collect, entries, mapValues, sortBy } from "@salinco/nice-utils"
import { useEffect, useMemo } from "react"

import { GroupID, TypeID, getTextureIdRange } from "@common/dbpf"
import { type PackageID, checkFile } from "@common/packages"
import { ExemplarRef } from "@components/ExemplarRef"
import { FlexCol, FlexRow } from "@components/FlexBox"
import { Text } from "@components/Text"
import { store } from "@stores/main"
import { ui } from "@stores/ui"
import { Page } from "@utils/navigation"

export default function PackageViewTextures({ packageId }: { packageId: PackageID }): JSX.Element {
  const elementId = ui.useStore(state => state.pages[Page.PackageView]?.elementId)

  const features = store.useFeatures()
  const profileInfo = store.useCurrentProfile()
  const profileOptions = store.useProfileOptions()
  const settings = store.useSettings()
  const variantInfo = store.useCurrentVariant(packageId)

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
                <FlexCol id={`texture-${texture.id}`} gap={2}>
                  <FlexRow centered>
                    <FlexCol fullWidth>
                      <FlexRow centered flex={1} gap={1}>
                        <Text maxLines={1} variant="h6">
                          Texture
                        </Text>
                      </FlexRow>

                      <ExemplarRef
                        file={texture.file}
                        group={GroupID.FSH_TEXTURE}
                        id={getTextureIdRange(texture.id)}
                        type={TypeID.FSH}
                      />
                    </FlexCol>
                  </FlexRow>
                </FlexCol>
              </CardContent>
            </Card>
          </ListItem>
        )
      })}
    </List>
  )
}
