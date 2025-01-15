import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { CreateVariantModal } from "@components/CreateVariantModal"
import { FlexCol, FlexRow } from "@components/FlexBox"
import { PackageBanners } from "@components/PackageBanners/PackageBanners"
import { PackageTools } from "@components/PackageTools"
import { VariantTags } from "@components/Tags/VariantTags"
import { Text } from "@components/Text"
import { Thumbnail } from "@components/Thumbnail"
import { VariantActions } from "@components/VariantActions"
import { ImageViewer } from "@components/Viewer/ImageViewer"
import { Button, Card, CardActions, CardContent, List } from "@mui/material"
import { getOrderedVariants, usePackageInfo } from "@utils/packages"
import { useState } from "react"
import { useTranslation } from "react-i18next"

export default function PackageViewVariants({ packageId }: { packageId: PackageID }): JSX.Element {
  const packageInfo = usePackageInfo(packageId)

  const [openImages, setOpenImages] = useState<VariantID>()
  const [openCreateModal, setOpenCreateModal] = useState(false)

  const { t } = useTranslation("PackageViewVariants")

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {getOrderedVariants(packageInfo).map(variant => (
        <Card elevation={1} key={variant.id} sx={{ display: "flex" }}>
          <CardContent sx={{ flexGrow: 1, overflow: "hidden" }}>
            {!!variant.images?.length && (
              <ImageViewer
                images={variant.images}
                onClose={() => setOpenImages(undefined)}
                open={openImages === variant.id}
              />
            )}

            <FlexRow>
              {variant.thumbnail && (
                <Thumbnail
                  disabled={!variant.images?.length}
                  mr={2}
                  mt={1}
                  size={84}
                  onClick={() => setOpenImages(variant.id)}
                  src={variant.thumbnail}
                />
              )}

              <FlexCol>
                <Text maxLines={1} variant="h6">
                  {variant.name ?? variant.id} ({variant.version})
                </Text>

                <FlexRow centered>
                  <Text maxLines={1} variant="body2">
                    {packageId}#{variant.id}
                  </Text>
                  <PackageTools packageId={packageId} variantId={variant.id} />
                </FlexRow>

                <VariantTags packageId={packageId} variantId={variant.id} />
              </FlexCol>
            </FlexRow>

            {variant.description && (
              <Text
                maxLines={2}
                sx={{ height: 40, marginTop: 2 }}
                title={variant.description}
                variant="body2"
              >
                {variant.description}
              </Text>
            )}

            <PackageBanners packageId={packageId} variantId={variant.id} />
          </CardContent>

          <CardActions sx={{ padding: 2 }}>
            <VariantActions packageId={packageId} variantId={variant.id} />
          </CardActions>
        </Card>
      ))}

      <Button
        color="primary"
        onClick={() => setOpenCreateModal(true)}
        sx={{ display: "flex" }}
        title={t("actions.create.description")}
        variant="outlined"
      >
        {t("actions.create.label")}
      </Button>

      <CreateVariantModal
        onClose={() => setOpenCreateModal(false)}
        open={openCreateModal}
        packageId={packageId}
      />
    </List>
  )
}
