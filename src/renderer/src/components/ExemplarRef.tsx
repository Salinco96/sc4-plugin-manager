import { Typography } from "@mui/material"
import { isString } from "@salinco/nice-utils"

import type { GroupID, InstanceID, TypeID } from "@common/dbpf"
import { FlexBox } from "@components/FlexBox"

export interface ExemplarRefProps {
  file?: string
  group?: GroupID
  id: InstanceID | [InstanceID, InstanceID]
  type?: TypeID
}

export function ExemplarRef({ file, group, id, type }: ExemplarRefProps): JSX.Element {
  const idMin = isString(id) ? id : id[0]
  const idMax = isString(id) ? id : id[1]

  return (
    <FlexBox>
      {file && (
        <>
          <Typography title={file} variant="body2">
            {file.replace(/^.*[/]/, "")}
          </Typography>
          <Typography mx={2} variant="body2">
            |
          </Typography>
        </>
      )}

      {group && type && (
        <>
          <Typography
            onClick={() => navigator.clipboard.writeText(type)}
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
            {type}
          </Typography>
          <Typography mx={0.5} variant="body2">
            -
          </Typography>
          <Typography
            onClick={() => navigator.clipboard.writeText(group)}
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
            {group}
          </Typography>
          <Typography mx={0.5} variant="body2">
            -
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
