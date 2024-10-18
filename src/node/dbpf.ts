import { FileHandle } from "fs/promises"

import { decompress } from "qfs-compression"

import {
  DBPFDataType,
  DBPFEntry,
  DBPFEntryData,
  DBPFFile,
  DBPFFileType,
  TGI,
  getDataType,
  getFileTypeLabel,
  isCompressed,
} from "@common/dbpf"
import {
  ExemplarProperties,
  ExemplarProperty,
  ExemplarPropertyValue,
  ExemplarValueType,
} from "@common/exemplars"

import { readBytes } from "./files"

function readHex(value: string): number {
  return Number.parseInt(value.replace(/^0x/, ""), 16)
}

function toHex(value: number, numBytes: number, prefix: boolean = false): string {
  return (prefix ? "0x" : "") + value.toString(16).padStart(numBytes * 2, "0")
}

function readTGI(bytes: Buffer, offset: number): TGI {
  const t = bytes.readUint32LE(offset)
  const g = bytes.readUint32LE(offset + 4)
  const i = bytes.readUint32LE(offset + 8)
  return TGI(t, g, i)
}

export async function loadDBPF(file: FileHandle): Promise<DBPFFile> {
  const header = await readBytes(file, 96, 0)
  const magic = header.subarray(0, 4).toString("utf8")
  if (magic !== "DBPF") {
    throw Error(`Invalid magic word: ${magic}`)
  }

  const majorVersion = header.readUInt32LE(4)
  const minorVersion = header.readUInt32LE(8)
  const version = `${majorVersion}.${minorVersion}`
  if (version !== "1.0") {
    throw Error(`Unsupported version: ${version}`)
  }

  const indexMajorVersion = header.readUInt32LE(32)
  const indexMinorVersion = header.readUInt32LE(60)
  const indexVersion = `${indexMajorVersion}.${indexMinorVersion}`
  if (indexVersion !== "7.0") {
    throw Error(`Unsupported index version: ${indexVersion}`)
  }

  const contents: DBPFFile = {
    createdAt: new Date(header.readUInt32LE(24) * 1000).toISOString(),
    entries: {},
    modifiedAt: new Date(header.readUInt32LE(28) * 1000).toISOString(),
  }

  const indexOffset = header.readUInt32LE(40)
  const indexSize = header.readUInt32LE(44)

  const entryCount = header.readUInt32LE(36)
  const entrySize = indexSize / entryCount

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = indexOffset + entrySize * i
    const entry = await readBytes(file, entrySize, entryOffset)
    const id = readTGI(entry, 0)
    const offset = entry.readUInt32LE(12)
    const size = entry.readUInt32LE(16)

    contents.entries[id] = {
      dataType: getDataType(id),
      id,
      offset,
      size,
      type: getFileTypeLabel(id),
    }
  }

  const dir = contents.entries[DBPFFileType.DIR]

  if (dir) {
    const dirEntrySize = 16
    const dirEntryCount = dir.size / dirEntrySize

    for (let i = 0; i < dirEntryCount; i++) {
      const dirEntry = await readBytes(file, dirEntrySize, dir.offset + dirEntrySize * i)
      const id = readTGI(dirEntry, 0)
      const uncompressed = dirEntry.readUInt32LE(12)

      const entry = contents.entries[id]
      entry.uncompressed = uncompressed
    }
  }

  return contents
}

export async function loadDBPFEntry(file: FileHandle, entry: DBPFEntry): Promise<DBPFEntryData> {
  const type = getDataType(entry.id)

  let bytes = await readBytes(file, entry.size, entry.offset)

  if (isCompressed(entry)) {
    // SC4 prefixes compressed bytes with total buffer length
    bytes = bytes.subarray(4)
    // QFS decompression
    bytes = decompress(bytes)
  }

  if (type === DBPFDataType.EXMP) {
    let parentCohortId = TGI(0, 0, 0)
    const properties: ExemplarProperty[] = []

    const mode = String.fromCharCode(bytes.readUint8(3)) // "B" = binary / "T" = text
    switch (mode) {
      case "B": {
        parentCohortId = readTGI(bytes, 8)
        const propertyCount = bytes.readUint32LE(20)

        let offset = 24
        for (let i = 0; i < propertyCount; i++) {
          const propertyId = bytes.readUint32LE(offset)
          offset += 4

          const valueType = bytes.readUint16LE(offset)
          offset += 2

          const keyType = bytes.readUint16LE(offset)
          offset += 2

          const unused = bytes.readUint8(offset)
          offset += 1

          let reps: number

          switch (keyType) {
            case 0x00: {
              if (unused !== 0) {
                throw Error("Unexpected unused: " + toHex(unused, 1, true))
              }

              reps = 1
              break
            }

            case 0x80: {
              reps = bytes.readUint32LE(offset)
              offset += 4
              break
            }

            default: {
              throw Error("Unexpected keyType: " + toHex(keyType, 2, true))
            }
          }

          const values: (string | boolean | number)[] = []

          for (let j = 0; j < reps; j++) {
            switch (valueType) {
              case ExemplarValueType.UInt8: {
                values.push(bytes.readUint8(offset))
                offset += 1
                break
              }

              case ExemplarValueType.UInt16: {
                values.push(bytes.readUint16LE(offset))
                offset += 2
                break
              }

              case ExemplarValueType.UInt32: {
                values.push(bytes.readUInt32LE(offset))
                offset += 4
                break
              }

              case ExemplarValueType.SInt32: {
                values.push(bytes.readInt32LE(offset))
                offset += 4
                break
              }

              case ExemplarValueType.SInt64: {
                values.push(Number(bytes.readBigInt64LE(offset))) // TODO: Keep bigint?
                offset += 8
                break
              }

              case ExemplarValueType.Float32: {
                values.push(bytes.readFloatLE(offset))
                offset += 4
                break
              }

              case ExemplarValueType.Bool: {
                values.push(Boolean(bytes.readUint8(offset)))
                offset += 1
                break
              }

              case ExemplarValueType.String: {
                values.push(String.fromCharCode(bytes.readUint8(offset)))
                offset += 1
                break
              }

              default: {
                throw Error("Unexpected valueType: " + toHex(valueType, 2, true))
              }
            }
          }

          properties.push({
            id: propertyId,
            info: ExemplarProperties[propertyId],
            type: valueType,
            value: valueType === ExemplarValueType.String ? values.join("") : values,
          } as ExemplarProperty)
        }

        break
      }

      case "T": {
        const data = bytes.toString("utf8")

        const parentCohortRegex =
          /^ParentCohort=Key:\{0x([0-9a-f]{8}),0x([0-9a-f]{8}),0x([0-9a-f]{8})\}$/
        const propertyRegex = /^0x([0-9a-f]{8}):\{"(.+)"\}=(\w+):(\d+):\{(.+)\}$/

        for (const row of data.split("\n")) {
          const parentCohortMatch = row.trim().match(parentCohortRegex)
          if (parentCohortMatch) {
            parentCohortId = TGI(
              readHex(parentCohortMatch[1]),
              readHex(parentCohortMatch[2]),
              readHex(parentCohortMatch[3]),
            )
          } else {
            const propertyMatch = row.trim().match(propertyRegex)
            if (propertyMatch) {
              const propertyId = readHex(propertyMatch[1])
              const name = propertyMatch[2]
              const rawType = propertyMatch[3].replace("int", "Int")
              const rawValue = propertyMatch[5]

              const valueType = ExemplarValueType[rawType as keyof typeof ExemplarValueType]

              let value: ExemplarPropertyValue

              switch (valueType) {
                case ExemplarValueType.String: {
                  value = rawValue.match(/^"(.+)"$/)![1]
                  break
                }

                case ExemplarValueType.Bool: {
                  throw Error("Unsupported boolean property in text exemplar: " + rawValue) // TODO
                }

                default: {
                  value = rawValue.split(",").map(Number)
                }
              }

              properties.push({
                id: propertyId,
                info: ExemplarProperties[propertyId] ?? {
                  id: propertyId,
                  name,
                  type: valueType,
                },
                type: valueType,
                value,
              } as ExemplarProperty)
            }
          }
        }

        break
      }

      default: {
        throw Error("Unexpected mode: " + toHex(mode.charCodeAt(0), 1, true))
      }
    }

    return {
      parentCohortId,
      properties,
      type,
    }
  }

  if (type === DBPFDataType.XML) {
    return {
      text: bytes.toString("utf8"),
      type,
    }
  }

  return {
    base64: bytes.toString("base64"),
    type,
  }
}
