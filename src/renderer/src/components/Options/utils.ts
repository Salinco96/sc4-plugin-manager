import { OptionInfo } from "@common/types"

export const NOSECTION = ""

export function getSections(options: OptionInfo[]): { [sectionId: string]: OptionInfo[] } {
  const sections: { [name: string]: OptionInfo[] } = {}

  for (const option of options) {
    ;(sections[option.section ?? NOSECTION] ??= []).push(option)
  }

  return sections
}
