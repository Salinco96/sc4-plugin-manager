import { Box, Link, Typography } from "@mui/material"
import { values } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import { getAuthorName } from "@common/authors"
import type { ToolID } from "@common/tools"
import { MarkdownView } from "@components/MarkdownView"
import { Text } from "@components/Text"
import { store } from "@stores/main"
import { useNavigation } from "@utils/navigation"

export function ToolViewSummary({ toolId }: { toolId: ToolID }): JSX.Element {
  const authors = store.useAuthors()
  const toolInfo = store.useToolInfo(toolId)

  const { openAuthorView } = useNavigation()

  const { t } = useTranslation("PackageViewSummary")

  return (
    <Box>
      {toolInfo.summary && (
        <Text fontStyle="italic" mb={2} variant="body2">
          {toolInfo.summary}
        </Text>
      )}

      {toolInfo.description && (
        <MarkdownView
          md={toolInfo.description.replace(
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
      )}

      {toolInfo.url && (
        <Text maxLines={1} variant="body2">
          <b>{`${t("url")}: `}</b>
          <Link href={toolInfo.url} target="_blank" rel="noreferrer">
            {toolInfo.url}
          </Link>
        </Text>
      )}

      {toolInfo.repository && (
        <Text maxLines={1} variant="body2">
          <b>{`${t("repository")}: `}</b>
          <Link href={toolInfo.repository} target="_blank" rel="noreferrer">
            {toolInfo.repository}
          </Link>
        </Text>
      )}

      {toolInfo.support && (
        <Text maxLines={1} variant="body2">
          <b>{`${t("support")}: `}</b>
          <Link href={toolInfo.support} target="_blank" rel="noreferrer">
            {toolInfo.support}
          </Link>
        </Text>
      )}

      {!!toolInfo.credits?.length && (
        <>
          <Typography variant="body2">
            <b>{`${t("credits")}: `}</b>
          </Typography>
          <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
            {toolInfo.credits.map(({ id, text }) => (
              <Typography component="li" key={id ?? text} variant="body2">
                {id && (
                  <Link onClick={() => openAuthorView(id)} sx={{ cursor: "pointer" }}>
                    {getAuthorName(id, authors)}
                  </Link>
                )}
                {id && text && " - "}
                {text}
              </Typography>
            ))}
          </ul>
        </>
      )}

      {!!toolInfo.thanks?.length && (
        <>
          <Typography variant="body2">
            <b>{`${t("thanks")}: `}</b>
          </Typography>
          <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
            {toolInfo.thanks.map(({ id, text }) => (
              <Typography component="li" key={id ?? text} variant="body2">
                {id && (
                  <Link onClick={() => openAuthorView(id)} sx={{ cursor: "pointer" }}>
                    {getAuthorName(id, authors)}
                  </Link>
                )}
                {id && text && " - "}
                {text}
              </Typography>
            ))}
          </ul>
        </>
      )}
    </Box>
  )
}
