import { forEach, isArray, size } from "@salinco/nice-utils"

import type { MaybeArray } from "@common/utils/types"
import type { BinaryReader, BinaryWriter } from "@node/bin"

export enum SavePropertyDataType {
  UInt8 = 0x01,
  UInt16 = 0x02,
  UInt32 = 0x03,
  SInt32 = 0x07,
  SInt64 = 0x08,
  Float32 = 0x09,
  Bool = 0x0b,
}

export enum SavePropertyKeyType {
  Single = 0x00,
  Multi = 0x80,
}

export type SaveProperties = {
  [id: number]: {
    type: SavePropertyDataType
    value: MaybeArray<boolean | number>
  }
}

export function parseProperties(reader: BinaryReader): SaveProperties {
  const properties: SaveProperties = {}

  const propertyCount = reader.readUInt32()
  for (let i = 0; i < propertyCount; i++) {
    const id = reader.readUInt32()
    if (reader.readUInt32() !== id) {
      throw Error("Mismatching SGPROP ID")
    }

    if (reader.readUInt32() !== 0) {
      throw Error("Invalid SGPROP")
    }

    const dataType = reader.readUInt8() as SavePropertyDataType
    const keyType = reader.readUInt8() as SavePropertyKeyType
    const type = SavePropertyDataType[dataType] as keyof typeof SavePropertyDataType

    if (reader.readUInt16() !== 0) {
      throw Error("Invalid SGPROP")
    }

    let value: MaybeArray<boolean | number>

    switch (keyType) {
      case SavePropertyKeyType.Single: {
        value = reader[`read${type}`]()

        break
      }

      case SavePropertyKeyType.Multi: {
        value = []

        const repCount = reader.readUInt32()
        for (let rep = 0; rep < repCount; rep++) {
          value.push(reader[`read${type}`]())
        }

        break
      }

      default: {
        throw Error(`Unexpected SGPROP key type: ${keyType}`)
      }
    }

    properties[id] = {
      type: dataType,
      value,
    }
  }

  return properties
}

export function writeProperties(writer: BinaryWriter, properties: SaveProperties): void {
  writer.writeUInt32(size(properties))

  forEach(properties, ({ type, value }, id) => {
    writer.writeUInt32(Number(id))
    writer.writeUInt32(Number(id))
    writer.writeUInt32(0)
    writer.writeUInt8(type)
    const fn = SavePropertyDataType[type] as Exclude<keyof typeof SavePropertyDataType, "Bool">

    if (isArray(value)) {
      writer.writeUInt8(SavePropertyKeyType.Multi)
      writer.writeUInt16(0)
      writer.writeUInt32(value.length)
      for (const rep of value) {
        writer[`write${fn}`](Number(rep))
      }
    } else {
      writer.writeUInt8(SavePropertyKeyType.Single)
      writer.writeUInt16(0)
      writer[`write${fn}`](Number(value))
    }
  })
}
