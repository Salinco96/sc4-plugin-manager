import { Clear as ClearIcon } from "@mui/icons-material"
import { IconButton, TextField } from "@mui/material"
import type { ReactNode } from "react"

export type TextInputProps = {
  error?: string
  label: ReactNode
  name: string
  onChange: (value: string | undefined) => void
  placeholder: string
  required?: boolean
  type?: "url" | "version"
  value: string | undefined
}

const VERSION_REGEX = /^([1-9][0-9]*|0?)([.]([1-9][0-9]*|0?)){0,2}/g
const URL_PREFIX = "https://"

export function TextInput({
  error,
  onChange,
  required,
  type,
  value,
  ...props
}: TextInputProps): JSX.Element {
  const allowWhitespace = type !== "url"
  const pattern = type === "version" ? VERSION_REGEX : undefined
  const prefix = type === "url" ? URL_PREFIX : undefined

  return (
    <TextField
      InputProps={{
        endAdornment: !required && value && (
          <IconButton onClick={() => onChange(undefined)} size="small">
            <ClearIcon fontSize="inherit" />
          </IconButton>
        ),
      }}
      error={!!error}
      fullWidth
      helperText={error}
      onBlur={event => {
        const newValue = event.target.value.trim()
        onChange(newValue || undefined)
      }}
      onChange={event => {
        let newValue = event.target.value[allowWhitespace ? "trim" : "trimStart"]()

        if (pattern) {
          newValue = newValue.match(pattern)?.[0] ?? ""
        }

        if (prefix && newValue === prefix) {
          onChange(undefined)
        } else if (prefix && newValue && !newValue.startsWith(prefix)) {
          onChange(prefix + newValue)
        } else {
          onChange(newValue || undefined)
        }
      }}
      required={required}
      size="small"
      type={type}
      value={value || ""}
      variant="outlined"
      {...props}
    />
  )
}
