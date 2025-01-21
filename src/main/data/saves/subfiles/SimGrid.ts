import type { Binary } from "@node/bin"
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

  public static getDataId(record: Binary): SimGridDataID {
    const offset = record.offset
    const dataId = record.readUInt32(19)
    record.offset = offset
    return dataId
  }

  public static parse<T extends SimGridDataType>(
    header: SaveRecordData,
    record: Binary,
  ): SimGrid<T> {
    const major = record.readUInt16()
    const unknown1 = record.readUInt8()
    const dataType = record.readUInt32() as T
    const dataId = record.readUInt32() as SimGridDataID
    const resolution = record.readUInt32()
    const resolutionExponent = record.readUInt32()
    const sizeX = record.readUInt32()
    const sizeZ = record.readUInt32()
    const unknown2 = record.readUInt32()
    const unknown3 = record.readUInt32()
    const unknown4 = record.readUInt32()
    const unknown5 = record.readUInt32()

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
      subfile.data[i] = record[`read${type}`]()
    }

    return subfile
  }

  protected write(bytes: Binary): void {
    bytes.writeUInt16(this.major)
    bytes.writeUInt8(this.unknown1)
    bytes.writeUInt32(this.dataType)
    bytes.writeUInt32(this.dataId)
    bytes.writeUInt32(this.resolution)
    bytes.writeUInt32(Math.log2(this.resolution))
    bytes.writeUInt32(this.size)
    bytes.writeUInt32(this.size)
    bytes.writeUInt32(this.unknown2)
    bytes.writeUInt32(this.unknown3)
    bytes.writeUInt32(this.unknown4)
    bytes.writeUInt32(this.unknown5)

    const length = this.size * this.size
    const type = SimGridDataType[this.dataType] as keyof typeof SimGridDataType
    for (let i = 0; i < length; i++) {
      bytes[`write${type}`](this.data[i])
    }
  }
}
