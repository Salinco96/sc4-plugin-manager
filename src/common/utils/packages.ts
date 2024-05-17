export type ParsedPackageName = [r0_id: string, r1_author: string]

export type ParsedPackageRef = [
  r0_id: string,
  r1_author: string,
  r2_variant: string | undefined,
  r3_version: string | undefined,
  r4_path: string | undefined,
]

/**
 * Builds a package reference in the format `${author}/${name}[#${variant}][@${version}][/${path}]`
 */
export function buildPackageRef(
  packageId: string,
  variant?: string,
  version?: string,
  path?: string,
): string {
  return `${packageId}${variant ? "#" + variant : ""}${version ? "@" + version : ""}${path ? "/" + path : ""}`
}

/**
 * Parses a package ID in the format `${author}/${name}`
 */
export function parsePackageId(name: string): ParsedPackageName | null {
  return name.match(/^([\w-]+)\/[\w-]+$/) as ParsedPackageName | null
}

/**
 * Parses a package reference in the format `${author}/${name}[#${variant}][@${version}][/${path}]`
 */
export function parsePackageRef(name: string): ParsedPackageRef | null {
  return name.match(
    /^([\w-]+)\/[\w-]+(?:#([\w-]+))?(?:@(\d+(?:\.\d+)?(?:\.\d+)?[a-z]?))?(?:\/(.+))?$/,
  ) as ParsedPackageRef | null
}
