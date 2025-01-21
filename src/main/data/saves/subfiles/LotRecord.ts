import { keys, sum, sumBy } from "@salinco/nice-utils"

import type { RCIType } from "@common/lots"
import type { Binary } from "@node/bin"
import { type DeveloperID, WealthType, ZoneType } from "@node/dbpf/types"
import { DeveloperIDToRCIType } from "../constants"
import { type SaveProperties, parseProperties, writeProperties } from "./SaveProperties"
import { SaveRecord, type SaveRecordData } from "./SaveRecord"

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

  public static parse(header: SaveRecordData, bytes: Binary): LotRecord {
    const major = bytes.readUInt16()
    const lotId = bytes.readUInt32() || null
    const flags1 = bytes.readUInt8()
    const minX = bytes.readUInt8()
    const minZ = bytes.readUInt8()
    const maxX = bytes.readUInt8()
    const maxZ = bytes.readUInt8()
    const commuteX = bytes.readUInt8()
    const commuteZ = bytes.readUInt8()
    const originY = bytes.readFloat32()
    const slopeY1 = bytes.readFloat32()
    const slopeY2 = bytes.readFloat32()
    const sizeX = bytes.readUInt8()
    const sizeZ = bytes.readUInt8()
    const orientation = bytes.readUInt8()
    const flags2 = bytes.readUInt8()
    const flags3 = bytes.readUInt8()
    const zoneType = bytes.readUInt8() as ZoneType
    const wealth = bytes.readUInt8() || null
    const date = bytes.readUInt32()
    const buildingId = bytes.readUInt32() || null
    const unknown1 = bytes.readUInt8()

    const linkedIndustrial = this.parseRef(bytes, 0x4a232da8)
    const linkedAnchor = this.parseRef(bytes, 0xc9bd5d4a)

    const capacity: LotRecord["capacity"] = {}
    const capacityCount = bytes.readUInt8()
    for (let i = 0; i < capacityCount; i++) {
      const rciCTypeCount = bytes.readUInt8()
      for (let j = 0; j < rciCTypeCount; j++) {
        const developerId = bytes.readUInt32() as DeveloperID
        capacity[developerId] = bytes.readUInt16()
      }
    }

    const totalCapacity: LotRecord["totalCapacity"] = {}
    const rciCTypeCount = bytes.readUInt8()
    for (let i = 0; i < rciCTypeCount; i++) {
      const developerId = bytes.readUInt32() as DeveloperID
      totalCapacity[developerId] = bytes.readUInt16()
    }

    const totalJobs: LotRecord["totalJobs"] = {
      [WealthType.$]: bytes.readFloat32(),
      [WealthType.$$]: bytes.readFloat32(),
      [WealthType.$$$]: bytes.readFloat32(),
    }

    const unknown2 = bytes.readUInt16()

    const properties = parseProperties(bytes)

    const commutes: Commute[] = []
    const commutesCount = bytes.readUInt32()
    for (let i = 0; i < commutesCount; i++) {
      const paths: Commute["paths"] = []
      const pathsCount = bytes.readUInt32()

      for (let j = 0; j < pathsCount; j++) {
        const pathLen = bytes.readUInt32()
        if (pathLen === 0) {
          paths.push(null)
          continue
        }

        const pathEnd = bytes.offset + pathLen
        const startType = bytes.readUInt8() as CommuteTrafficType
        const startX = bytes.readUInt8()
        const startZ = bytes.readUInt8()

        const parts: NonNullable<Commute["paths"][number]>["parts"] = []
        while (bytes.offset < pathEnd) {
          const switchType = bytes.readUInt8() as CommuteTrafficType
          const directions: CommutePathDirection[] = []
          const directionsCount = bytes.readUInt8()
          for (let k = 0; k < directionsCount / 4; k++) {
            const byte = bytes.readUInt8()
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

      const commuters = bytes.readUInt32()
      const unknown1 = bytes.readUInt32()
      const destinationX = bytes.readSInt16()
      const destinationZ = bytes.readSInt16()
      const tripLength = bytes.readFloat32()
      const unknown2 = bytes.readUInt32()

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

    const unknown3 = bytes.readUInt8()

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

  public override write(bytes: Binary): void {
    bytes.writeUInt16(this.major)
    bytes.writeUInt32(this.lotId ?? 0)
    bytes.writeUInt8(this.flags1)
    bytes.writeUInt8(this.minX)
    bytes.writeUInt8(this.minZ)
    bytes.writeUInt8(this.maxX)
    bytes.writeUInt8(this.maxZ)
    bytes.writeUInt8(this.commuteX)
    bytes.writeUInt8(this.commuteZ)
    bytes.writeFloat32(this.originY)
    bytes.writeFloat32(this.slopeY1)
    bytes.writeFloat32(this.slopeY2)
    bytes.writeUInt8(this.sizeX)
    bytes.writeUInt8(this.sizeZ)
    bytes.writeUInt8(this.orientation)
    bytes.writeUInt8(this.flags2)
    bytes.writeUInt8(this.flags3)
    bytes.writeUInt8(this.zoneType)
    bytes.writeUInt8(this.wealth ?? 0)
    bytes.writeUInt32(this.date)
    bytes.writeUInt32(this.buildingId ?? 0)
    bytes.writeUInt8(this.unknown1)

    this.writeRef(bytes, this.linkedIndustrial, 0x4a232da8)
    this.writeRef(bytes, this.linkedAnchor, 0xc9bd5d4a)

    const capacity = Object.entries(this.capacity)
    if (capacity.length) {
      bytes.writeUInt8(1)
      bytes.writeUInt8(capacity.length)
      for (const [type, value] of capacity) {
        bytes.writeUInt32(Number(type))
        bytes.writeUInt16(value)
      }
    } else {
      bytes.writeUInt8(0)
    }

    const totalCapacity = Object.entries(this.totalCapacity)
    bytes.writeUInt8(totalCapacity.length)
    for (const [type, value] of totalCapacity) {
      bytes.writeUInt32(Number(type))
      bytes.writeUInt16(value)
    }

    bytes.writeFloat32(this.totalJobs[WealthType.$] ?? 0)
    bytes.writeFloat32(this.totalJobs[WealthType.$$] ?? 0)
    bytes.writeFloat32(this.totalJobs[WealthType.$$$] ?? 0)

    bytes.writeUInt16(this.unknown2)

    writeProperties(bytes, this.properties)

    bytes.writeUInt32(this.commutes.length)
    for (const commute of this.commutes) {
      bytes.writeUInt32(commute.paths.length)
      for (const path of commute.paths) {
        if (path) {
          bytes.writeUInt32(
            3 + sumBy(path.parts, part => 2 + Math.ceil(part.directions.length / 4)),
          )

          bytes.writeUInt8(path.startType)
          bytes.writeUInt8(path.startX)
          bytes.writeUInt8(path.startZ)

          for (const part of path.parts) {
            bytes.writeUInt8(part.type)
            bytes.writeUInt8(part.directions.length)
            for (let k = 0; k < part.directions.length / 4; k++) {
              bytes.writeUInt8(
                sum(part.directions.slice(k * 4, k * 4 + 4).map((v, n) => v << (n * 2))),
              )
            }
          }
        } else {
          bytes.writeUInt32(0)
        }
      }

      bytes.writeUInt32(commute.commuters)
      bytes.writeUInt32(commute.unknown1)
      bytes.writeSInt16(commute.destinationX)
      bytes.writeSInt16(commute.destinationZ)
      bytes.writeFloat32(commute.tripLength)
      bytes.writeUInt32(commute.unknown2)
    }

    bytes.writeUInt8(this.unknown3)
  }

  public isHistorical(): boolean {
    return !!(this.flags1 & LotFlagByte1.Historical)
  }

  public isPlop(): boolean {
    return this.zoneType === ZoneType.Landmark
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
