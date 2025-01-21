import { Binary } from "@node/bin"
import { type Constructor, toHex } from "@salinco/nice-utils"
import { crc32 } from "../crc"

export interface SaveRecordData {
  buf?: Buffer
  crc?: number
  mem: number
}

export interface SaveRecordParser<R extends SaveRecord> extends Constructor<R> {
  parse(header: SaveRecordData, bytes: Binary): R
  parseRecord<R extends SaveRecord>(this: SaveRecordParser<R>, bytes: Binary, checkCRC?: boolean): R
}

export class SaveRecord implements SaveRecordData {
  public buf?: Buffer
  public crc?: number
  public readonly mem: number

  public constructor(data: SaveRecordData) {
    this.buf = data.buf
    this.crc = data.crc
    this.mem = data.mem
  }

  public dirty(): void {
    this.buf = undefined
    this.crc = undefined
  }

  public isDirty(): boolean {
    return !this.buf
  }

  public toBytes(): Buffer {
    if (!this.buf) {
      const bytes = new Binary(4, { alloc: 1024, resizable: true, writable: true })
      bytes.writeUInt32(this.mem)
      this.write(bytes)
      this.buf = bytes.toBytes()
      this.crc = undefined
    }

    return this.buf
  }

  public static parse(header: SaveRecordData, bytes: Binary): SaveRecord {
    bytes.offset = bytes.length // skip to end of buffer so we do not get mismatching length error
    return new this(header)
  }

  public static parseRecord<R extends SaveRecord>(
    this: SaveRecordParser<R>,
    bytes: Binary,
    checkCRC?: boolean,
  ): R {
    const len = bytes.readUInt32()
    const crc = bytes.readUInt32()
    const buf = bytes.readBytes(len - 8)

    if (checkCRC && crc !== crc32(buf)) {
      throw Error("Invalid CRC")
    }

    const data = new Binary(buf)
    const mem = data.readUInt32()
    const record = this.parse({ buf, crc, mem }, data)

    if (data.offset < data.length) {
      console.warn("Record was not fully parsed")
    }

    return record
  }

  protected static parseRef(bytes: Binary, expectedType: number): number | null {
    const id = bytes.readUInt32()
    if (id === 0) {
      return null
    }

    const type = bytes.readUInt32()
    if (type !== expectedType) {
      throw Error(
        `Mismatching subfile ref type: 0x${toHex(type, 8)} (expected 0x${toHex(expectedType, 8)})`,
      )
    }

    return id
  }

  // biome-ignore lint/correctness/noUnusedVariables: used by subclasses
  protected write(bytes: Binary): void {
    throw Error("Cannot generate SaveRecord")
  }

  public writeRecord(bytes: Binary): void {
    const buf = this.toBytes()
    this.crc ??= crc32(buf)
    bytes.writeUInt32(buf.length + 8)
    bytes.writeUInt32(this.crc)
    bytes.writeBytes(buf)
  }

  protected writeRef(bytes: Binary, ref: number | null, type: number): void {
    if (ref) {
      bytes.writeUInt32(ref)
      bytes.writeUInt32(type)
    } else {
      bytes.writeUInt32(0)
    }
  }
}
