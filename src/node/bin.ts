import type { FileHandle } from "node:fs/promises"

import { isNumber, parseHex, toHex } from "@salinco/nice-utils"
import { compress, decompress } from "qfs-compression"

import { TGI } from "@common/dbpf"
import { type ExemplarPropertyValue, ExemplarValueType } from "@common/exemplars"

import { readBytes } from "./files"

export interface BinaryOptions {
  alloc?: number
  resizable?: boolean
  writable?: boolean
}

export class Binary {
  protected $bytes: Buffer
  protected $length: number

  public offset: number
  public resizable: boolean
  public writable: boolean

  public constructor(bytes: Buffer | number, options: BinaryOptions = {}) {
    const { alloc = 0, resizable = false, writable = false } = options

    if (isNumber(bytes)) {
      this.$bytes = Buffer.alloc(Math.max(alloc, bytes))
      this.$length = bytes
    } else if (alloc > bytes.length) {
      this.$bytes = Buffer.alloc(alloc)
      this.$length = bytes.length
      bytes.copy(this.$bytes)
    } else {
      this.$bytes = bytes
      this.$length = bytes.length
    }

    this.offset = 0
    this.resizable = resizable
    this.writable = writable
  }

  public get length(): number {
    return this.$length
  }

  public compress(): void {
    this.$bytes = compress(this.$bytes, { includeSize: true })
    this.$length = this.$bytes.length
    this.offset = 0
  }

  public decompress(): void {
    this.$bytes = decompress(this.$bytes.subarray(4))
    this.$length = this.$bytes.length
    this.offset = 0
  }

  protected checkRead(size: number, offset: number = this.offset): void {
    if (offset + size <= this.$length) {
      return
    }

    throw Error("Index out of range:")
  }

  protected checkWrite(size: number, offset: number = this.offset): void {
    if (!this.writable) {
      throw Error("Binary is not writable")
    }

    if (offset + size <= this.$length) {
      return
    }

    this.$length = offset + size

    if (offset + size <= this.$bytes.length) {
      return
    }

    if (this.resizable) {
      const resized = Buffer.alloc(2 ** Math.floor(Math.log2(this.$length) + 1))
      this.$bytes.copy(resized)
      this.$bytes = resized
      return
    }

    throw Error("Index out of range:")
  }

  public static async fromFile(file: FileHandle, size: number, offset = 0): Promise<Binary> {
    return new Binary(await readBytes(file, size, offset))
  }

  public toBytes(): Buffer {
    if (this.$bytes.length === this.$length) {
      return this.$bytes
    }

    return this.$bytes.subarray(0, this.$length)
  }

  public toBase64(): string {
    return this.toBytes().toString("base64")
  }

  public toHex(): string {
    return this.toBytes().toString("hex")
  }

  public toString(): string {
    return this.toBytes().toString("utf8")
  }

  public async writeTofile(file: FileHandle, offset?: number): Promise<number> {
    const result = await file.write(this.$bytes, 0, this.$length, offset)
    return result.bytesWritten
  }

  public readBool(offset: number = this.offset): boolean {
    return this.readUInt8(offset) !== 0
  }

  public readFloat32(offset: number = this.offset): number {
    this.checkRead(4, offset)
    const value = this.$bytes.readFloatLE(offset)
    this.offset = offset + 4
    return value
  }

  public readSInt32(offset: number = this.offset): number {
    this.checkRead(4, offset)
    const value = this.$bytes.readInt32LE(offset)
    this.offset = offset + 4
    return value
  }

  public readSInt64(offset: number = this.offset): number {
    this.checkRead(8, offset)
    const value = Number(this.$bytes.readBigInt64LE(offset)) // TODO: Keep bigint?
    this.offset = offset + 8
    return value
  }

  public readString(
    length: number,
    offset: number = this.offset,
    encoding: BufferEncoding = "utf8",
  ): string {
    this.checkRead(length, offset)
    const value = this.$bytes.subarray(offset, offset + length).toString(encoding)
    this.offset = offset + length
    return value
  }

  public readTGI(offset: number = this.offset): TGI {
    const t = this.readUInt32(offset)
    const g = this.readUInt32()
    const i = this.readUInt32()
    return TGI(t, g, i)
  }

  public readUInt8(offset: number = this.offset): number {
    this.checkRead(1, offset)
    const value = this.$bytes.readUInt8(offset)
    this.offset = offset + 1
    return value
  }

  public readUInt16(offset: number = this.offset): number {
    this.checkRead(2, offset)
    const value = this.$bytes.readUInt16LE(offset)
    this.offset = offset + 2
    return value
  }

  public readUInt32(offset: number = this.offset): number {
    this.checkRead(4, offset)
    const value = this.$bytes.readUInt32LE(offset)
    this.offset = offset + 4
    return value
  }

  public readValue<T extends ExemplarValueType>(
    valueType: T,
    offset: number = this.offset,
  ): ExemplarPropertyValue<T, false> {
    switch (valueType) {
      case ExemplarValueType.UInt8: {
        return this.readUInt8(offset) as ExemplarPropertyValue<T, false>
      }

      case ExemplarValueType.UInt16: {
        return this.readUInt16(offset) as ExemplarPropertyValue<T, false>
      }

      case ExemplarValueType.UInt32: {
        return this.readUInt32(offset) as ExemplarPropertyValue<T, false>
      }

      case ExemplarValueType.SInt32: {
        return this.readSInt32(offset) as ExemplarPropertyValue<T, false>
      }

      case ExemplarValueType.SInt64: {
        return this.readSInt64(offset) as ExemplarPropertyValue<T, false>
      }

      case ExemplarValueType.Float32: {
        return this.readFloat32(offset) as ExemplarPropertyValue<T, false>
      }

      case ExemplarValueType.Bool: {
        return this.readBool(offset) as ExemplarPropertyValue<T, false>
      }

      default: {
        throw Error(`Unexpected valueType: 0x${toHex(valueType, 4)}`)
      }
    }
  }

  public readValues<T extends ExemplarValueType>(
    valueType: T,
    reps: number,
    offset: number = this.offset,
  ): ExemplarPropertyValue<T, true> {
    this.offset = offset

    switch (valueType) {
      case ExemplarValueType.String: {
        return this.readString(reps) as ExemplarPropertyValue<T, true>
      }

      default: {
        const values: ExemplarPropertyValue<ExemplarValueType, false>[] = []

        for (let i = 0; i < reps; i++) {
          values.push(this.readValue(valueType))
        }

        return values as ExemplarPropertyValue<T, true>
      }
    }
  }

  public writeBool(value: boolean, offset: number = this.offset): void {
    this.writeUInt8(value ? 1 : 0, offset)
  }

  public writeFloat32(value: number, offset: number = this.offset): void {
    this.checkWrite(4, offset)
    this.$bytes.writeFloatLE(value, offset)
    this.offset = offset + 4
  }

  public writeSInt32(value: number, offset: number = this.offset): void {
    this.checkWrite(4, offset)
    this.$bytes.writeInt32LE(value, offset)
    this.offset = offset + 4
  }

  public writeSInt64(value: number, offset: number = this.offset): void {
    this.checkWrite(8, offset)
    this.$bytes.writeBigInt64LE(BigInt(value), offset) // TODO: Keep bigint?
    this.offset = offset + 8
  }

  public writeString(
    value: string,
    offset: number = this.offset,
    encoding: BufferEncoding = "utf8",
  ): void {
    this.checkWrite(value.length, offset)
    this.$bytes.write(value, offset, encoding)
    this.offset = offset + value.length
  }

  public writeTGI(value: TGI, offset: number = this.offset): void {
    const [t, g, i] = value.split("-").map(parseHex)
    this.writeUInt32(t, offset)
    this.writeUInt32(g)
    this.writeUInt32(i)
  }

  public writeUInt8(value: number, offset: number = this.offset): void {
    this.checkWrite(1, offset)
    this.$bytes.writeUInt8(value, offset)
    this.offset = offset + 1
  }

  public writeUInt16(value: number, offset: number = this.offset): void {
    this.checkWrite(2, offset)
    this.$bytes.writeUInt16LE(value, offset)
    this.offset = offset + 2
  }

  public writeUInt32(value: number, offset: number = this.offset): void {
    this.checkWrite(4, offset)
    this.$bytes.writeUInt32LE(value, offset)
    this.offset = offset + 4
  }

  public writeValue<T extends ExemplarValueType>(
    value: ExemplarPropertyValue<T, false>,
    valueType: T,
    offset: number = this.offset,
  ): void {
    switch (valueType) {
      case ExemplarValueType.UInt8: {
        this.writeUInt8(value as number, offset)
        break
      }

      case ExemplarValueType.UInt16: {
        this.writeUInt16(value as number, offset)
        break
      }

      case ExemplarValueType.UInt32: {
        this.writeUInt32(value as number, offset)
        break
      }

      case ExemplarValueType.SInt32: {
        this.writeSInt32(value as number, offset)
        break
      }

      case ExemplarValueType.SInt64: {
        this.writeSInt64(value as number, offset)
        break
      }

      case ExemplarValueType.Float32: {
        this.writeFloat32(value as number, offset)
        break
      }

      case ExemplarValueType.Bool: {
        this.writeBool(value as boolean, offset)
        break
      }

      default: {
        throw Error(`Unexpected valueType: 0x${toHex(valueType, 4)}`)
      }
    }
  }

  public writeValues<T extends ExemplarValueType>(
    values: ExemplarPropertyValue<T, true>,
    valueType: T,
    offset: number = this.offset,
  ): void {
    this.offset = offset

    switch (valueType) {
      case ExemplarValueType.String: {
        this.writeString(values as string)
        break
      }

      default: {
        for (const value of values as ExemplarPropertyValue<T, false>[]) {
          this.writeValue(value, valueType)
        }
      }
    }
  }
}
