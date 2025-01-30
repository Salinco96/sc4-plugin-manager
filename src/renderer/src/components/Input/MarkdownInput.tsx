import { Card, TextField, type TextFieldProps } from "@mui/material"
import { values } from "@salinco/nice-utils"
import type { ReactNode } from "react"

import { FlexRow } from "@components/FlexBox"
import { MarkdownView } from "@components/MarkdownView"
import { store } from "@stores/main"

export type MarkdownInputProps = Pick<TextFieldProps, "type"> & {
  label: ReactNode
  name: string
  onChange: (value: string | undefined) => void
  placeholder: string
  value: string | undefined
}

export function MarkdownInput({ onChange, value, ...props }: MarkdownInputProps): JSX.Element {
  const authors = store.useAuthors()

  return (
    <FlexRow alignItems="stretch">
      <TextField
        fullWidth
        multiline
        onBlur={event => {
          const value = event.target.value.trim()
          onChange(value || undefined)
        }}
        onChange={event => {
          const value = event.target.value.trimStart()
          onChange(value || undefined)
        }}
        size="small"
        InputProps={{
          sx: {
            alignItems: "start",
            borderBottomRightRadius: value?.trim() ? 0 : undefined,
            borderTopRightRadius: value?.trim() ? 0 : undefined,
            flex: "1 1 auto",
          },
        }}
        sx={{ flex: "3 3 0" }}
        value={value || ""}
        variant="outlined"
        {...props}
      />

      {value?.trim() && (
        <Card
          sx={{
            borderBottomLeftRadius: 0,
            borderTopLeftRadius: 0,
            borderLeftWidth: 0,
            flex: "2 2 0",
            padding: 2,
            paddingBottom: 0,
          }}
          variant="outlined"
        >
          <MarkdownView
            md={value.replace(
              // TODO: Move this into MarkdownView...
              /\[.+\][(](https:[/][/]community[.]simtropolis[.]com[/]profile[/][^)/]+[/])[)]/g,
              (match, url) => {
                const authorInfo = values(authors).find(authorInfo => authorInfo.url === url)
                if (authorInfo) {
                  return `[${authorInfo.name}](${url})`
                }

                return match
              },
            )}
          />
        </Card>
      )}
    </FlexRow>
  )
}
