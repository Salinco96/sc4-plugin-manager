import { Trans } from "react-i18next"

import { PackageWarning } from "@common/types"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerWarning({ warning }: { warning: PackageWarning }): JSX.Element {
  return (
    <PackageBanner>
      {warning.message ?? (
        <Trans
          components={{ b: <strong /> }}
          defaultValue={warning.id}
          i18nKey={`${warning.on ?? "enable"}.${warning.id ?? "bulldoze"}`}
          ns="Warning"
        />
      )}
    </PackageBanner>
  )
}
