export function hashCode(value: string): number {
  let hash = 0

  for (let i = 0; i < value.length; i++) {
    hash = (((hash & 0x7ffffff) << 5) - hash + value.charCodeAt(i)) | 0
  }

  return hash + 0x80000000
}
