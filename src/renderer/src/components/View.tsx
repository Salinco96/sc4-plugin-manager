import type { ReactNode } from "react"
import { BackButton } from "./BackButton"
import { FlexCol, FlexRow } from "./FlexBox"

export function View({ children }: { children: ReactNode }): JSX.Element {
  return (
    <FlexCol fullHeight>
      <FlexRow pt={1} px={1}>
        <BackButton />
      </FlexRow>
      <FlexCol flex={1} gap={2} fullWidth>
        {children}
      </FlexCol>
    </FlexCol>
  )
}
