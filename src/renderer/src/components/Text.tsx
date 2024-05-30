import { styled, Typography } from "@mui/material"

export const Text = styled(Typography)<{ maxLines: number }>`
  display: -webkit-box;
  overflow: hidden;
  padding: 0;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: ${({ maxLines }) => maxLines};
`
