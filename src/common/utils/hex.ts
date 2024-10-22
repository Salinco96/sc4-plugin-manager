export function readHex(value: string): number {
  return Number.parseInt(value.replace(/^0x/, ""), 16)
}

export function toHex(value: number, size: number, prefix: boolean = false): string {
  return (prefix ? "0x" : "") + value.toString(16).padStart(size, "0")
}
