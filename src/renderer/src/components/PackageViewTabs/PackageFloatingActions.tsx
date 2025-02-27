import type { PackageID } from "@common/packages"
import { FloatingActions } from "@components/FloatingActions"
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Sync as RegenerateIcon,
  Save as SaveIcon,
} from "@mui/icons-material"
import { editVariant, refreshLocalVariant } from "@stores/actions"
import { store } from "@stores/main"
import { usePageState } from "@stores/ui"
import { Page } from "@utils/navigation"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { getFinalData } from "./PackageViewSummary/utils"

export function PackageFloatingActions({
  packageId,
}: {
  packageId: PackageID
}): JSX.Element {
  const variantInfo = store.useCurrentVariant(packageId)
  const db = store.useDatabaseSettings()

  const [{ activeTab, editorVariantInfo }, setPageState] = usePageState(Page.PackageView)

  const { t } = useTranslation("PackageViewSummary")

  const isLocal = !!variantInfo.local
  const isEditable = activeTab === "summary" && (isLocal || !!db?.local)
  const isEditing = isEditable && editorVariantInfo?.id === variantInfo.id

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset state when variant changes
  useEffect(() => {
    return () => setPageState({ editorVariantInfo: undefined })
  }, [variantInfo.id])

  return (
    <FloatingActions
      actions={[
        isEditing && {
          description: t("actions.apply.description"),
          icon: SaveIcon,
          id: "apply",
          onClick: async () => {
            if (await editVariant(packageId, variantInfo.id, getFinalData(editorVariantInfo))) {
              setPageState({ editorVariantInfo: undefined })
            }
          },
        },
        isEditing && {
          color: "error",
          description: t("actions.cancel.description"),
          icon: CloseIcon,
          id: "cancel",
          onClick: () => setPageState({ editorVariantInfo: undefined }),
        },
        isEditable &&
          !isEditing && {
            description: t("actions.edit.description"),
            icon: EditIcon,
            id: "edit",
            onClick: () => setPageState({ editorVariantInfo: variantInfo }),
          },
        isLocal &&
          !isEditing && {
            description: t("actions.regenerate.description"),
            icon: RegenerateIcon,
            id: "regenerate",
            onClick: () => refreshLocalVariant(packageId, variantInfo.id),
          },
      ]}
    />
  )
}
