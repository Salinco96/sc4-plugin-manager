import { PackageBanner } from "./PackageBanner"

export function PackageBannerConflict({ reason }: { reason: string }): JSX.Element {
  return <PackageBanner header="Conflict">{reason}</PackageBanner>
}
