import { Link, Typography } from "@mui/material"
import { values } from "@salinco/nice-utils"
import { useMemo } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import type { PackageID } from "@common/packages"
import { store } from "@stores/main"
import { useNavigation } from "@utils/navigation"

export interface MarkdownViewProps {
  md: string
}

export function MarkdownView({ md }: MarkdownViewProps): JSX.Element {
  const authors = store.useAuthors()
  const packages = store.usePackages()

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
                  title="View author" // todo
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
                  title="View package" // todo
                >
                  {packageInfo.name}
                </Link>
              )
            }
          }

          return <Link href={href} rel="noreferrer" target="_blank" title={href} {...props} />
        },
        li({ ref, ...props }) {
          return <Typography component="li" variant="body2" {...props} />
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
