import { Typography, styled } from "@mui/material"

export const Text = styled(Typography, {
  shouldForwardProp(propName) {
    return propName !== "maxLines"
  },
})<{ maxLines?: number }>(({ maxLines }) => {
  if (maxLines) {
    return {
      display: "-webkit-box",
      overflow: "hidden",
      padding: 0,
      textOverflow: "ellipsis",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: maxLines,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    }
  }

  return {}
})
