import { FormHelperText, Link } from "@mui/material"

import type { ExemplarProperty, ExemplarPropertyValue } from "@common/exemplars"

import { formatValue } from "./utils"

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
  return (
    <FormHelperText sx={{ marginBottom: 2 }} error={!!error}>
      {error}
      {original !== undefined && !error && (
        <>
          Original: {formatValue(original, property)}
          {!readonly && (
            <Link
              component="button"
              onClick={() => onChange(original)}
              sx={{ paddingLeft: 0.5 }}
              title="Reset to initial value"
            >
              Reset
            </Link>
          )}
        </>
      )}
    </FormHelperText>
  )
}
