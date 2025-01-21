import { forEach, isArray, size } from "@salinco/nice-utils"

import type { MaybeArray } from "@common/utils/types"
import type { Binary } from "@node/bin"

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

export function parseProperties(bytes: Binary): SaveProperties {
  const properties: SaveProperties = {}

  const propertyCount = bytes.readUInt32()
  for (let i = 0; i < propertyCount; i++) {
    const id = bytes.readUInt32()
    if (bytes.readUInt32() !== id) {
      throw Error("Mismatching SGPROP ID")
    }

    if (bytes.readUInt32() !== 0) {
      throw Error("Invalid SGPROP")
    }

    const dataType = bytes.readUInt8() as SavePropertyDataType
    const keyType = bytes.readUInt8() as SavePropertyKeyType
    const type = SavePropertyDataType[dataType] as keyof typeof SavePropertyDataType

    if (bytes.readUInt16() !== 0) {
      throw Error("Invalid SGPROP")
    }

    let value: MaybeArray<boolean | number>

    switch (keyType) {
      case SavePropertyKeyType.Single: {
        value = bytes[`read${type}`]()

        break
      }

      case SavePropertyKeyType.Multi: {
        value = []

        const repCount = bytes.readUInt32()
        for (let rep = 0; rep < repCount; rep++) {
          value.push(bytes[`read${type}`]())
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

export function writeProperties(bytes: Binary, properties: SaveProperties): void {
  bytes.writeUInt32(size(properties))

  forEach(properties, ({ type, value }, id) => {
    bytes.writeUInt32(Number(id))
    bytes.writeUInt32(Number(id))
    bytes.writeUInt32(0)
    bytes.writeUInt8(type)
    const fn = SavePropertyDataType[type] as Exclude<keyof typeof SavePropertyDataType, "Bool">

    if (isArray(value)) {
      bytes.writeUInt8(SavePropertyKeyType.Multi)
      bytes.writeUInt16(0)
      bytes.writeUInt32(value.length)
      for (const rep of value) {
        bytes[`write${fn}`](Number(rep))
      }
    } else {
      bytes.writeUInt8(SavePropertyKeyType.Single)
      bytes.writeUInt16(0)
      bytes[`write${fn}`](Number(value))
    }
  })
}
