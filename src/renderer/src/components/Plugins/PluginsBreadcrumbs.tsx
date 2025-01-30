import { Breadcrumbs, Link, Typography } from "@mui/material"

import { useNavigation } from "@utils/navigation"

export function PluginsBreadcrumbs({ path }: { path?: string }): JSX.Element {
  const { openPluginsView } = useNavigation()

  const parts = path ? ["Plugins", ...path.split("/")] : ["Plugins"]

  return (
    <Breadcrumbs maxItems={3} sx={{ color: "text.primary" }}>
      {parts.map((part, index) => {
        const isLast = index === parts.length - 1
        const breadcrumbPath = parts.slice(1, index + 1).join("/") || undefined

        if (isLast) {
          return (
            <Typography color="inherit" key={index}>
              {part}
            </Typography>
          )
        }

        return (
          <Link
            color="inherit"
            key={index}
            underline="hover"
            onClick={() => openPluginsView(breadcrumbPath)}
            sx={{ cursor: "pointer" }}
          >
            {part}
          </Link>
        )
      })}
    </Breadcrumbs>
  )
}
