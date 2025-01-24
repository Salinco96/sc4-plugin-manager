import { toHex } from "@salinco/nice-utils"

import { TGI, TypeID, parseTGI } from "@common/dbpf"
import type { Binary } from "@node/bin"

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

  public static parse(header: SaveRecordData, bytes: Binary): BuildingRecord {
    const major = bytes.readUInt16()
    const minor = bytes.readUInt16()
    const zot = bytes.readUInt16()
    const unknown1 = bytes.readUInt8()
    const appearance = bytes.readUInt8()
    const unknown2 = bytes.readUInt32()
    const minTractX = bytes.readUInt8()
    const minTractZ = bytes.readUInt8()
    const maxTractX = bytes.readUInt8()
    const maxTractZ = bytes.readUInt8()
    const tractSizeX = bytes.readUInt16()
    const tractSizeZ = bytes.readUInt16()
    const properties = parseProperties(bytes)
    const groupId = bytes.readUInt32()
    const typeId = bytes.readUInt32()
    const instanceId = bytes.readUInt32()
    const buildingId = bytes.readUInt32()
    const unknown3 = bytes.readUInt8()
    const minX = bytes.readFloat32()
    const minY = bytes.readFloat32()
    const minZ = bytes.readFloat32()
    const maxX = bytes.readFloat32()
    const maxY = bytes.readFloat32()
    const maxZ = bytes.readFloat32()
    const orientation = bytes.readUInt8()
    const scaffoldingHeight = bytes.readFloat32()

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

  public override write(bytes: Binary): void {
    const [typeId, groupId, instanceId] = parseTGI(this.tgi)

    bytes.writeUInt16(this.major)
    bytes.writeUInt16(this.minor)
    bytes.writeUInt16(this.zot)
    bytes.writeUInt8(this.unknown1)
    bytes.writeUInt8(this.appearance)
    bytes.writeUInt32(this.unknown2)
    bytes.writeUInt8(this.minTractX)
    bytes.writeUInt8(this.minTractZ)
    bytes.writeUInt8(this.maxTractX)
    bytes.writeUInt8(this.maxTractZ)
    bytes.writeUInt16(this.tractSize)
    bytes.writeUInt16(this.tractSize)
    writeProperties(bytes, this.properties)
    bytes.writeUInt32(groupId)
    bytes.writeUInt32(typeId)
    bytes.writeUInt32(instanceId)
    bytes.writeUInt32(this.buildingId)
    bytes.writeUInt8(this.unknown3)
    bytes.writeFloat32(this.minX)
    bytes.writeFloat32(this.minY)
    bytes.writeFloat32(this.minZ)
    bytes.writeFloat32(this.maxX)
    bytes.writeFloat32(this.maxY)
    bytes.writeFloat32(this.maxZ)
    bytes.writeUInt8(this.orientation)
    bytes.writeFloat32(this.scaffoldingHeight)
  }
}
