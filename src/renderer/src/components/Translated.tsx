import { Link } from "@mui/material"
import type { Namespace, ParseKeys } from "i18next"
import { Trans } from "react-i18next"

const baseComponents = {
  b: <strong />,
  br: <br />,
  i: <em />,
  li: <li />,
  ol: <ol style={{ margin: 0, paddingInlineStart: "2rem" }} />,
  p: <p />,
  ul: <ul style={{ margin: 0, paddingInlineStart: "2rem" }} />,
}

export function Translated<
  Ns extends Namespace & string,
  Values extends Partial<Record<string, unknown>>,
>({
  link,
  ...props
}: {
  i18nKey: ParseKeys<Ns>
  link?: {
    description?: string
    onClick?: () => void
  }
  ns: Ns
  values?: Values
}) {
  return (
    <Trans
      components={{
        ...baseComponents,
        a: (
          <Link
            color="inherit"
            onClick={link?.onClick}
            sx={{ cursor: "pointer", fontWeight: "bold" }}
            title={link?.description}
            underline="hover"
          />
        ),
      }}
      {...props}
    />
  )
}
