import type { BinaryReader, BinaryWriter } from "@node/bin"
import { SaveRecord, type SaveRecordData } from "./SaveRecord"

export enum SimGridDataType {
  Float32 = 0x49b9e60a,
  SInt16 = 0x49b9e605,
  SInt8 = 0x49b9e603,
  UInt16 = 0x49b9e604,
  UInt32 = 0x49b9e606,
  UInt8 = 0x49b9e602,
}

export enum SimGridDataID {
  ZoneTypes = 0x41800000,
}

type SimGridArray<T extends SimGridDataType> = {
  [SimGridDataType.Float32]: Float32Array
  [SimGridDataType.SInt16]: Int16Array
  [SimGridDataType.SInt8]: Int8Array
  [SimGridDataType.UInt16]: Uint16Array
  [SimGridDataType.UInt32]: Uint32Array
  [SimGridDataType.UInt8]: Uint8Array
}[T]

const SimGridArrayConstructor: {
  [T in SimGridDataType]: { new (length: number): SimGridArray<T> }
} = {
  [SimGridDataType.Float32]: Float32Array,
  [SimGridDataType.SInt16]: Int16Array,
  [SimGridDataType.SInt8]: Int8Array,
  [SimGridDataType.UInt16]: Uint16Array,
  [SimGridDataType.UInt32]: Uint32Array,
  [SimGridDataType.UInt8]: Uint8Array,
}

interface SimGridData<T extends SimGridDataType> {
  dataId: SimGridDataID
  dataType: T
  major?: number
  resolution?: number
  size: number
  unknown1?: number
  unknown2?: number
  unknown3?: number
  unknown4?: number
  unknown5?: number
}

export class SimGrid<T extends SimGridDataType = SimGridDataType>
  extends SaveRecord
  implements SimGridData<T>
{
  public readonly data: SimGridArray<T>
  public readonly dataId: SimGridDataID
  public readonly dataType: T
  public readonly major: number
  public readonly resolution: number
  public readonly size: number
  public unknown1: number
  public unknown2: number
  public unknown3: number
  public unknown4: number
  public unknown5: number

  public constructor(data: SaveRecordData & SimGridData<T>) {
    super(data)
    this.dataId = data.dataId
    this.dataType = data.dataType
    this.major = data.major ?? 1
    this.resolution = data.resolution ?? 1
    this.size = data.size
    this.unknown1 = data.unknown1 ?? 0
    this.unknown2 = data.unknown2 ?? 0
    this.unknown3 = data.unknown3 ?? 0
    this.unknown4 = data.unknown4 ?? 0
    this.unknown5 = data.unknown5 ?? 0
    this.data = new SimGridArrayConstructor[this.dataType](this.size * this.size)
  }

  public get(x: number, z: number): number {
    return this.data[x * this.size + z]
  }

  public set(x: number, z: number, value: number): void {
    this.data[x * this.size + z] = value
  }

  public static getDataId(reader: BinaryReader): SimGridDataID {
    const offset = reader.offset
    const dataId = reader.readUInt32(19)
    reader.offset = offset
    return dataId
  }

  public static parse<T extends SimGridDataType>(
    header: SaveRecordData,
    reader: BinaryReader,
  ): SimGrid<T> {
    const major = reader.readUInt16()
    const unknown1 = reader.readUInt8()
    const dataType = reader.readUInt32() as T
    const dataId = reader.readUInt32() as SimGridDataID
    const resolution = reader.readUInt32()
    const resolutionExponent = reader.readUInt32()
    const sizeX = reader.readUInt32()
    const sizeZ = reader.readUInt32()
    const unknown2 = reader.readUInt32()
    const unknown3 = reader.readUInt32()
    const unknown4 = reader.readUInt32()
    const unknown5 = reader.readUInt32()

    if (2 ** resolutionExponent !== resolution) {
      throw Error("Mismatching SimGrid resolution")
    }

    if (sizeX !== sizeZ) {
      throw Error("Mismatching SimGrid size")
    }

    const subfile = new this({
      ...header,
      dataId,
      dataType,
      major,
      resolution,
      size: sizeX,
      unknown1,
      unknown2,
      unknown3,
      unknown4,
      unknown5,
    })

    const length = subfile.size * subfile.size
    const type = SimGridDataType[dataType] as keyof typeof SimGridDataType
    for (let i = 0; i < length; i++) {
      subfile.data[i] = reader[`read${type}`]()
    }

    return subfile
  }

  protected write(writer: BinaryWriter): void {
    writer.writeUInt16(this.major)
    writer.writeUInt8(this.unknown1)
    writer.writeUInt32(this.dataType)
    writer.writeUInt32(this.dataId)
    writer.writeUInt32(this.resolution)
    writer.writeUInt32(Math.log2(this.resolution))
    writer.writeUInt32(this.size)
    writer.writeUInt32(this.size)
    writer.writeUInt32(this.unknown2)
    writer.writeUInt32(this.unknown3)
    writer.writeUInt32(this.unknown4)
    writer.writeUInt32(this.unknown5)

    const length = this.size * this.size
    const type = SimGridDataType[this.dataType] as keyof typeof SimGridDataType
    for (let i = 0; i < length; i++) {
      writer[`write${type}`](this.data[i])
    }
  }
}
