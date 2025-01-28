import { Breadcrumbs, Link, Typography } from "@mui/material"
import { forEach, values } from "@salinco/nice-utils"
import { useMemo } from "react"

import { Empty } from "@components/Empty"
import { FlexCol } from "@components/FlexBox"
import { List } from "@components/List"
import { Loader } from "@components/Loader"
import { type File, FileListItem } from "@components/Plugins/FileListItem"
import { type Folder, FolderListItem } from "@components/Plugins/FolderListItem"
import { store } from "@stores/main"
import { useNavigation } from "@utils/navigation"

function Plugins({ path }: { path?: string }): JSX.Element {
  const { openPluginsView } = useNavigation()

  const parts = path ? ["Plugins", ...path.split("/")] : ["Plugins"]

  return (
    <FlexCol fullHeight>
      <Breadcrumbs maxItems={3} sx={{ color: "text.primary", pt: 2, px: 2 }}>
        {parts.map((part, index) => {
          const isLast = index === parts.length - 1
          const path = parts.slice(1, index + 1).join("/")

          if (isLast) {
            return (
              <Typography color="inherit" key={path}>
                {part}
              </Typography>
            )
          }

          return (
            <Link
              color="inherit"
              key={path}
              underline="hover"
              onClick={() => openPluginsView(path || undefined)}
              sx={{ cursor: "pointer" }}
            >
              {part}
            </Link>
          )
        })}
      </Breadcrumbs>

      <PluginsInner path={path} />
    </FlexCol>
  )
}

function PluginsInner({ path: basePath }: { path?: string }): JSX.Element {
  const plugins = store.usePlugins()

  const data = useMemo(() => {
    if (!plugins) {
      return undefined
    }

    const name = basePath?.split("/").at(-1)
    const contents = basePath ? plugins[basePath] : undefined
    if (contents) {
      return { contents, name, type: "file" as const }
    }

    const files: { [name in string]?: File } = {}
    const folders: { [name in string]?: Folder } = {}

    const prefix = basePath ? `${basePath}/` : ""

    forEach(plugins, (contents, path) => {
      if (path.startsWith(prefix)) {
        const [name, ...rest] = path.slice(prefix.length).split("/")
        if (rest.length) {
          folders[name] ??= { children: [], name, type: "folder" }
          folders[name].children.push(rest.join("/"))
        } else {
          files[name] = { contents, name, type: "file" }
        }
      }
    })

    return { children: values({ ...folders, ...files }), name, type: "folder" as const }
  }, [basePath, plugins])

  if (!data) {
    return <Loader />
  }

  if (data.type === "file") {
    return (
      <pre>
        {data.name}: {JSON.stringify(data, undefined, 2)}
      </pre>
    )
  }

  if (!data.children.length) {
    return <Empty message="This file or folder no longer exists." />
  }

  return (
    <FlexCol fullHeight>
      <List
        items={data.children}
        renderItem={item =>
          item.type === "file" ? (
            <FileListItem file={item} path={basePath} />
          ) : (
            <FolderListItem folder={item} path={basePath} />
          )
        }
      />
    </FlexCol>
  )
}

export default Plugins
