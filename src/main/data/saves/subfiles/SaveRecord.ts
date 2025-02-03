import { BinaryReader, BinaryWriter } from "@node/bin"
import { type Constructor, toHex } from "@salinco/nice-utils"
import { crc32 } from "../crc"

export interface SaveRecordData {
  buf?: Buffer
  crc?: number
  mem: number
}

export interface SaveRecordParser<R extends SaveRecord> extends Constructor<R> {
  parse(header: SaveRecordData, reader: BinaryReader): R
  parseRecord<R extends SaveRecord>(
    this: SaveRecordParser<R>,
    reader: BinaryReader,
    checkCRC?: boolean,
  ): R
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
      const writer = new BinaryWriter()
      writer.writeUInt32(this.mem)
      this.write(writer)
      this.buf = writer.bytes
      this.crc = undefined
    }

    return this.buf
  }

  public static parse(header: SaveRecordData, reader: BinaryReader): SaveRecord {
    reader.offset = reader.length // skip to end of buffer so we do not get mismatching length error
    return new this(header)
  }

  public static parseRecord<R extends SaveRecord>(
    this: SaveRecordParser<R>,
    reader: BinaryReader,
    checkCRC?: boolean,
  ): R {
    const len = reader.readUInt32()
    const crc = reader.readUInt32()
    const buf = reader.readBytes(len - 8)

    if (checkCRC && crc !== crc32(buf)) {
      throw Error("Invalid CRC")
    }

    const data = new BinaryReader(buf)
    const mem = data.readUInt32()
    const record = this.parse({ buf, crc, mem }, data)

    if (data.offset < data.length) {
      console.warn("Record was not fully parsed")
    }

    return record
  }

  protected static parseRef(reader: BinaryReader, expectedType: number): number | null {
    const id = reader.readUInt32()
    if (id === 0) {
      return null
    }

    const type = reader.readUInt32()
    if (type !== expectedType) {
      throw Error(
        `Mismatching subfile ref type: 0x${toHex(type, 8)} (expected 0x${toHex(expectedType, 8)})`,
      )
    }

    return id
  }

  // biome-ignore lint/correctness/noUnusedVariables: used by subclasses
  protected write(writer: BinaryWriter): void {
    throw Error("Cannot generate SaveRecord")
  }

  public writeRecord(writer: BinaryWriter): void {
    const buf = this.toBytes()
    this.crc ??= crc32(buf)
    writer.writeUInt32(buf.length + 8)
    writer.writeUInt32(this.crc)
    writer.writeBytes(buf)
  }

  protected writeRef(writer: BinaryWriter, ref: number | null, type: number): void {
    if (ref) {
      writer.writeUInt32(ref)
      writer.writeUInt32(type)
    } else {
      writer.writeUInt32(0)
    }
  }
}
