import type { FileHandle } from "node:fs/promises"
import { type DBPFEntry, type TGI, parseTGI } from "@common/dbpf"
import { Binary } from "@node/bin"
import { loadDBPFEntryBytes } from "@node/dbpf"
import type { SaveRecord, SaveRecordParser } from "./SaveRecord"

export enum SaveSubfileType {
  Lot = 0xc9bd5d4a,
  SimGridFloat32 = 0x49b9e60a,
  SimGridSInt16 = 0x49b9e605,
  SimGridSInt8 = 0x49b9e603,
  SimGridUInt16 = 0x49b9e604,
  SimGridUInt32 = 0x49b9e606,
  SimGridUInt8 = 0x49b9e602,
}

export abstract class SaveSubfile {
  public readonly entry: DBPFEntry
  public readonly type: number

  public constructor(entry: DBPFEntry) {
    this.entry = entry
    this.type = parseTGI(entry.id)[0]
  }

  public get tgi(): TGI {
    return this.entry.id
  }

  public abstract isDirty(): boolean

  public abstract toBytes(): Buffer
}

export class SaveSubfileSingle<R extends SaveRecord> extends SaveSubfile {
  public data: R

  protected constructor(entry: DBPFEntry, data: R) {
    super(entry)
    this.data = data
  }

  public dirty(): void {
    this.data.dirty()
  }

  public override isDirty(): boolean {
    return this.data.isDirty()
  }

  public override toBytes(): Buffer {
    const bytes = new Binary(12, { alloc: 1024, resizable: true, writable: true })
    this.data.writeRecord(bytes)
    return bytes.toBytes()
  }

  public static async from<R extends SaveRecord>(
    file: FileHandle,
    entry: DBPFEntry,
    parser: SaveRecordParser<R>,
    checkCRC?: boolean,
  ): Promise<SaveSubfileSingle<R>> {
    const bytes = await loadDBPFEntryBytes(file, entry)
    const record = parser.parseRecord(bytes, checkCRC)
    return new this(entry, record)
  }
}

export class SaveSubfileMulti<R extends SaveRecord> extends SaveSubfile {
  public data: R[]

  protected constructor(entry: DBPFEntry, data: R[]) {
    super(entry)
    this.data = data
  }

  public override isDirty(): boolean {
    return this.data.some(record => record.isDirty())
  }

  public override toBytes(): Buffer {
    const bytes = new Binary(12 * this.data.length, { resizable: true, writable: true })

    for (const record of this.data) {
      record.writeRecord(bytes)
    }

    return bytes.toBytes()
  }

  public static async from<R extends SaveRecord>(
    file: FileHandle,
    entry: DBPFEntry,
    parser: SaveRecordParser<R>,
    checkCRC?: boolean,
  ): Promise<SaveSubfileMulti<R>> {
    const bytes = await loadDBPFEntryBytes(file, entry)

    const records: R[] = []

    while (bytes.offset < bytes.length) {
      const record = parser.parseRecord(bytes, checkCRC)
      records.push(record)
    }

    return new this(entry, records)
  }
}
