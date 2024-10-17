export interface DBPFEntry {
  /** TGI in format "T-G-I" */
  id: string
  offset: number
  size: number
  /** Only defined if compressed */
  uncompressed?: number
}

export interface DBPFFile {
  /** ISO */
  createdAt: string
  entries: {
    /** TGI in format "T-G-I" */
    [id: string]: DBPFEntry
  }
  /** 7.0 */
  indexVersion: string
  /** ISO */
  modifiedAt: string
  /** 1.0 */
  version: string
}

export function isDBPF(filePath: string): boolean {
  return /\.(dat|sc4desc|sc4lot|sc4model)$/i.test(filePath)
}
