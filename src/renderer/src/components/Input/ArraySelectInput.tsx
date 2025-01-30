import { Clear as ClearIcon } from "@mui/icons-material"
import { Autocomplete, IconButton, Link, TextField } from "@mui/material"
import { removeAt, replaceAt } from "@salinco/nice-utils"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { FlexCol, FlexRow } from "@components/FlexBox"

import type { SelectOption } from "./SelectInput"

export type ArraySelectInputProps<T extends string> = {
  error?: string
  label: ReactNode
  name: string
  onChange: (value: { id?: T; text?: string }[] | undefined) => void
  options: SelectOption<T>[]
  placeholders: { id: string; text: string }
  required?: boolean
  value: { id?: T; text?: string }[] | undefined
}

export function ArraySelectInput<T extends string>({
  // error,
  label,
  name,
  onChange,
  options,
  placeholders,
  required,
  value,
}: ArraySelectInputProps<T>): JSX.Element {
  const { t } = useTranslation("General")

  const items = value?.length ? value : [{}]
  const isEmpty = !items.some(item => item.id || item.text)

  return (
    <FlexCol fullWidth>
      {items?.map((item, index) => {
        const isFirst = index === 0
        const isLast = index === items.length - 1

        return (
          <FlexRow key={index}>
            <Autocomplete<SelectOption<T>, false, boolean>
              disablePortal
              fullWidth
              onChange={(_, option) => {
                if (option || item.text) {
                  onChange(replaceAt(items, index, { ...item, id: option?.value }))
                } else {
                  onChange(removeAt(items, index))
                }
              }}
              options={options}
              renderInput={inputProps => (
                <TextField
                  {...inputProps}
                  InputProps={{
                    ...inputProps.InputProps,
                    sx: {
                      borderBottomLeftRadius: isLast ? undefined : 0,
                      borderBottomRightRadius: 0,
                      borderTopLeftRadius: isFirst ? undefined : 0,
                      borderTopRightRadius: 0,
                      marginTop: isFirst ? undefined : "-1px",
                    },
                  }}
                  label={isFirst ? label : undefined}
                  name={name}
                  placeholder={placeholders.id}
                  required={isFirst && required}
                />
              )}
              size="small"
              sx={{ flex: "1 1 0" }}
              value={options.find(option => option.value === item.id) || null}
            />

            <TextField
              InputProps={{
                endAdornment: ((!isEmpty && !required) || items.length > 1) && (
                  <IconButton
                    onClick={() => {
                      if (item.id) {
                        onChange(replaceAt(items, index, { ...item, text: undefined }))
                      } else {
                        onChange(removeAt(items, index))
                      }
                    }}
                    size="small"
                  >
                    <ClearIcon fontSize="inherit" />
                  </IconButton>
                ),
                sx: {
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: isLast ? undefined : 0,
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: isFirst ? undefined : 0,
                  marginLeft: "-1px",
                  marginTop: isFirst ? undefined : "-1px",
                },
              }}
              fullWidth
              name={`${name}-${index}`}
              onBlur={event => {
                const newValue = event.target.value.trim()
                onChange(replaceAt(items, index, { ...item, text: newValue || undefined }))
              }}
              onChange={event => {
                const newValue = event.target.value.trimStart()
                onChange(replaceAt(items, index, { ...item, text: newValue || undefined }))
              }}
              placeholder={placeholders.text}
              size="small"
              sx={{ flex: "3 3 0" }}
              value={item.text || ""}
              variant="outlined"
            />
          </FlexRow>
        )
      })}

      {!isEmpty && (
        <Link
          fontSize={12}
          onClick={() => onChange([...items, {}])}
          sx={{ cursor: "pointer", ml: 1.5, mt: 0.5 }}
          tabIndex={0}
          underline="hover"
        >
          {t("addRow")}
        </Link>
      )}
    </FlexCol>
  )
}
