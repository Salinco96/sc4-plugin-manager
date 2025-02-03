import { keys, sum, sumBy } from "@salinco/nice-utils"

import type { RCIType } from "@common/lots"
import type { BinaryReader, BinaryWriter } from "@node/bin"
import { type DeveloperID, WealthType, ZoneType } from "@node/dbpf/types"

import { DeveloperIDToRCIType } from "../constants"
import { type SaveProperties, parseProperties, writeProperties } from "./SaveProperties"
import { SaveRecord, type SaveRecordData } from "./SaveRecord"
import { SaveSubfileType } from "./SaveSubfile"

enum LotFlagByte1 {
  Watered = 0x08,
  Powered = 0x10,
  Historical = 0x20,
}

interface Commute {
  commuters: number // uint32
  destinationX: number // sint16
  destinationZ: number // sint16
  paths: Array<CommutePath | null>
  tripLength: number // float32
  unknown1: number // uint32
  unknown2: number // uint32
}

interface CommutePath {
  parts: CommutePathPart[]
  startType: CommuteTrafficType // uint8
  startX: number // uint8
  startZ: number // uint8
}

interface CommutePathPart {
  directions: CommutePathDirection[] // 4 two-bit directions per byte, last byte 0-padded as needed
  type: CommuteTrafficType // uint8
}

export enum CommutePathDirection {
  West = 0x00,
  North = 0x01,
  East = 0x02,
  South = 0x03,
}

export enum CommuteTrafficType {
  Walk = 0x00,
  Car = 0x01,
  Bus = 0x02,
  PassengerTrain = 0x03,
  FreightTruck = 0x04,
  FreightTrain = 0x05,
  Subway = 0x06,
  LightRail = 0x07,
  Monorail = 0x08,
}

interface LotRecordData extends SaveRecordData {
  buildingId?: number | null
  capacity?: { [developer in DeveloperID]?: number }
  commuteX?: number
  commuteZ?: number
  commutes?: Commute[]
  date?: number
  flags1?: number
  flags2?: number
  flags3?: number
  linkedAnchor?: number | null
  linkedIndustrial?: number | null
  lotId?: number | null
  major?: number
  maxX?: number
  maxZ?: number
  minX?: number
  minZ?: number
  orientation?: number
  originY?: number
  properties?: SaveProperties
  sizeX?: number
  sizeZ?: number
  slopeY1?: number
  slopeY2?: number
  wealth?: number | null
  totalCapacity?: { [developer in DeveloperID]?: number }
  totalJobs?: { [wealth in WealthType]?: number }
  unknown1?: number
  unknown2?: number
  unknown3?: number
  zoneType: ZoneType
}

export class LotRecord extends SaveRecord implements LotRecordData {
  public buildingId: number | null
  public capacity: { [developer in DeveloperID]?: number }
  public commuteX: number
  public commuteZ: number
  public commutes: Commute[]
  public date: number
  public flags1: number
  public flags2: number
  public flags3: number
  public linkedAnchor: number | null
  public linkedIndustrial: number | null
  public lotId: number | null
  public readonly major: number
  public maxX: number
  public maxZ: number
  public minX: number
  public minZ: number
  public orientation: number
  public originY: number
  public properties: SaveProperties
  public sizeX: number
  public sizeZ: number
  public slopeY1: number
  public slopeY2: number
  public wealth: number | null
  public totalCapacity: { [developer in DeveloperID]?: number }
  public totalJobs: { [wealth in WealthType]?: number }
  public unknown1: number
  public unknown2: number
  public unknown3: number
  public zoneType: ZoneType

  public constructor(data: LotRecordData) {
    super(data)
    this.buildingId = data.buildingId ?? null
    this.capacity = data.capacity ?? {}
    this.commuteX = data.commuteX ?? 0
    this.commuteZ = data.commuteZ ?? 0
    this.commutes = data.commutes ?? []
    this.date = data.date ?? 0
    this.flags1 = data.flags1 ?? 0
    this.flags2 = data.flags2 ?? 0
    this.flags3 = data.flags3 ?? 0
    this.linkedAnchor = data.linkedAnchor ?? null
    this.linkedIndustrial = data.linkedIndustrial ?? null
    this.lotId = data.lotId ?? null
    this.major = data.major ?? 8
    this.maxX = data.maxX ?? 0
    this.maxZ = data.maxZ ?? 0
    this.minX = data.minX ?? 0
    this.minZ = data.minZ ?? 0
    this.orientation = data.orientation ?? 0
    this.originY = data.originY ?? 270
    this.properties = data.properties ?? {}
    this.sizeX = data.sizeX ?? 1
    this.sizeZ = data.sizeZ ?? 1
    this.slopeY1 = data.slopeY1 ?? 0
    this.slopeY2 = data.slopeY2 ?? 0
    this.totalCapacity = data.totalCapacity ?? {}
    this.totalJobs = data.totalJobs ?? {}
    this.unknown1 = data.unknown1 ?? 0
    this.unknown2 = data.unknown2 ?? 0
    this.unknown3 = data.unknown3 ?? 0
    this.wealth = data.wealth ?? null
    this.zoneType = data.zoneType
  }

  public static parse(header: SaveRecordData, reader: BinaryReader): LotRecord {
    const major = reader.readUInt16()
    const lotId = reader.readUInt32() || null
    const flags1 = reader.readUInt8()
    const minX = reader.readUInt8()
    const minZ = reader.readUInt8()
    const maxX = reader.readUInt8()
    const maxZ = reader.readUInt8()
    const commuteX = reader.readUInt8()
    const commuteZ = reader.readUInt8()
    const originY = reader.readFloat32()
    const slopeY1 = reader.readFloat32()
    const slopeY2 = reader.readFloat32()
    const sizeX = reader.readUInt8()
    const sizeZ = reader.readUInt8()
    const orientation = reader.readUInt8()
    const flags2 = reader.readUInt8()
    const flags3 = reader.readUInt8()
    const zoneType = reader.readUInt8() as ZoneType
    const wealth = reader.readUInt8() || null
    const date = reader.readUInt32()
    const buildingId = reader.readUInt32() || null
    const unknown1 = reader.readUInt8()

    const linkedIndustrial = this.parseRef(reader, 0x4a232da8)
    const linkedAnchor = this.parseRef(reader, SaveSubfileType.Lots)

    const capacity: LotRecord["capacity"] = {}
    const capacityCount = reader.readUInt8()
    for (let i = 0; i < capacityCount; i++) {
      const rciCTypeCount = reader.readUInt8()
      for (let j = 0; j < rciCTypeCount; j++) {
        const developerId = reader.readUInt32() as DeveloperID
        capacity[developerId] = reader.readUInt16()
      }
    }

    const totalCapacity: LotRecord["totalCapacity"] = {}
    const rciCTypeCount = reader.readUInt8()
    for (let i = 0; i < rciCTypeCount; i++) {
      const developerId = reader.readUInt32() as DeveloperID
      totalCapacity[developerId] = reader.readUInt16()
    }

    const totalJobs: LotRecord["totalJobs"] = {
      [WealthType.$]: reader.readFloat32(),
      [WealthType.$$]: reader.readFloat32(),
      [WealthType.$$$]: reader.readFloat32(),
    }

    const unknown2 = reader.readUInt16()

    const properties = parseProperties(reader)

    const commutes: Commute[] = []
    const commutesCount = reader.readUInt32()
    for (let i = 0; i < commutesCount; i++) {
      const paths: Commute["paths"] = []
      const pathsCount = reader.readUInt32()

      for (let j = 0; j < pathsCount; j++) {
        const pathLen = reader.readUInt32()
        if (pathLen === 0) {
          paths.push(null)
          continue
        }

        const pathEnd = reader.offset + pathLen
        const startType = reader.readUInt8() as CommuteTrafficType
        const startX = reader.readUInt8()
        const startZ = reader.readUInt8()

        const parts: NonNullable<Commute["paths"][number]>["parts"] = []
        while (reader.offset < pathEnd) {
          const switchType = reader.readUInt8() as CommuteTrafficType
          const directions: CommutePathDirection[] = []
          const directionsCount = reader.readUInt8()
          for (let k = 0; k < directionsCount / 4; k++) {
            const byte = reader.readUInt8()
            for (let n = 0; n < 4; n++) {
              const direction = (byte >> (n * 2)) & 0x03
              if (k * 4 + n < directionsCount) {
                directions.push(direction as CommutePathDirection)
              } else if (direction !== 0) {
                throw Error("Expected padding to be 0")
              }
            }
          }

          parts.push({
            directions,
            type: switchType,
          })
        }

        paths.push({
          parts,
          startType,
          startX,
          startZ,
        })
      }

      const commuters = reader.readUInt32()
      const unknown1 = reader.readUInt32()
      const destinationX = reader.readSInt16()
      const destinationZ = reader.readSInt16()
      const tripLength = reader.readFloat32()
      const unknown2 = reader.readUInt32()

      commutes.push({
        commuters,
        destinationX,
        destinationZ,
        paths,
        tripLength,
        unknown1,
        unknown2,
      })
    }

    const unknown3 = reader.readUInt8()

    return new LotRecord({
      ...header,
      buildingId,
      capacity,
      commuteX,
      commuteZ,
      commutes,
      date,
      flags1,
      flags2,
      flags3,
      linkedAnchor,
      linkedIndustrial,
      lotId,
      major,
      maxX,
      maxZ,
      minX,
      minZ,
      orientation,
      originY,
      properties,
      sizeX,
      sizeZ,
      slopeY1,
      slopeY2,
      totalCapacity,
      totalJobs,
      unknown1,
      unknown2,
      unknown3,
      wealth,
      zoneType,
    })
  }

  public override write(writer: BinaryWriter): void {
    writer.writeUInt16(this.major)
    writer.writeUInt32(this.lotId ?? 0)
    writer.writeUInt8(this.flags1)
    writer.writeUInt8(this.minX)
    writer.writeUInt8(this.minZ)
    writer.writeUInt8(this.maxX)
    writer.writeUInt8(this.maxZ)
    writer.writeUInt8(this.commuteX)
    writer.writeUInt8(this.commuteZ)
    writer.writeFloat32(this.originY)
    writer.writeFloat32(this.slopeY1)
    writer.writeFloat32(this.slopeY2)
    writer.writeUInt8(this.sizeX)
    writer.writeUInt8(this.sizeZ)
    writer.writeUInt8(this.orientation)
    writer.writeUInt8(this.flags2)
    writer.writeUInt8(this.flags3)
    writer.writeUInt8(this.zoneType)
    writer.writeUInt8(this.wealth ?? 0)
    writer.writeUInt32(this.date)
    writer.writeUInt32(this.buildingId ?? 0)
    writer.writeUInt8(this.unknown1)

    this.writeRef(writer, this.linkedIndustrial, 0x4a232da8)
    this.writeRef(writer, this.linkedAnchor, 0xc9bd5d4a)

    const capacity = Object.entries(this.capacity)
    if (capacity.length) {
      writer.writeUInt8(1)
      writer.writeUInt8(capacity.length)
      for (const [type, value] of capacity) {
        writer.writeUInt32(Number(type))
        writer.writeUInt16(value)
      }
    } else {
      writer.writeUInt8(0)
    }

    const totalCapacity = Object.entries(this.totalCapacity)
    writer.writeUInt8(totalCapacity.length)
    for (const [type, value] of totalCapacity) {
      writer.writeUInt32(Number(type))
      writer.writeUInt16(value)
    }

    writer.writeFloat32(this.totalJobs[WealthType.$] ?? 0)
    writer.writeFloat32(this.totalJobs[WealthType.$$] ?? 0)
    writer.writeFloat32(this.totalJobs[WealthType.$$$] ?? 0)

    writer.writeUInt16(this.unknown2)

    writeProperties(writer, this.properties)

    writer.writeUInt32(this.commutes.length)
    for (const commute of this.commutes) {
      writer.writeUInt32(commute.paths.length)
      for (const path of commute.paths) {
        if (path) {
          writer.writeUInt32(
            3 + sumBy(path.parts, part => 2 + Math.ceil(part.directions.length / 4)),
          )

          writer.writeUInt8(path.startType)
          writer.writeUInt8(path.startX)
          writer.writeUInt8(path.startZ)

          for (const part of path.parts) {
            writer.writeUInt8(part.type)
            writer.writeUInt8(part.directions.length)
            for (let k = 0; k < part.directions.length / 4; k++) {
              writer.writeUInt8(
                sum(part.directions.slice(k * 4, k * 4 + 4).map((v, n) => v << (n * 2))),
              )
            }
          }
        } else {
          writer.writeUInt32(0)
        }
      }

      writer.writeUInt32(commute.commuters)
      writer.writeUInt32(commute.unknown1)
      writer.writeSInt16(commute.destinationX)
      writer.writeSInt16(commute.destinationZ)
      writer.writeFloat32(commute.tripLength)
      writer.writeUInt32(commute.unknown2)
    }

    writer.writeUInt8(this.unknown3)
  }

  public isHistorical(): boolean {
    return !!(this.flags1 & LotFlagByte1.Historical)
  }

  public isPlop(): boolean {
    return this.zoneType === ZoneType.Plopped
  }

  public isGrowifyable(rciType: RCIType): boolean {
    return (
      this.isPlop() &&
      keys(this.capacity).some(developer => rciType.includes(DeveloperIDToRCIType[developer]))
    )
  }

  public makeHistorical(): void {
    if (!this.isHistorical()) {
      this.flags1 |= LotFlagByte1.Historical
      this.dirty()
    }
  }
}
