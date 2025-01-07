import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { CreateVariantModal } from "@components/CreateVariantModal"
import { FlexBox } from "@components/FlexBox"
import { PackageBanners } from "@components/PackageBanners/PackageBanners"
import { PackageTools } from "@components/PackageTools"
import { PackageTags } from "@components/Tags/PackageTags"
import { Text } from "@components/Text"
import { Thumbnail } from "@components/Thumbnail"
import { VariantActions } from "@components/VariantActions"
import { ImageViewer } from "@components/Viewer/ImageViewer"
import { Button, Card, CardActions, CardContent, List } from "@mui/material"
import { collect } from "@salinco/nice-utils"
import { usePackageInfo } from "@utils/packages"
import { useState } from "react"
import { useTranslation } from "react-i18next"

export default function PackageViewVariants({ packageId }: { packageId: PackageID }): JSX.Element {
  const packageInfo = usePackageInfo(packageId)

  const [openImages, setOpenImages] = useState<VariantID>()
  const [openCreateModal, setOpenCreateModal] = useState(false)

  const { t } = useTranslation("PackageViewVariants")

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {collect(packageInfo.variants, (variantInfo, variantId) => (
        <Card elevation={1} key={variantId} sx={{ display: "flex" }}>
          <CardContent sx={{ flexGrow: 1, overflow: "hidden" /* TODO: Overflowing tags */ }}>
            {!!variantInfo.images?.length && (
              <ImageViewer
                images={variantInfo.images}
                onClose={() => setOpenImages(undefined)}
                open={openImages === variantId}
              />
            )}
            <FlexBox direction="row">
              {variantInfo.thumbnail && (
                <Thumbnail
                  disabled={!variantInfo.images?.length}
                  mr={2}
                  mt={1}
                  size={84}
                  onClick={() => setOpenImages(variantId)}
                  src={variantInfo.thumbnail}
                />
              )}
              <FlexBox direction="column">
                <Text maxLines={1} variant="h6">
                  {variantInfo.name ?? variantInfo.id} (v{variantInfo.version})
                </Text>
                <FlexBox alignItems="center">
                  <Text maxLines={1} variant="body2">
                    {packageId}#{variantId}
                  </Text>
                  <PackageTools packageId={packageId} variantId={variantId} />
                </FlexBox>
                <PackageTags packageId={packageId} variantId={variantId} />
              </FlexBox>
            </FlexBox>
            {variantInfo.description && (
              <Text
                maxLines={2}
                sx={{ height: 40, marginTop: 2 }}
                title={variantInfo.description}
                variant="body2"
              >
                {variantInfo.description}
              </Text>
            )}
            <PackageBanners packageId={packageId} variantId={variantId} />
          </CardContent>
          <CardActions sx={{ padding: 2 }}>
            <VariantActions packageId={packageId} variantId={variantId} />
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
