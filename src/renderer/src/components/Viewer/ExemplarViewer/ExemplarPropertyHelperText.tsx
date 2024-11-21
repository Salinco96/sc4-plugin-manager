import { FormHelperText, Link } from "@mui/material"

import type { ExemplarProperty, ExemplarPropertyValue } from "@common/exemplars"

import { formatValue, useExemplarPropertyInfo } from "./utils"

export interface ExemplarPropertyHelperTextProps {
  error: string | undefined
  onChange: (newValue: ExemplarPropertyValue | null) => void
  original: ExemplarPropertyValue | null | undefined
  property: ExemplarProperty
  readonly: boolean
}

export function ExemplarPropertyHelperText({
  error,
  onChange,
  original,
  property,
  readonly,
}: ExemplarPropertyHelperTextProps): JSX.Element {
  const info = useExemplarPropertyInfo(property.id)

  return (
    <FormHelperText sx={{ marginBottom: 2 }} error={!!error}>
      {error}
      {original !== undefined && !error && (
        <>
          {original === null
            ? "New property"
            : `Original: ${formatValue(original, property, info)}`}
          {!readonly && (
            <Link
              component="button"
              onClick={() => onChange(original)}
              sx={{ paddingLeft: 0.5 }}
              title={original === null ? "Remove this property" : "Reset to initial value"}
            >
              {original === null ? "Remove" : "Reset"}
            </Link>
          )}
        </>
      )}
    </FormHelperText>
  )
}
