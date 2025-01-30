import { Clear as ClearIcon } from "@mui/icons-material"
import { IconButton, Link, TextField } from "@mui/material"
import { removeAt, replaceAt } from "@salinco/nice-utils"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { FlexCol } from "@components/FlexBox"

export type ArrayInputProps = {
  error?: string
  label: ReactNode
  name: string
  onChange: (value: string[] | undefined) => void
  placeholder: string
  required?: boolean
  value: string[] | undefined
}

export function ArrayInput({
  error,
  label,
  name,
  onChange,
  required,
  value,
  ...props
}: ArrayInputProps): JSX.Element {
  const { t } = useTranslation("General")

  const items = value?.length ? value : [""]
  const isEmpty = !items.some(Boolean)

  return (
    <FlexCol fullWidth>
      {items?.map((item, index) => {
        const isFirst = index === 0
        const isLast = index === items.length - 1

        return (
          <TextField
            {...props}
            InputProps={{
              endAdornment: ((!isEmpty && !required) || items.length > 1) && (
                <IconButton onClick={() => onChange(removeAt(items, index))} size="small">
                  <ClearIcon fontSize="inherit" />
                </IconButton>
              ),
              sx: {
                borderBottomLeftRadius: isLast ? undefined : 0,
                borderBottomRightRadius: isLast ? undefined : 0,
                borderTopLeftRadius: isFirst ? undefined : 0,
                borderTopRightRadius: isFirst ? undefined : 0,
                marginTop: isFirst ? undefined : "-1px",
              },
            }}
            fullWidth
            key={index}
            label={isFirst ? label : undefined}
            name={`${name}-${index}`}
            onBlur={event => {
              const newValue = event.target.value.trim()
              onChange(replaceAt(items, index, newValue))
            }}
            onChange={event => {
              const newValue = event.target.value.trimStart()
              onChange(replaceAt(items, index, newValue))
            }}
            required={isFirst && required}
            size="small"
            value={item}
            variant="outlined"
          />
        )
      })}

      {!isEmpty && (
        <Link
          display="flex"
          alignItems="center"
          fontSize={12}
          onClick={() => onChange([...items, ""])}
          sx={{ cursor: "pointer", ml: 1.5, mt: 0.5 }}
          underline="hover"
        >
          {t("addRow")}
        </Link>
      )}
    </FlexCol>
  )
}
