import { AssetID } from "@common/assets"

/** Tool ID */
export type ToolID = keyof typeof TOOLS

/** Tool info */
export interface ToolInfo {
  /** Asset ID of the executable */
  assetId: AssetID
  /** Executable path */
  exe: string
}

/** Tools */
const TOOLS = {
  cicdec: {
    assetId: "github/bioruebe/cicdec" as AssetID,
    exe: "cicdec.exe",
  },
  "7z": {
    assetId: "github/ip7z/7zip" as AssetID,
    exe: "7-Zip/7z.exe",
  },
} satisfies {
  [toolId: string]: ToolInfo
}

export function getToolInfo(toolId: ToolID): ToolInfo | undefined {
  return TOOLS[toolId]
}
