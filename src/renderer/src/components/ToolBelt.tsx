import {
  Settings as ConfigIcon,
  Topic as DocsIcon,
  Folder as FilesIcon,
  GitHub as GitHubIcon,
  Tune as OptionsIcon,
  Notes as ReadmeIcon,
  Code as RepositoryIcon,
  LiveHelpOutlined as SupportIcon,
  Language as WebIcon,
} from "@mui/icons-material"
import type { BoxProps } from "@mui/material"
import type { ParseKeys } from "i18next"
import type { ComponentType } from "react"
import { useTranslation } from "react-i18next"

import { FlexRow } from "./FlexBox"
import { ToolButton } from "./ToolButton"

const ICONS = {
  config: ConfigIcon,
  docs: DocsIcon,
  files: FilesIcon,
  github: GitHubIcon,
  options: OptionsIcon,
  readme: ReadmeIcon,
  repository: RepositoryIcon,
  support: SupportIcon,
  website: WebIcon,
} satisfies {
  [icon: string]: ComponentType<{ fontSize: "inherit" }>
}

export type ToolBeltIcon = keyof typeof ICONS

export interface ToolBeltAction {
  action: () => void
  description: ParseKeys<"ToolBelt">
  icon: ToolBeltIcon
  id: string
}

export interface ToolBeltProps {
  actions: ToolBeltAction[]
  size?: BoxProps["fontSize"]
}

export function ToolBelt({ actions, size }: ToolBeltProps): JSX.Element {
  const { t } = useTranslation("ToolBelt")

  return (
    <FlexRow centered gap={0.5} mx={0.5}>
      {actions.map(({ action, description, icon, id }) => (
        <ToolButton
          key={id}
          description={t(description)}
          icon={ICONS[icon]}
          onClick={action}
          size={size}
        />
      ))}
    </FlexRow>
  )
}
