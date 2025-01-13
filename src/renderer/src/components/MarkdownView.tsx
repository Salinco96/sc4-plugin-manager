import { Link, Typography } from "@mui/material"
import { values } from "@salinco/nice-utils"
import { useMemo } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import type { PackageID } from "@common/packages"
import { useNavigation } from "@utils/navigation"
import { useAuthors, useStore } from "@utils/store"

export interface MarkdownViewProps {
  md: string
}

export function MarkdownView({ md }: MarkdownViewProps): JSX.Element {
  const authors = useAuthors()
  const packages = useStore(store => store.packages)

  const { openAuthorView, openPackageView } = useNavigation()

  const urlMapping = useMemo(() => {
    return values(packages ?? {}).reduce(
      (urlMapping, packageInfo) => {
        for (const variantInfo of values(packageInfo.variants)) {
          if (variantInfo.url) {
            urlMapping[variantInfo.url] = packageInfo.id
          }
        }

        return urlMapping
      },
      {} as { [url in string]?: PackageID },
    )
  }, [packages])

  return (
    <Markdown
      components={{
        a({ href, ref, ...props }) {
          const authorMatch = href?.match(
            /https:[/][/]community[.]simtropolis[.]com[/]profile[/][^/]+[/]/,
          )?.[0]

          if (authorMatch) {
            const authorInfo = values(authors).find(authorInfo => authorInfo.url === authorMatch)
            if (authorInfo) {
              return (
                <Link
                  onClick={() => openAuthorView(authorInfo.id)}
                  sx={{ cursor: "pointer" }}
                  title="View author"
                >
                  {authorInfo.name}
                </Link>
              )
            }
          }

          if (href && urlMapping[href] && packages) {
            const packageInfo = packages[urlMapping[href]]
            if (packageInfo) {
              return (
                <Link
                  onClick={() => openPackageView(packageInfo.id)}
                  sx={{ cursor: "pointer" }}
                  title="View package"
                >
                  {packageInfo.name}
                </Link>
              )
            }
          }

          return <Link href={href} rel="noreferrer" target="_blank" title={href} {...props} />
        },
        p({ ref, ...props }) {
          return <Typography component="p" mb={2} variant="body2" {...props} />
        },
      }}
      remarkPlugins={[remarkGfm]}
    >
      {md}
    </Markdown>
  )
}
