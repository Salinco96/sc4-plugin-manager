import type { OptionInfo } from "@common/options"

export const NOSECTION = ""

export function getSections(options: OptionInfo[]): { [sectionId: string]: OptionInfo[] } {
  const sections: { [section: string]: OptionInfo[] } = {}

  for (const option of options) {
    const section = option.section ?? NOSECTION
    sections[section] ??= []
    sections[section].push(option)
  }

  return sections
}
