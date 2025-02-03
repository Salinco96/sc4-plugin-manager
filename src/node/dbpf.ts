import type { FileHandle } from "node:fs/promises"

import { forEach, isArray, isString, keys, parseHex, toHex, values } from "@salinco/nice-utils"

import {
  DBPFDataType,
  type DBPFEntry,
  type DBPFEntryData,
  type DBPFFile,
  DBPFFileType,
  TGI,
  getDataType,
  isCompressed,
  isType,
} from "@common/dbpf"
import {
  type ExemplarData,
  type ExemplarDataPatch,
  type ExemplarProperty,
  type ExemplarPropertyInfo,
  type ExemplarPropertyValue,
  ExemplarValueType,
  PropertyKeyType,
} from "@common/exemplars"

import { BinaryReader, BinaryWriter } from "./bin"
import { readBytes, writeBytes } from "./files"

const HEADER_SIZE = 96
const HEADER_MAGIC = "DBPF"

const VERSION = "1.0"
const INDEX_VERSION = "7.0"
const INDEX_ENTRY_SIZE = 20
const DIR_ENTRY_SIZE = 16

export async function loadDBPF(
  file: FileHandle,
  options: {
    exemplarProperties: {
      [propertyId in number]?: ExemplarPropertyInfo
    }
    loadExemplars?: boolean
  },
): Promise<DBPFFile> {
  const header = await BinaryReader.fromFile(file, HEADER_SIZE, 0)
  const magic = header.readString(HEADER_MAGIC.length)
  if (magic !== HEADER_MAGIC) {
    throw Error(`Invalid magic word: ${magic}`)
  }

  const majorVersion = header.readUInt32(4)
  const minorVersion = header.readUInt32(8)
  const version = `${majorVersion}.${minorVersion}`
  if (version !== VERSION && version !== "0.0") {
    throw Error(`Unsupported version: ${version}`)
  }

  const createdAt = new Date(header.readUInt32(24) * 1000)
  const modifiedAt = new Date(header.readUInt32(28) * 1000)

  const contents: DBPFFile = {
    createdAt: createdAt.toISOString(),
    entries: {},
    modifiedAt: modifiedAt.toISOString(),
  }

  const indexMajorVersion = header.readUInt32(32)
  const indexMinorVersion = header.readUInt32(60)
  const indexVersion = `${indexMajorVersion}.${indexMinorVersion}`
  if (indexVersion !== INDEX_VERSION) {
    throw Error(`Unsupported index version: ${indexVersion}`)
  }

  const entryCount = header.readUInt32(36)
  const indexOffset = header.readUInt32(40)
  const indexSize = header.readUInt32(44)

  if (indexSize !== entryCount * INDEX_ENTRY_SIZE) {
    throw Error(`Mismatching index size: ${indexSize} vs ${entryCount * INDEX_ENTRY_SIZE})`)
  }

  const indexBytes = await BinaryReader.fromFile(file, indexSize, indexOffset)
  for (let i = 0; i < entryCount; i++) {
    const id = indexBytes.readTGI()
    const offset = indexBytes.readUInt32()
    const size = indexBytes.readUInt32()

    contents.entries[id] = {
      id,
      offset,
      size,
      type: getDataType(id),
    }
  }

  const dir = contents.entries[DBPFFileType.DIR as TGI]

  if (dir) {
    const dirEntryCount = dir.size / DIR_ENTRY_SIZE

    const dirBytes = await BinaryReader.fromFile(file, dir.size, dir.offset)
    for (let i = 0; i < dirEntryCount; i++) {
      const id = dirBytes.readTGI()
      const uncompressed = dirBytes.readUInt32()

      const entry = contents.entries[id]
      if (entry) {
        entry.uncompressed = uncompressed
      }
    }
  }

  if (options.loadExemplars) {
    for (const entry of values(contents.entries)) {
      switch (entry.type) {
        case DBPFDataType.EXMP:
        case DBPFDataType.LTEXT: {
          try {
            entry.data = await loadDBPFEntry<typeof entry.type>(file, entry, options)
          } catch (error) {
            // Entry is actually compressed even though not in DIR...
            // e.g. Census Repository v3.5 Patch/RJ - Census_Repository_Model_and_Query_3.1.dat
            if (!isCompressed(entry)) {
              entry.uncompressed = 0
              try {
                entry.data = await loadDBPFEntry<typeof entry.type>(file, entry, options)
              } catch (_error) {
                // Ignore
              }
            }

            if (!entry.data) {
              console.error(`Failed to load entry ${entry.id}`, error)
            }
          }
        }
      }
    }
  }

  return contents
}

export async function loadDBPFEntryBytes(
  file: FileHandle,
  entry: DBPFEntry,
): Promise<BinaryReader> {
  const bytes = await BinaryReader.fromFile(file, entry.size, entry.offset, isCompressed(entry))

  // TODO: Bad mutation!
  if (entry.uncompressed === 0) {
    entry.uncompressed = bytes.length
  }

  return bytes
}

export async function loadDBPFEntry<T extends DBPFDataType>(
  file: FileHandle,
  entry: DBPFEntry<T>,
  options: {
    exemplarProperties: {
      [propertyId in number]?: ExemplarPropertyInfo
    }
  },
): Promise<DBPFEntryData<T>> {
  const type = getDataType(entry.id)

  const bytes = await loadDBPFEntryBytes(file, entry)

  switch (type) {
    case DBPFDataType.EXMP: {
      return loadExemplar(entry.id, bytes, options.exemplarProperties) as DBPFEntryData<T>
    }

    case DBPFDataType.LTEXT: {
      return { text: bytes.toString("utf16le").slice(2) } as DBPFEntryData<T>
    }

    case DBPFDataType.XML: {
      return { text: bytes.toString() } as DBPFEntryData<T>
    }

    case DBPFDataType.BMP:
    case DBPFDataType.JFIF:
    case DBPFDataType.PNG: {
      return { base64: bytes.toBase64() } as DBPFEntryData<T>
    }

    default:
      throw Error(`Unsupported entry type: ${type}`)
  }
}

export async function patchVariantFileEntries(
  inFile: FileHandle,
  outFile: FileHandle,
  patches: {
    [entryId in TGI]?: Buffer | ExemplarDataPatch | null
  },
  options: {
    exemplarProperties: {
      [propertyId in number]?: ExemplarPropertyInfo
    }
  },
): Promise<DBPFFile> {
  const contents = await loadDBPF(inFile, { ...options, loadExemplars: true })

  // Check that all TGIs exist
  for (const entryId of keys(patches)) {
    if (!contents.entries[entryId]) {
      throw Error(`Missing entry: ${entryId}`)
    }
  }

  let offset = 0

  const entryCount = Object.keys(contents.entries).length

  const header = new BinaryWriter(HEADER_SIZE)
  offset += await header.writeToFile(outFile, offset)

  const indexOffset = offset
  const index = new BinaryWriter(entryCount * INDEX_ENTRY_SIZE)
  offset += await index.writeToFile(outFile, offset)

  const dirEntry = contents.entries[DBPFFileType.DIR]
  const dir = dirEntry && new BinaryWriter()

  for (const entry of values(contents.entries)) {
    // Skip DIR for now - we will write it last
    if (entry.id === DBPFFileType.DIR) {
      continue
    }

    const patch = patches[entry.id]

    if (Buffer.isBuffer(patch)) {
      let bytes = patch

      if (entry.uncompressed) {
        entry.uncompressed = bytes.length
        bytes = BinaryWriter.compress(bytes)
      }

      entry.offset = offset
      entry.size = bytes.length

      offset += await writeBytes(outFile, bytes, offset)
    } else if (patch) {
      if (entry.type !== DBPFDataType.EXMP) {
        throw Error(`Not an exemplar entry: ${entry.id}`)
      }

      const originalData =
        entry.data ?? (await loadDBPFEntry<DBPFDataType.EXMP>(inFile, entry, options))

      const exemplarData = {
        ...originalData,
        properties: { ...originalData.properties },
      }

      if (patch.parentCohortId) {
        exemplarData.parentCohortId = patch.parentCohortId
      }

      if (patch.properties) {
        forEach(patch.properties, (value, propertyIdHex) => {
          const propertyId = Number.parseInt(propertyIdHex, 16)
          if (value === null) {
            delete exemplarData.properties[propertyId]
          } else {
            const property = exemplarData.properties[propertyId]
            const info = options.exemplarProperties[propertyId]
            const type = property?.type ?? info?.type
            if (!type) {
              throw Error(`Unknown property: 0x${toHex(propertyId, 8)}`)
            }

            exemplarData.properties[propertyId] = {
              id: propertyId,
              type,
              value,
            } as ExemplarProperty
          }
        })
      }

      const writer = writeExemplar(exemplarData, entry.size)

      if (entry.uncompressed !== undefined) {
        entry.uncompressed = writer.length
        writer.compress()
      }

      entry.data = exemplarData
      entry.offset = offset
      entry.original = originalData
      entry.size = writer.length

      offset += await writer.writeToFile(outFile, offset)
    } else {
      const bytes = await readBytes(inFile, entry.size, entry.offset)

      entry.offset = offset

      offset += await writeBytes(outFile, bytes, offset)
    }

    index.writeTGI(entry.id)
    index.writeUInt32(entry.offset)
    index.writeUInt32(entry.size)

    if (dir && entry.uncompressed !== undefined) {
      dir.writeTGI(entry.id)
      dir.writeUInt32(entry.uncompressed)
    }
  }

  if (dir) {
    dirEntry.offset = offset

    index.writeTGI(dirEntry.id)
    index.writeUInt32(dirEntry.offset)
    index.writeUInt32(dirEntry.size)

    offset += await dir.writeToFile(outFile, offset)
  }

  index.checkEnd()

  contents.modifiedAt = new Date().toISOString()

  header.writeString(HEADER_MAGIC, 0)

  const [majorVersion, minorVersion] = VERSION.split(".").map(Number)
  header.writeUInt32(majorVersion, 4)
  header.writeUInt32(minorVersion, 8)

  header.writeUInt32(Math.floor(new Date(contents.createdAt).valueOf() / 1000), 24)
  header.writeUInt32(Math.floor(new Date(contents.modifiedAt).valueOf() / 1000), 28)

  const [indexMajorVersion, indexMinorVersion] = INDEX_VERSION.split(".").map(Number)
  header.writeUInt32(indexMajorVersion, 32)
  header.writeUInt32(indexMinorVersion, 60)

  header.writeUInt32(entryCount, 36)
  header.writeUInt32(indexOffset, 40)
  header.writeUInt32(index.length, 44)

  await header.writeToFile(outFile, 0)
  await index.writeToFile(outFile, indexOffset)

  return contents
}

function loadExemplar(
  entryId: TGI,
  bytes: BinaryReader,
  exemplarProperties: {
    [propertyId in number]?: ExemplarPropertyInfo
  },
): ExemplarData {
  let parentCohortId = TGI(0, 0, 0)

  const properties: { [propertyId in number]?: ExemplarProperty } = {}
  const mode = bytes.readString(8)

  switch (mode.slice(0, 4)) {
    // "B" = binary
    case "CQZB":
    case "EQZB": {
      parentCohortId = bytes.readTGI()

      const propertyCount = bytes.readUInt32()

      for (let i = 0; i < propertyCount; i++) {
        const propertyId = bytes.readUInt32()
        const valueType = bytes.readUInt16()
        const keyType = bytes.readUInt16()
        const unused = bytes.readUInt8()

        switch (keyType) {
          case PropertyKeyType.Single: {
            if (unused !== 0) {
              throw Error(`Unexpected unused: 0x${toHex(unused, 2)}`)
            }

            properties[propertyId] = {
              id: propertyId,
              info: exemplarProperties[propertyId],
              type: valueType,
              value: bytes.readValue(valueType),
            } as ExemplarProperty

            break
          }

          case PropertyKeyType.Multi: {
            const reps = bytes.readUInt32()

            properties[propertyId] = {
              id: propertyId,
              info: exemplarProperties[propertyId],
              type: valueType,
              value: bytes.readValues(valueType, reps),
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

      for (const row of bytes.toString().split("\n")) {
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
            const name = propertyMatch[2]
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
              info: exemplarProperties[propertyId] ?? {
                id: propertyId,
                name,
                type: valueType,
              },
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
    isCohort: isType(entryId, DBPFFileType.COHORT),
    parentCohortId,
    properties,
  }
}

function writeExemplar(data: ExemplarData, allocSize: number): BinaryWriter {
  const properties = values(data.properties)
  const propertyCount = properties.length

  const writer = new BinaryWriter(24, { alloc: allocSize, resizable: true })

  writer.writeString(data.isCohort ? "CQZB1###" : "EQZB1###")
  writer.writeTGI(data.parentCohortId)
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

  return writer
}
