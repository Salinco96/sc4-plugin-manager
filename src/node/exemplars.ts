import { forEach, isArray, isString, parseHex, toHex, values } from "@salinco/nice-utils"

import { TGI, TypeID } from "@common/dbpf"
import {
  type ExemplarData,
  type ExemplarDataPatch,
  type ExemplarProperties,
  type ExemplarProperty,
  type ExemplarPropertyValue,
  ExemplarValueType,
  PropertyKeyType,
} from "@common/exemplars"

import { BinaryReader, BinaryWriter } from "./bin"

export function loadExemplar(tgi: TGI, bytes: Buffer): ExemplarData {
  const isCohort = tgi.startsWith(TypeID.COHORT)
  const reader = new BinaryReader(bytes)

  let parentCohortId = TGI(0, 0, 0)

  const properties: { [propertyId in number]?: ExemplarProperty } = {}
  const mode = reader.readString(8)

  switch (mode.slice(0, 4)) {
    // "B" = binary
    case "CQZB":
    case "EQZB": {
      parentCohortId = reader.readTGI()

      const propertyCount = reader.readUInt32()

      for (let i = 0; i < propertyCount; i++) {
        const propertyId = reader.readUInt32()
        const valueType = reader.readUInt16()
        const keyType = reader.readUInt16()
        const unused = reader.readUInt8()

        switch (keyType) {
          case PropertyKeyType.Single: {
            if (unused !== 0) {
              throw Error(`Unexpected unused: 0x${toHex(unused, 2)}`)
            }

            properties[propertyId] = {
              id: propertyId,
              type: valueType,
              value: reader.readValue(valueType),
            } as ExemplarProperty

            break
          }

          case PropertyKeyType.Multi: {
            const reps = reader.readUInt32()

            properties[propertyId] = {
              id: propertyId,
              type: valueType,
              value: reader.readValues(valueType, reps),
            } as ExemplarProperty

            break
          }

          default: {
            throw Error(`Unexpected keyType: 0x${toHex(keyType, 4)}`)
          }
        }
      }

      break
    }

    // "T" = text
    case "CQZT":
    case "EQZT": {
      const parentCohortRegex =
        /^ParentCohort=Key:\{0x([0-9a-f]{8}),0x([0-9a-f]{8}),0x([0-9a-f]{8})\}$/i
      const propertyRegex = /^0x([0-9a-f]{8}):\{"(.+)"\}=(\w+):(\d+):\{(.+)\}$/i

      for (const row of reader.toString().split("\n")) {
        const parentCohortMatch = row.trim().match(parentCohortRegex)
        if (parentCohortMatch) {
          parentCohortId = TGI(
            parseHex(parentCohortMatch[1]),
            parseHex(parentCohortMatch[2]),
            parseHex(parentCohortMatch[3]),
          )
        } else {
          const propertyMatch = row.trim().match(propertyRegex)
          if (propertyMatch) {
            const propertyId = parseHex(propertyMatch[1])
            // const name = propertyMatch[2]
            const rawType = propertyMatch[3].replace("int", "Int")
            const rawValue = propertyMatch[5]

            const valueType = ExemplarValueType[rawType as keyof typeof ExemplarValueType]

            let value: ExemplarPropertyValue | undefined

            switch (valueType) {
              case ExemplarValueType.String: {
                value = rawValue.match(/^"(.+)"$/)?.[1]
                break
              }

              case ExemplarValueType.Bool: {
                value = rawValue === "True"
                break
              }

              default: {
                value = rawValue.split(",").map(Number)
              }
            }

            properties[propertyId] = {
              id: propertyId,
              type: valueType,
              value,
            } as ExemplarProperty
          }
        }
      }

      break
    }

    default: {
      throw Error(`Unexpected mode: ${mode}`)
    }
  }

  return {
    isCohort,
    parentCohort: parentCohortId,
    properties,
  }
}

export function patchExemplar(
  original: ExemplarData,
  patch: ExemplarDataPatch,
  exemplarProperties: ExemplarProperties,
): ExemplarData {
  // Make a copy (do not mutate the original)
  const patched: ExemplarData = { ...original, properties: { ...original.properties } }

  // Patch parent cohort
  if (patch.parentCohort !== undefined) {
    patched.parentCohort = patch.parentCohort ?? TGI(0, 0, 0)
  }

  // Patch properties
  if (patch.properties) {
    forEach(patch.properties, (value, propertyIdHex) => {
      const propertyId = parseHex(propertyIdHex)
      if (value === null) {
        delete patched.properties[propertyId]
      } else {
        const property = patched.properties[propertyId]
        const info = exemplarProperties[propertyId]
        const type = property?.type ?? info?.type
        if (!type) {
          throw Error(`Unknown property: 0x${toHex(propertyId, 8)}`)
        }

        patched.properties[propertyId] = {
          id: propertyId,
          type,
          value,
        } as ExemplarProperty
      }
    })
  }

  return patched
}

export function writeExemplar(data: ExemplarData): Buffer {
  const properties = values(data.properties)
  const propertyCount = properties.length

  const writer = new BinaryWriter(24, { resizable: true })

  writer.writeString(data.isCohort ? "CQZB1###" : "EQZB1###")
  writer.writeTGI(data.parentCohort)
  writer.writeUInt32(propertyCount)

  for (const property of properties) {
    writer.writeUInt32(property.id)
    writer.writeUInt16(property.type)

    // Prefer encoding 1-rep values as single values
    // See https://wiki.sc4devotion.com/index.php?title=Exemplar - Encoding Issue in the Aspyr Port
    if ((isArray(property.value) && property.value.length !== 1) || isString(property.value)) {
      writer.writeUInt16(PropertyKeyType.Multi)
      writer.writeUInt8(0)
      writer.writeUInt32(property.value.length)
      writer.writeValues(property.value, property.type)
    } else {
      const value = isArray(property.value) ? property.value[0] : property.value
      writer.writeUInt16(PropertyKeyType.Single)
      writer.writeUInt8(0)
      writer.writeValue(value, property.type)
    }
  }

  return writer.bytes
}
