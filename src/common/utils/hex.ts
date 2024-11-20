export function readHex(value: string): number {
  return Number.parseInt(value.replace(/^0x/, ""), 16)
}

export function toHex(value: number, size?: number, prefix = false, uppercase = false): string {
  let hex = value.toString(16)

  if (size !== undefined) {
    hex = hex.padStart(size, "0")
  }

  if (uppercase) {
    hex = hex.toUpperCase()
  }

  if (prefix) {
    hex = `0x${hex}`
  }

  return hex
}
