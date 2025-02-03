import { type DBPFEntryInfo, type TGI, parseTGI } from "@common/dbpf"
import { BinaryReader, BinaryWriter } from "@node/bin"
import type { DBPF } from "@node/dbpf"

import type { SaveRecord, SaveRecordParser } from "./SaveRecord"

export enum SaveSubfileType {
  Buildings = 0xa9bd882d,
  Lots = 0xc9bd5d4a,
  SimGridFloat32 = 0x49b9e60a,
  SimGridSInt16 = 0x49b9e605,
  SimGridSInt8 = 0x49b9e603,
  SimGridUInt16 = 0x49b9e604,
  SimGridUInt32 = 0x49b9e606,
  SimGridUInt8 = 0x49b9e602,
}

export abstract class SaveSubfile {
  public readonly entry: DBPFEntryInfo
  public readonly type: number

  public constructor(entry: DBPFEntryInfo) {
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

  protected constructor(entry: DBPFEntryInfo, data: R) {
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
    const writer = new BinaryWriter()
    this.data.writeRecord(writer)
    return writer.bytes
  }

  public static async from<R extends SaveRecord>(
    dbpf: DBPF,
    entry: DBPFEntryInfo,
    parser: SaveRecordParser<R>,
    checkCRC?: boolean,
  ): Promise<SaveSubfileSingle<R>> {
    const bytes = await dbpf.getBytes(entry.id)
    const reader = new BinaryReader(bytes)

    const record = parser.parseRecord(reader, checkCRC)

    return new this(entry, record)
  }
}

export class SaveSubfileMulti<R extends SaveRecord> extends SaveSubfile {
  public data: R[]

  protected constructor(entry: DBPFEntryInfo, data: R[]) {
    super(entry)
    this.data = data
  }

  public override isDirty(): boolean {
    return this.data.some(record => record.isDirty())
  }

  public override toBytes(): Buffer {
    const writer = new BinaryWriter()

    for (const record of this.data) {
      record.writeRecord(writer)
    }

    return writer.bytes
  }

  public static async from<R extends SaveRecord>(
    dbpf: DBPF,
    entry: DBPFEntryInfo,
    parser: SaveRecordParser<R>,
    checkCRC?: boolean,
  ): Promise<SaveSubfileMulti<R>> {
    const bytes = await dbpf.getBytes(entry.id)
    const reader = new BinaryReader(bytes)

    const records: R[] = []

    while (reader.offset < reader.length) {
      const record = parser.parseRecord(reader, checkCRC)
      records.push(record)
    }

    return new this(entry, records)
  }
}
