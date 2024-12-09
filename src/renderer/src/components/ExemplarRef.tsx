import { Typography } from "@mui/material"

import { FlexBox } from "@components/FlexBox"

export interface ExemplarRefProps {
  file?: string
  id: string
}

export function ExemplarRef({ file, id }: ExemplarRefProps): JSX.Element {
  return (
    <FlexBox direction="row" gap={2}>
      {file && <Typography variant="body2">{file}</Typography>}
      {file && <Typography variant="body2">|</Typography>}
      <Typography
        onClick={() => navigator.clipboard.writeText(id)}
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
        {id}
      </Typography>
    </FlexBox>
  )
}
