import type { FileHandle } from "node:fs/promises"

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
import { readHex, toHex } from "@common/utils/hex"
import { forEach, forEachAsync, keys, values } from "@common/utils/objects"
import { isArray, isString } from "@common/utils/types"

import { Binary } from "./bin"

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
  const header = await Binary.fromFile(file, HEADER_SIZE)
  const magic = header.readString(HEADER_MAGIC.length)
  if (magic !== HEADER_MAGIC) {
    throw Error(`Invalid magic word: ${magic}`)
  }

  const majorVersion = header.readUInt32(4)
  const minorVersion = header.readUInt32(8)
  const version = `${majorVersion}.${minorVersion}`
  if (version !== VERSION) {
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

  const indexBytes = await Binary.fromFile(file, indexSize, indexOffset)
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

  const dir = contents.entries[DBPFFileType.DIR]

  if (dir) {
    const dirEntryCount = dir.size / DIR_ENTRY_SIZE

    const dirBytes = await Binary.fromFile(file, dir.size, dir.offset)
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
      if (entry.type === DBPFDataType.EXMP) {
        try {
          entry.data = await loadDBPFEntry<DBPFDataType.EXMP>(file, entry, options)
        } catch (error) {
          // Entry is actually compressed even though not in DIR...
          // e.g. Census Repository v3.5 Patch/RJ - Census_Repository_Model_and_Query_3.1.dat
          if (!isCompressed(entry)) {
            entry.uncompressed = 0
            try {
              entry.data = await loadDBPFEntry<DBPFDataType.EXMP>(file, entry, options)
              continue
            } catch (_error) {
              // Ignore
            }
          }

          console.error(`Failed to load entry ${entry.id}`, error)
        }
      }
    }
  }

  return contents
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

  const bytes = await Binary.fromFile(file, entry.size, entry.offset)

  if (isCompressed(entry)) {
    bytes.decompress()

    if (entry.uncompressed === 0) {
      entry.uncompressed = bytes.length
    }
  }

  switch (type) {
    case DBPFDataType.EXMP: {
      return loadExemplar(entry.id, bytes, options.exemplarProperties) as DBPFEntryData<T>
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

export async function patchDBPFEntries(
  inFile: FileHandle,
  outFile: FileHandle,
  patches: {
    [entryId in TGI]?: ExemplarDataPatch | null
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

  const header = new Binary(HEADER_SIZE, { writable: true })
  offset += await header.writeTofile(outFile)

  const indexOffset = offset
  const index = new Binary(entryCount * INDEX_ENTRY_SIZE, { writable: true })
  offset += await index.writeTofile(outFile)

  const dirEntry = contents.entries[DBPFFileType.DIR]
  const dir = dirEntry && new Binary(dirEntry.size, { writable: true })

  await forEachAsync(contents.entries, async (entry, entryId) => {
    // Skip DIR for now - we will write it last
    if (entryId === DBPFFileType.DIR) {
      return
    }

    const patch = patches[entryId]

    if (patch) {
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
            const info = property?.info ?? options.exemplarProperties[propertyId]
            const type = property?.type ?? info?.type
            if (!type) {
              throw Error(`Unknown property: ${toHex(propertyId, 8, true)}`)
            }

            exemplarData.properties[propertyId] = {
              id: propertyId,
              info,
              type,
              value,
            } as ExemplarProperty
          }
        })
      }

      const bytes = writeExemplar(exemplarData, entry.size)

      if (entry.uncompressed !== undefined) {
        entry.uncompressed = bytes.length
        bytes.compress()
      }

      entry.data = exemplarData
      entry.offset = offset
      entry.original = originalData
      entry.size = bytes.length

      offset += await bytes.writeTofile(outFile)
    } else {
      const bytes = await Binary.fromFile(inFile, entry.size, entry.offset)

      entry.offset = offset

      offset += await bytes.writeTofile(outFile)
    }

    index.writeTGI(entryId)
    index.writeUInt32(entry.offset)
    index.writeUInt32(entry.size)

    if (dir && entry.uncompressed !== undefined) {
      dir.writeTGI(entryId)
      dir.writeUInt32(entry.uncompressed)
    }
  })

  if (dir) {
    dirEntry.offset = offset

    index.writeTGI(dirEntry.id)
    index.writeUInt32(dirEntry.offset)
    index.writeUInt32(dirEntry.size)

    offset += await dir.writeTofile(outFile)
  }

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

  await header.writeTofile(outFile, 0)
  await index.writeTofile(outFile, indexOffset)

  return contents
}

function loadExemplar(
  entryId: TGI,
  bytes: Binary,
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
              throw Error(`Unexpected unused: ${toHex(unused, 2, true)}`)
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
            throw Error(`Unexpected keyType: ${toHex(keyType, 4, true)}`)
          }
        }
      }

      break
    }

    // "T" = text
    case "CQZT":
    case "EQZT": {
      const parentCohortRegex =
        /^ParentCohort=Key:\{0x([0-9a-f]{8}),0x([0-9a-f]{8}),0x([0-9a-f]{8})\}$/
      const propertyRegex = /^0x([0-9a-f]{8}):\{"(.+)"\}=(\w+):(\d+):\{(.+)\}$/

      for (const row of bytes.toString().split("\n")) {
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

function writeExemplar(data: ExemplarData, allocSize: number): Binary {
  const properties = values(data.properties)
  const propertyCount = properties.length

  const exemplar = new Binary(0, { alloc: allocSize, resizable: true, writable: true })

  exemplar.writeString(data.isCohort ? "CQZB1###" : "EQZB1###")
  exemplar.writeTGI(data.parentCohortId)
  exemplar.writeUInt32(propertyCount)

  for (const property of properties) {
    exemplar.writeUInt32(property.id)
    exemplar.writeUInt16(property.type)

    // Prefer encoding 1-rep values as single values
    // See https://wiki.sc4devotion.com/index.php?title=Exemplar - Encoding Issue in the Aspyr Port
    if ((isArray(property.value) && property.value.length !== 1) || isString(property.value)) {
      exemplar.writeUInt16(PropertyKeyType.Multi)
      exemplar.writeUInt8(0)
      exemplar.writeUInt32(property.value.length)
      exemplar.writeValues(property.value, property.type)
    } else {
      const value = isArray(property.value) ? property.value[0] : property.value
      exemplar.writeUInt16(PropertyKeyType.Single)
      exemplar.writeUInt8(0)
      exemplar.writeValue(value, property.type)
    }
  }

  return exemplar
}
