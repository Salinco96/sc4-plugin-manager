import { Typography } from "@mui/material"
import Markdown, { defaultUrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"

export interface MarkdownViewProps {
  md: string
}

export function MarkdownView({ md }: MarkdownViewProps): JSX.Element {
  return (
    <Markdown
      components={{
        p({ ref, ...props }) {
          return <Typography component="p" mb={2} variant="body2" {...props} />
        },
      }}
      remarkPlugins={[remarkGfm]}
      urlTransform={(url, key, node) => {
        if (node.tagName === "a") {
          node.properties.rel = "noreferrer"
          node.properties.target = "_blank"
          node.properties.title = url
        }

        return defaultUrlTransform(url)
      }}
    >
      {md}
    </Markdown>
  )
}
