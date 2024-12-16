import { Typography } from "@mui/material"
import { isString } from "@salinco/nice-utils"

import { FlexBox } from "@components/FlexBox"

export interface ExemplarRefProps {
  file?: string
  id: string | [start: string, end: string]
}

export function ExemplarRef({ file, id }: ExemplarRefProps): JSX.Element {
  const idMin = isString(id) ? id : id[0]
  const idMax = isString(id) ? id : id[1]

  return (
    <FlexBox>
      {file && (
        <>
          <Typography variant="body2">{file}</Typography>
          <Typography mx={2} variant="body2">
            |
          </Typography>
        </>
      )}
      <Typography
        onClick={() => navigator.clipboard.writeText(idMin)}
        sx={{
          cursor: "copy",
          "&:hover": {
            textDecoration: "underline",
            textDecorationColor: "#888",
            textDecorationStyle: "dotted",
            textUnderlineOffset: 2,
          },
        }}
        title="Click to copy"
        variant="body2"
      >
        {idMin}
      </Typography>
      {idMin !== idMax && (
        <>
          <Typography mx={1} variant="body2">
            ...
          </Typography>
          <Typography
            onClick={() => navigator.clipboard.writeText(idMax)}
            sx={{
              cursor: "copy",
              "&:hover": {
                textDecoration: "underline",
                textDecorationColor: "#888",
                textDecorationStyle: "dotted",
                textUnderlineOffset: 2,
              },
            }}
            title="Click to copy"
            variant="body2"
          >
            {idMax}
          </Typography>
        </>
      )}
    </FlexBox>
  )
}
