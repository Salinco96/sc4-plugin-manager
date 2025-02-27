import type { FileHandle } from "node:fs/promises"

import { parseHex, toHex } from "@salinco/nice-utils"
import { compress, decompress } from "qfs-compression"

import { TGI } from "@common/dbpf"
import { type ExemplarPropertyValue, ExemplarValueType } from "@common/exemplars"

import { readBytes, writeBytes } from "./files"

export class BinaryReader {
  #bytes: Buffer

  public offset: number

  public constructor(bytes: Buffer, compressed?: boolean) {
    this.#bytes = compressed ? BinaryReader.decompress(bytes) : bytes
    this.offset = 0
  }

  public get bytes(): Buffer {
    return this.#bytes
  }

  public get length(): number {
    return this.#bytes.length
  }

  protected checkRead(size: number, offset: number = this.offset): void {
    if (offset + size <= this.length) {
      return
    }

    throw Error("Index out of range:")
  }

  public static decompress(bytes: Buffer): Buffer {
    return decompress(bytes.subarray(4))
  }

  public static async fromFile(
    file: FileHandle,
    size?: number,
    offset?: number,
    compressed?: boolean,
  ): Promise<BinaryReader> {
    return new BinaryReader(await readBytes(file, size, offset), compressed)
  }

  public readBool(offset?: number): boolean {
    return Boolean(this.readUInt8(offset))
  }

  public readBytes(length: number, offset?: number): Buffer {
    this.checkRead(length, offset)
    const bytes = this.#bytes.subarray(offset ?? this.offset, (offset ?? this.offset) + length)
    if (offset === undefined) {
      this.offset += length
    }

    return bytes
  }

  public readFloat32(offset?: number): number {
    this.checkRead(4, offset)
    const value = this.#bytes.readFloatLE(offset ?? this.offset)
    if (offset === undefined) {
      this.offset += 4
    }

    return value
  }

  public readSInt8(offset?: number): number {
    this.checkRead(1, offset)
    const value = this.#bytes.readInt8(offset ?? this.offset)
    if (offset === undefined) {
      this.offset += 1
    }

    return value
  }

  public readSInt16(offset?: number): number {
    this.checkRead(2, offset)
    const value = this.#bytes.readInt16LE(offset ?? this.offset)
    if (offset === undefined) {
      this.offset += 2
    }

    return value
  }

  public readSInt32(offset?: number): number {
    this.checkRead(4, offset)
    const value = this.#bytes.readInt32LE(offset ?? this.offset)
    if (offset === undefined) {
      this.offset += 4
    }

    return value
  }

  public readSInt64(offset?: number): number {
    this.checkRead(8, offset)
    const value = Number(this.#bytes.readBigInt64LE(offset ?? this.offset)) // TODO: Keep bigint?
    if (offset === undefined) {
      this.offset += 8
    }

    return value
  }

  public readString(length: number, offset?: number, encoding?: BufferEncoding): string {
    return this.readBytes(length, offset).toString(encoding)
  }

  public readTGI(offset?: number): TGI {
    const oldOffset = this.offset
    if (offset !== undefined) {
      this.offset = offset
    }

    try {
      const t = this.readUInt32()
      const g = this.readUInt32()
      const i = this.readUInt32()
      return TGI(t, g, i)
    } finally {
      if (offset !== undefined) {
        this.offset = oldOffset
      }
    }
  }

  public readUInt8(offset?: number): number {
    this.checkRead(1, offset)
    const value = this.#bytes.readUInt8(offset ?? this.offset)
    if (offset === undefined) {
      this.offset += 1
    }

    return value
  }

  public readUInt16(offset?: number): number {
    this.checkRead(2, offset)
    const value = this.#bytes.readUInt16LE(offset ?? this.offset)
    if (offset === undefined) {
      this.offset += 2
    }

    return value
  }

  public readUInt32(offset?: number): number {
    this.checkRead(4, offset)
    const value = this.#bytes.readUInt32LE(offset ?? this.offset)
    if (offset === undefined) {
      this.offset += 4
    }

    return value
  }

  public readValue<T extends ExemplarValueType>(
    valueType: T,
    offset?: number,
  ): ExemplarPropertyValue<T, false> {
    switch (valueType) {
      case ExemplarValueType.UInt8:
        return this.readUInt8(offset) as ExemplarPropertyValue<T, false>

      case ExemplarValueType.UInt16:
        return this.readUInt16(offset) as ExemplarPropertyValue<T, false>

      case ExemplarValueType.UInt32:
        return this.readUInt32(offset) as ExemplarPropertyValue<T, false>

      case ExemplarValueType.SInt32:
        return this.readSInt32(offset) as ExemplarPropertyValue<T, false>

      case ExemplarValueType.SInt64:
        return this.readSInt64(offset) as ExemplarPropertyValue<T, false>

      case ExemplarValueType.Float32:
        return this.readFloat32(offset) as ExemplarPropertyValue<T, false>

      case ExemplarValueType.Bool:
        return this.readBool(offset) as ExemplarPropertyValue<T, false>

      default: {
        throw Error(`Unexpected valueType: 0x${toHex(valueType, 4)}`)
      }
    }
  }

  public readValues<T extends ExemplarValueType>(
    valueType: T,
    reps: number,
    offset?: number,
  ): ExemplarPropertyValue<T, true> {
    if (valueType === ExemplarValueType.String) {
      return this.readString(reps, offset) as ExemplarPropertyValue<T, true>
    }

    const oldOffset = this.offset
    if (offset !== undefined) {
      this.offset = offset
    }

    try {
      const values: ExemplarPropertyValue<ExemplarValueType, false>[] = []

      for (let i = 0; i < reps; i++) {
        values.push(this.readValue(valueType))
      }

      return values as ExemplarPropertyValue<T, true>
    } finally {
      if (offset !== undefined) {
        this.offset = oldOffset
      }
    }
  }

  public slice(start: number, end?: number): BinaryReader {
    return new BinaryReader(this.#bytes.subarray(start, end))
  }

  public toBase64(): string {
    return this.#bytes.toString("base64")
  }

  public toHex(): string {
    return this.#bytes.toString("hex")
  }

  public toString(encoding?: BufferEncoding): string {
    return this.#bytes.toString(encoding ?? "utf8")
  }
}

export class BinaryWriter {
  #bytes: Buffer
  #compressed: boolean
  #length: number

  public offset: number
  public readonly resizable: boolean

  public constructor(size?: number, options?: { alloc?: number; resizable?: boolean }) {
    this.#compressed = false
    this.#length = size ?? 0
    this.offset = 0
    this.resizable = options?.resizable ?? size === undefined

    if (this.resizable) {
      this.#bytes = BinaryWriter.createBuffer(Math.max(this.#length, options?.alloc ?? 1024))
    } else {
      this.#bytes = Buffer.alloc(this.#length)
    }
  }

  public get bytes(): Buffer {
    return this.#bytes.subarray(0, this.#length)
  }

  public get compressed(): boolean {
    return this.#compressed
  }

  public get length(): number {
    return this.#length
  }

  protected static createBuffer(size: number): Buffer {
    return Buffer.alloc(2 ** Math.floor(Math.log2(size) + 1))
  }

  public static compress(bytes: Buffer): Buffer {
    return compress(bytes, { includeSize: true })
  }

  public checkEnd(): void {
    if (this.offset !== this.#length) {
      throw Error("Entire buffer not written")
    }
  }

  public checkSize(size: number): void {
    if (this.#length !== size) {
      throw Error(`Expected size to be ${size} (got ${this.#length})`)
    }
  }

  protected checkWrite(size: number, offset: number = this.offset): void {
    if (this.#compressed) {
      throw Error("Cannot write to compressed buffer")
    }

    if (offset + size <= this.#length) {
      return
    }

    if (!this.resizable) {
      throw Error("Index out of range - Buffer is not resizable")
    }

    this.#length = offset + size

    if (offset + size <= this.#bytes.length) {
      return
    }

    const resized = BinaryWriter.createBuffer(offset + size)
    this.#bytes.copy(resized)
    this.#bytes = resized
  }

  public compress(): void {
    if (this.#compressed) {
      return
    }

    this.#bytes = BinaryWriter.compress(this.bytes)
    this.#compressed = true
    this.#length = this.#bytes.length
  }

  public toBase64(): string {
    return this.bytes.toString("base64")
  }

  public toHex(): string {
    return this.bytes.toString("hex")
  }

  public toString(encoding?: BufferEncoding): string {
    return this.bytes.toString(encoding ?? "utf8")
  }

  public writeBool(value: boolean, offset?: number): void {
    this.writeUInt8(value ? 1 : 0, offset)
  }

  public writeBytes(bytes: Buffer, offset?: number): void {
    this.checkWrite(bytes.length, offset)
    const newOffset = (offset ?? this.offset) + bytes.copy(this.#bytes, offset ?? this.offset)
    if (offset === undefined) {
      this.offset = newOffset
    }
  }

  public writeFloat32(value: number, offset?: number): void {
    this.checkWrite(4, offset)
    const newOffset = this.#bytes.writeFloatLE(value, offset ?? this.offset)
    if (offset === undefined) {
      this.offset = newOffset
    }
  }

  public writeSInt8(value: number, offset?: number): void {
    this.checkWrite(1, offset)
    const newOffset = this.#bytes.writeInt8(value, offset ?? this.offset)
    if (offset === undefined) {
      this.offset = newOffset
    }
  }

  public writeSInt16(value: number, offset?: number): void {
    this.checkWrite(2, offset)
    const newOffset = this.#bytes.writeInt16LE(value, offset ?? this.offset)
    if (offset === undefined) {
      this.offset = newOffset
    }
  }

  public writeSInt32(value: number, offset?: number): void {
    this.checkWrite(4, offset)
    const newOffset = this.#bytes.writeInt32LE(value, offset ?? this.offset)
    if (offset === undefined) {
      this.offset = newOffset
    }
  }

  public writeSInt64(value: number, offset?: number): void {
    this.checkWrite(8, offset)
    const newOffset = this.#bytes.writeBigInt64LE(BigInt(value), offset ?? this.offset) // TODO: Keep bigint?
    if (offset === undefined) {
      this.offset = newOffset
    }
  }

  public writeString(value: string, offset?: number, encoding?: BufferEncoding): void {
    this.checkWrite(value.length, offset)
    const numWritten = this.#bytes.write(value, offset ?? this.offset, encoding ?? "utf8")
    if (offset === undefined) {
      this.offset += numWritten
    }
  }

  public writeTGI(value: TGI, offset?: number): void {
    const [t, g, i] = value.split("-").map(parseHex)

    const oldOffset = this.offset
    if (offset !== undefined) {
      this.offset = offset
    }

    try {
      this.writeUInt32(t)
      this.writeUInt32(g)
      this.writeUInt32(i)
    } finally {
      if (offset !== undefined) {
        this.offset = oldOffset
      }
    }
  }

  public async writeToFile(file: FileHandle, offset?: number): Promise<number> {
    return writeBytes(file, this.bytes, offset)
  }

  public writeUInt8(value: number, offset?: number): void {
    this.checkWrite(1, offset)
    const newOffset = this.#bytes.writeUInt8(value, offset ?? this.offset)
    if (offset === undefined) {
      this.offset = newOffset
    }
  }

  public writeUInt16(value: number, offset?: number): void {
    this.checkWrite(2, offset)
    const newOffset = this.#bytes.writeUInt16LE(value, offset ?? this.offset)
    if (offset === undefined) {
      this.offset = newOffset
    }
  }

  public writeUInt32(value: number, offset?: number): void {
    this.checkWrite(4, offset)
    const newOffset = this.#bytes.writeUInt32LE(value, offset ?? this.offset)
    if (offset === undefined) {
      this.offset = newOffset
    }
  }

  public writeValue<T extends ExemplarValueType>(
    value: ExemplarPropertyValue<T, false>,
    valueType: T,
    offset?: number,
  ): void {
    switch (valueType) {
      case ExemplarValueType.UInt8:
        this.writeUInt8(value as number, offset)
        break

      case ExemplarValueType.UInt16:
        this.writeUInt16(value as number, offset)
        break

      case ExemplarValueType.UInt32:
        this.writeUInt32(value as number, offset)
        break

      case ExemplarValueType.SInt32:
        this.writeSInt32(value as number, offset)
        break

      case ExemplarValueType.SInt64:
        this.writeSInt64(value as number, offset)
        break

      case ExemplarValueType.Float32:
        this.writeFloat32(value as number, offset)
        break

      case ExemplarValueType.Bool:
        this.writeBool(value as boolean, offset)
        break

      default: {
        throw Error(`Unexpected valueType: 0x${toHex(valueType, 4)}`)
      }
    }
  }

  public writeValues<T extends ExemplarValueType>(
    values: ExemplarPropertyValue<T, true>,
    valueType: T,
    offset?: number,
  ): void {
    if (valueType === ExemplarValueType.String) {
      this.writeString(values as string, offset)
      return
    }

    const oldOffset = this.offset
    if (offset !== undefined) {
      this.offset = offset
    }

    try {
      for (const value of values as ExemplarPropertyValue<T, false>[]) {
        this.writeValue(value, valueType)
      }
    } finally {
      if (offset !== undefined) {
        this.offset = oldOffset
      }
    }
  }
}
