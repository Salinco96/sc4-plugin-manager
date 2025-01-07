import type { ReactNode } from "react"
import { BackButton } from "./BackButton"
import { FlexBox } from "./FlexBox"

export function View({ children }: { children: ReactNode }): JSX.Element {
  return (
    <FlexBox direction="column" height="100%">
      <FlexBox pt={1} px={1}>
        <BackButton />
      </FlexBox>
      <FlexBox direction="column" flex={1} gap={2} width="100%">
        {children}
      </FlexBox>
    </FlexBox>
  )
}
