import { toHex } from "@salinco/nice-utils"

import { TGI, TypeID, parseTGI } from "@common/dbpf"
import type { BinaryReader, BinaryWriter } from "@node/bin"

import { type SaveProperties, parseProperties, writeProperties } from "./SaveProperties"
import { SaveRecord, type SaveRecordData } from "./SaveRecord"

interface BuildingRecordData extends SaveRecordData {
  appearance: number
  buildingId: number
  major: number
  maxTractX: number
  maxTractZ: number
  maxX: number
  maxY: number
  maxZ: number
  minor: number
  minTractX: number
  minTractZ: number
  minX: number
  minY: number
  minZ: number
  orientation: number
  properties: SaveProperties
  scaffoldingHeight: number
  tgi: TGI
  tractSize: number
  unknown1: number
  unknown2: number
  unknown3: number
  zot: number
}

export class BuildingRecord extends SaveRecord implements BuildingRecordData {
  public appearance: number
  public buildingId: number
  public readonly major: number
  public maxTractX: number
  public maxTractZ: number
  public maxX: number
  public maxY: number
  public maxZ: number
  public readonly minor: number
  public minTractX: number
  public minTractZ: number
  public minX: number
  public minY: number
  public minZ: number
  public orientation: number
  public properties: SaveProperties
  public scaffoldingHeight: number
  public tgi: TGI
  public tractSize: number
  public unknown1: number
  public unknown2: number
  public unknown3: number
  public zot: number

  public constructor(data: BuildingRecordData) {
    super(data)
    this.appearance = data.appearance
    this.buildingId = data.buildingId
    this.major = data.major
    this.maxTractX = data.maxTractX
    this.maxTractZ = data.maxTractZ
    this.maxX = data.maxX
    this.maxY = data.maxY
    this.maxZ = data.maxZ
    this.minor = data.minor
    this.minTractX = data.minTractX
    this.minTractZ = data.minTractZ
    this.minX = data.minX
    this.minY = data.minY
    this.minZ = data.minZ
    this.orientation = data.orientation
    this.properties = data.properties
    this.scaffoldingHeight = data.scaffoldingHeight
    this.tgi = data.tgi
    this.tractSize = data.tractSize
    this.unknown1 = data.unknown1
    this.unknown2 = data.unknown2
    this.unknown3 = data.unknown3
    this.zot = data.zot
  }

  public static parse(header: SaveRecordData, reader: BinaryReader): BuildingRecord {
    const major = reader.readUInt16()
    const minor = reader.readUInt16()
    const zot = reader.readUInt16()
    const unknown1 = reader.readUInt8()
    const appearance = reader.readUInt8()
    const unknown2 = reader.readUInt32()
    const minTractX = reader.readUInt8()
    const minTractZ = reader.readUInt8()
    const maxTractX = reader.readUInt8()
    const maxTractZ = reader.readUInt8()
    const tractSizeX = reader.readUInt16()
    const tractSizeZ = reader.readUInt16()
    const properties = parseProperties(reader)
    const groupId = reader.readUInt32()
    const typeId = reader.readUInt32()
    const instanceId = reader.readUInt32()
    const buildingId = reader.readUInt32()
    const unknown3 = reader.readUInt8()
    const minX = reader.readFloat32()
    const minY = reader.readFloat32()
    const minZ = reader.readFloat32()
    const maxX = reader.readFloat32()
    const maxY = reader.readFloat32()
    const maxZ = reader.readFloat32()
    const orientation = reader.readUInt8()
    const scaffoldingHeight = reader.readFloat32()

    if (toHex(typeId, 8) !== TypeID.EXEMPLAR) {
      throw Error(`Unexpected type ID: 0x${toHex(typeId, 8)}`)
    }

    if (tractSizeX !== tractSizeZ || !Number.isInteger(Math.log2(tractSizeX))) {
      throw Error(`Invalid tract size: ${tractSizeX}x${tractSizeZ}`)
    }

    if (instanceId !== buildingId) {
      throw Error(`Mismatching instance ID: 0x${toHex(instanceId, 8)} vs 0x${toHex(buildingId, 8)}`)
    }

    return new BuildingRecord({
      ...header,
      appearance,
      buildingId,
      major,
      maxTractX,
      maxTractZ,
      maxX,
      maxY,
      maxZ,
      minor,
      minTractX,
      minTractZ,
      minX,
      minY,
      minZ,
      orientation,
      properties,
      scaffoldingHeight,
      tgi: TGI(typeId, groupId, instanceId),
      tractSize: tractSizeX,
      unknown1,
      unknown2,
      unknown3,
      zot,
    })
  }

  public override write(writer: BinaryWriter): void {
    const [typeId, groupId, instanceId] = parseTGI(this.tgi)

    writer.writeUInt16(this.major)
    writer.writeUInt16(this.minor)
    writer.writeUInt16(this.zot)
    writer.writeUInt8(this.unknown1)
    writer.writeUInt8(this.appearance)
    writer.writeUInt32(this.unknown2)
    writer.writeUInt8(this.minTractX)
    writer.writeUInt8(this.minTractZ)
    writer.writeUInt8(this.maxTractX)
    writer.writeUInt8(this.maxTractZ)
    writer.writeUInt16(this.tractSize)
    writer.writeUInt16(this.tractSize)
    writeProperties(writer, this.properties)
    writer.writeUInt32(groupId)
    writer.writeUInt32(typeId)
    writer.writeUInt32(instanceId)
    writer.writeUInt32(this.buildingId)
    writer.writeUInt8(this.unknown3)
    writer.writeFloat32(this.minX)
    writer.writeFloat32(this.minY)
    writer.writeFloat32(this.minZ)
    writer.writeFloat32(this.maxX)
    writer.writeFloat32(this.maxY)
    writer.writeFloat32(this.maxZ)
    writer.writeUInt8(this.orientation)
    writer.writeFloat32(this.scaffoldingHeight)
  }
}
