import type { FileHandle } from "node:fs/promises"

import { assert, forEach, forEachAsync, mapValues, size } from "@salinco/nice-utils"

import {
  DBPFDataType,
  type DBPFEntryData,
  type DBPFEntryInfo,
  type DBPFInfo,
  type DBPFLoadedEntryInfo,
  type TGI,
  getDataType,
  isCompressed,
} from "@common/dbpf"
import type { ExemplarData, ExemplarDataPatch, ExemplarProperties } from "@common/exemplars"

import { BinaryReader, BinaryWriter } from "./bin"
import { loadExemplar, patchExemplar, writeExemplar } from "./exemplars"
import { FileOpenMode, fsOpen, readBytes, writeBytes } from "./files"
import type { TaskContext } from "./tasks"

const HEADER_SIZE = 96
const HEADER_MAGIC = "DBPF"

const VERSION = "1.0"
const INDEX_VERSION = "7.0"
const INDEX_ENTRY_SIZE = 20
const DIR_ENTRY_ID = "e86b1eef-e86b1eef-286b1f03" as TGI
const DIR_ENTRY_SIZE = 16

export type DBPFEntry<T extends DBPFDataType = DBPFDataType> = DBPFEntryInfo<T> & {
  bytes?: Buffer
}

export type DBPFLoadedEntry<T extends DBPFDataType = DBPFDataType> = DBPFEntry<T> & {
  bytes: Buffer
  data: DBPFEntryData<T>
}

export class DBPF implements DBPFInfo {
  public readonly createdAt: Date
  public readonly entries: { [tgi in TGI]?: DBPFEntry }
  public readonly file?: FileHandle
  public readonly modifiedAt: Date

  protected constructor(data: DBPFInfo, file?: FileHandle) {
    this.createdAt = data.createdAt
    this.entries = data.entries
    this.file = file
    this.modifiedAt = data.modifiedAt
  }

  /**
   * Creates an empty DBPF file.
   */
  public static create(options?: { createdAt?: Date }): DBPF {
    return new DBPF({
      createdAt: options?.createdAt ?? new Date(),
      entries: {},
      modifiedAt: new Date(),
    })
  }

  public static async loadEntry<T extends DBPFDataType>(
    fullPath: string,
    entryId: TGI,
    type?: T,
  ): Promise<DBPFLoadedEntryInfo<T>> {
    return fsOpen(fullPath, FileOpenMode.READ, async file => {
      const dbpf = await DBPF.fromFile(file)
      return dbpf.getEntry(entryId, type)
    })
  }

  public static async loadEntryOptional<T extends DBPFDataType>(
    fullPath: string,
    entryId: TGI,
    type?: T,
  ): Promise<DBPFLoadedEntryInfo<T> | null> {
    return fsOpen(fullPath, FileOpenMode.READ, async file => {
      const dbpf = await DBPF.fromFile(file)
      if (dbpf.entries[entryId]) {
        return dbpf.getEntry(entryId, type)
      }

      return null
    })
  }

  public static async loadExemplars(fullPath: string): Promise<DBPFInfo> {
    return fsOpen(fullPath, FileOpenMode.READ, async file => {
      const dbpf = await DBPF.fromFile(file)
      return dbpf.loadExemplars()
    })
  }

  public static async patchEntries(
    fullPath: string,
    outPath: string,
    patches: { [tgi in TGI]?: ExemplarDataPatch | Buffer | null },
    exemplarProperties: ExemplarProperties,
  ): Promise<DBPFInfo> {
    return fsOpen(fullPath, FileOpenMode.READ, async file => {
      const dbpf = await DBPF.fromFile(file)
      await dbpf.loadExemplars()
      return dbpf.patchEntries(outPath, patches, exemplarProperties)
    })
  }

  /**
   * Loads a DBPF file.
   *
   * The index is loaded (including compressed/uncompressed entry sizes) but not the contents.
   */
  public static async fromFile(file: FileHandle): Promise<DBPF> {
    const header = await BinaryReader.fromFile(file, HEADER_SIZE, 0)
    const magic = header.readString(HEADER_MAGIC.length)
    if (magic !== HEADER_MAGIC) {
      throw Error(`Invalid magic word: '${magic}' (expected '${HEADER_MAGIC}')`)
    }

    const majorVersion = header.readUInt32(4)
    const minorVersion = header.readUInt32(8)
    const version = `${majorVersion}.${minorVersion}`
    if (version !== VERSION && version !== "0.0") {
      throw Error(`Unsupported version: ${version} (expected ${VERSION})`)
    }

    const createdAt = new Date(header.readUInt32(24) * 1000)
    const modifiedAt = new Date(header.readUInt32(28) * 1000)

    const indexMajorVersion = header.readUInt32(32)
    const indexMinorVersion = header.readUInt32(60)
    const indexVersion = `${indexMajorVersion}.${indexMinorVersion}`
    if (indexVersion !== INDEX_VERSION) {
      throw Error(`Unsupported index version: ${indexVersion} (expected ${INDEX_VERSION})`)
    }

    const entryCount = header.readUInt32(36)
    const indexOffset = header.readUInt32(40)
    const indexSize = header.readUInt32(44)

    if (indexSize !== entryCount * INDEX_ENTRY_SIZE) {
      throw Error(
        `Mismatching index size: ${indexSize} (expected ${entryCount * INDEX_ENTRY_SIZE})`,
      )
    }

    const entries: DBPFInfo["entries"] = {}

    const indexBytes = await BinaryReader.fromFile(file, indexSize, indexOffset)
    for (let i = 0; i < entryCount; i++) {
      const tgi = indexBytes.readTGI()
      const offset = indexBytes.readUInt32()
      const size = indexBytes.readUInt32()

      if (entries[tgi]) {
        // console.warn(`Entry ${tgi} is present multiple times in file`)
      }

      entries[tgi] = {
        id: tgi,
        offset,
        size,
        type: getDataType(tgi),
      }
    }

    const dir = entries[DIR_ENTRY_ID]

    if (dir) {
      const dirEntryCount = dir.size / DIR_ENTRY_SIZE

      const dirBytes = await BinaryReader.fromFile(file, dir.size, dir.offset)
      for (let i = 0; i < dirEntryCount; i++) {
        const tgi = dirBytes.readTGI()
        const uncompressed = dirBytes.readUInt32()

        const entry = entries[tgi]
        if (entry) {
          entry.uncompressed = uncompressed
        } else {
          console.warn(`Entry ${tgi} is present in DIR but missing from file`)
        }
      }
    }

    return new DBPF({ createdAt, entries, modifiedAt }, file)
  }

  public static async packFiles(
    context: TaskContext,
    inPaths: string[],
    outPath: string,
  ): Promise<void> {
    const pack = DBPF.create()

    let nFiles = 0
    // Copy the entries from each source file
    for (const inPath of inPaths) {
      await fsOpen(inPath, FileOpenMode.READ, async inFile => {
        context.setProgress(nFiles++, inPaths.length)
        const source = await DBPF.fromFile(inFile)
        await forEachAsync(source.entries, async (entry, tgi) => {
          pack.entries[tgi] = entry
          // Copy the raw bytes (no need to decompress/recompress)
          entry.bytes = await source.getRawBytes(tgi)
        })
      })
    }

    // Write the contents (will automatically reindex)
    await fsOpen(outPath, FileOpenMode.WRITE, outFile => pack.writeToFile(outFile))
  }

  /**
   * Adds an entry.
   *
   * If an entry with same TGI already exists, it is fully overwritten.
   */
  public addEntry(tgi: TGI, bytes: Buffer, options?: { compress?: boolean }): DBPFEntry {
    const entry: DBPFEntry = {
      bytes,
      id: tgi,
      offset: 0, // will be reindexed later
      size: bytes.length,
      type: getDataType(tgi),
    }

    if (options?.compress) {
      entry.uncompressed = bytes.length
      entry.bytes = BinaryWriter.compress(bytes)
      entry.size = entry.bytes.length
    }

    this.entries[tgi] = entry
    return entry
  }

  /**
   * Adds an exemplar.
   *
   * If an entry with same TGI already exists, it is fully overwritten.
   */
  public addExemplar(
    tgi: TGI,
    data: ExemplarData,
    options?: { compress?: boolean },
  ): DBPFEntry<DBPFDataType.EXEMPLAR> & { data: DBPFEntryData<DBPFDataType.EXEMPLAR> } {
    const bytes = writeExemplar(data)
    const entry = this.addEntry(tgi, bytes, options)
    assert(entry.type === DBPFDataType.EXEMPLAR, `Entry ${tgi} is not exemplar!`)
    return Object.assign(entry, { data })
  }

  /**
   * Loads the uncompressed bytes for an entry.
   */
  public async getBytes(tgi: TGI): Promise<Buffer> {
    const entry = this.entries[tgi]
    if (!entry) {
      throw Error(`Entry ${tgi} is missing from file`)
    }

    const bytes = await this.getRawBytes(tgi)

    return isCompressed(entry) ? BinaryReader.decompress(bytes) : bytes
  }

  /**
   * Fully loads an entry.
   */
  public async getEntry<T extends DBPFDataType>(
    tgi: TGI,
    type?: T,
  ): Promise<DBPFEntry<T> & { data: DBPFEntryData<T> }> {
    const entry = this.entries[tgi]
    if (!entry) {
      throw Error(`Entry ${tgi} is missing from file`)
    }

    if (type && type !== entry.type) {
      throw Error(`Entry ${tgi} has data type ${entry.type} (expected ${type})`)
    }

    if (!entry.data) {
      const bytes = await this.getBytes(tgi)

      switch (entry.type) {
        case DBPFDataType.EXEMPLAR:
          entry.data = loadExemplar(tgi, bytes)
          break

        case DBPFDataType.LTEXT:
          entry.data = { text: bytes.toString("utf16le").slice(2) }
          break

        case DBPFDataType.XML:
          entry.data = { text: bytes.toString("utf8") }
          break

        case DBPFDataType.BMP:
        case DBPFDataType.JFIF:
        case DBPFDataType.PNG:
          entry.data = { base64: bytes.toString("base64") }
          break

        default:
          throw Error(`Entry type ${entry.type} cannot be loaded`)
      }
    }

    return entry as DBPFEntry<T> & { data: DBPFEntryData<T> }
  }

  /**
   * Loads an exemplar.
   */
  public async getExemplar(tgi: TGI): Promise<ExemplarData> {
    const entry = await this.getEntry(tgi, DBPFDataType.EXEMPLAR)
    return entry.data
  }

  /**
   * Loads the raw (may be compressed) bytes for an entry.
   */
  public async getRawBytes(tgi: TGI): Promise<Buffer> {
    const entry = this.entries[tgi]
    if (!entry) {
      throw Error(`Entry ${tgi} is missing from file`)
    }

    if (!entry.bytes) {
      if (!this.file) {
        throw Error("No source file")
      }

      entry.bytes = await readBytes(this.file, entry.size, entry.offset)
    }

    return entry.bytes
  }

  /**
   * Gets serializable {@link DBPFInfo} (without extra data such as raw buffers).
   */
  protected info(): DBPFInfo {
    return {
      createdAt: this.createdAt,
      entries: mapValues(this.entries, getEntryInfo),
      modifiedAt: this.modifiedAt,
    }
  }

  /**
   * Preloads all exemplars/cohorts/LTEXT entries
   */
  public async loadExemplars(): Promise<DBPFInfo> {
    await forEachAsync(this.entries, async (entry, tgi) => {
      switch (entry.type) {
        case DBPFDataType.EXEMPLAR:
        case DBPFDataType.LTEXT:
          await this.getEntry(tgi, entry.type)
      }
    })

    return this.info()
  }

  public async patchEntries(
    outPath: string,
    patches: { [tgi in TGI]?: ExemplarDataPatch | Buffer | null },
    exemplarProperties: ExemplarProperties,
  ): Promise<DBPFInfo> {
    // Create an empty DBPF file
    const patched = DBPF.create({ createdAt: this.createdAt })

    // Ensure that all patched entries exist in the source
    forEach(patches, (_, tgi) => {
      if (!this.entries[tgi]) {
        throw Error(`Entry ${tgi} is missing from file`)
      }
    })

    // Copy entries from the source, applying patches as needed
    await forEachAsync(this.entries, async (entry, tgi) => {
      const patch = patches[tgi]

      // Drop DIR (will be regenerated anyways) and deleted entries
      if (tgi === DIR_ENTRY_ID || patch === null) {
        return
      }

      const compress = isCompressed(entry)

      if (Buffer.isBuffer(patch)) {
        // Binary patch: Replace the whole entry
        const original = await this.getEntry(tgi, entry.type)
        const newEntry = patched.addEntry(tgi, patch, { compress })
        newEntry.original = original.data
      } else if (patch) {
        // Exemplar patch: Apply the patch on top of original data
        const original = await this.getExemplar(tgi)
        const patchedExemplar = patchExemplar(original, patch, exemplarProperties)
        const newEntry = patched.addExemplar(tgi, patchedExemplar, { compress })
        newEntry.original = original
      } else {
        // No patch: Copy the whole entry (no need to decompress/recompress)
        entry.bytes = await this.getRawBytes(tgi)
        patched.entries[tgi] = { ...entry }
      }
    })

    // Write the contents (will automatically reindex)
    await fsOpen(outPath, FileOpenMode.WRITE, outFile => patched.writeToFile(outFile))

    // Return the patched information
    return patched.info()
  }

  /**
   * Regenerates the DIR entry and recalculates all offsets.
   */
  protected reindex(): void {
    const dir = new BinaryWriter()

    forEach(this.entries, entry => {
      if (entry.id !== DIR_ENTRY_ID && entry.uncompressed !== undefined) {
        dir.writeTGI(entry.id)
        dir.writeUInt32(entry.uncompressed)
      }
    })

    if (dir.length) {
      this.addEntry(DIR_ENTRY_ID, dir.bytes)
    } else {
      delete this.entries[DIR_ENTRY_ID]
    }

    let offset = HEADER_SIZE + size(this.entries) * INDEX_ENTRY_SIZE
    forEach(this.entries, entry => {
      entry.offset = offset
      offset += entry.size
    })
  }

  /**
   * Removes an entry.
   */
  public removeEntry(tgi: TGI): void {
    const entry = this.entries[tgi]
    if (!entry) {
      throw Error(`Entry ${tgi} is missing from file`)
    }

    delete this.entries[tgi]
  }

  /**
   * Writes all contents to a file (after an automatic reindexing).
   */
  public async writeToFile(file: FileHandle): Promise<void> {
    // Regenerate DIR and offsets
    this.reindex()

    const entryCount = size(this.entries)
    const header = new BinaryWriter(HEADER_SIZE)
    const index = new BinaryWriter(entryCount * INDEX_ENTRY_SIZE)

    // Fill header
    header.writeString(HEADER_MAGIC, 0)

    const [majorVersion, minorVersion] = VERSION.split(".").map(Number)
    header.writeUInt32(majorVersion, 4)
    header.writeUInt32(minorVersion, 8)

    header.writeUInt32(Math.floor(this.createdAt.getTime() / 1000), 24)
    header.writeUInt32(Math.floor(this.modifiedAt.getTime() / 1000), 28)

    const [indexMajorVersion, indexMinorVersion] = INDEX_VERSION.split(".").map(Number)
    header.writeUInt32(indexMajorVersion, 32)
    header.writeUInt32(indexMinorVersion, 60)

    header.writeUInt32(entryCount, 36)
    header.writeUInt32(HEADER_SIZE, 40) // We always write index directly after header
    header.writeUInt32(index.length, 44)

    // Fill index
    forEach(this.entries, async entry => {
      index.writeTGI(entry.id)
      index.writeUInt32(entry.offset)
      index.writeUInt32(entry.size)
    })

    // Ensure that index is full
    index.checkEnd()

    // Write all contents
    let offset = 0
    offset += await writeBytes(file, header.bytes, offset)
    offset += await writeBytes(file, index.bytes, offset)
    await forEachAsync(this.entries, async entry => {
      const bytes = await this.getRawBytes(entry.id)
      offset += await writeBytes(file, bytes, offset)
    })
  }
}

function getEntryInfo(entry: DBPFEntry): DBPFEntryInfo {
  const { bytes, ...info } = entry
  return info
}
