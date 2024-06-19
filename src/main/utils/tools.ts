export const TOOLS = {
  cicdec: {
    assetId: "github/bioruebe/cicdec",
    exe: "cicdec.exe",
  },
  "7z": {
    assetId: "github/ip7z/7zip",
    exe: "7-Zip/7z.exe",
  },
} satisfies {
  [tool: string]: {
    assetId?: string
    exe: string
  }
}
