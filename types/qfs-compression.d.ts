declare module "qfs-compression" {
  export interface CompressOptions {
    includeSize?: boolean
    windowBits?: number
  }

  export const compress: (buffer: Buffer, options?: CompressOptions) => Buffer

  export const decompress: (buffer: Buffer) => Buffer
}
