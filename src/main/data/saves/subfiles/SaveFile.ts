import type { FileHandle } from "node:fs/promises"

import { forEach, values } from "@salinco/nice-utils"

import { type DBPFEntry, type DBPFFile, type TGI, parseTGI } from "@common/dbpf"
import { loadDBPF, patchVariantFileEntries } from "@node/dbpf"

import { BuildingRecord } from "./BuildingRecord"
import { LotRecord } from "./LotRecord"
import type { SaveRecordParser } from "./SaveRecord"
import { SaveSubfileMulti, SaveSubfileType } from "./SaveSubfile"
import { SimGrid, type SimGridDataID } from "./SimGrid"

type SaveSubfileRecordType<T extends SaveSubfileType> = {
  [SaveSubfileType.Buildings]: BuildingRecord
  [SaveSubfileType.Lots]: LotRecord
  [SaveSubfileType.SimGridFloat32]: SimGrid
  [SaveSubfileType.SimGridSInt16]: SimGrid
  [SaveSubfileType.SimGridSInt8]: SimGrid
  [SaveSubfileType.SimGridUInt16]: SimGrid
  [SaveSubfileType.SimGridUInt32]: SimGrid
  [SaveSubfileType.SimGridUInt8]: SimGrid
}[T]

const SaveSubfileRecordParser: {
  [T in SaveSubfileType]: SaveRecordParser<SaveSubfileRecordType<T>>
} = {
  [SaveSubfileType.Buildings]: BuildingRecord,
  [SaveSubfileType.Lots]: LotRecord,
  [SaveSubfileType.SimGridFloat32]: SimGrid,
  [SaveSubfileType.SimGridSInt16]: SimGrid,
  [SaveSubfileType.SimGridSInt8]: SimGrid,
  [SaveSubfileType.SimGridUInt16]: SimGrid,
  [SaveSubfileType.SimGridUInt32]: SimGrid,
  [SaveSubfileType.SimGridUInt8]: SimGrid,
}

const SimGridTypes = [
  SaveSubfileType.SimGridFloat32,
  SaveSubfileType.SimGridSInt16,
  SaveSubfileType.SimGridSInt8,
  SaveSubfileType.SimGridUInt16,
  SaveSubfileType.SimGridUInt32,
  SaveSubfileType.SimGridUInt8,
] as const

export class SaveFile {
  public readonly file: FileHandle

  private contents?: DBPFFile

  private readonly grids: {
    [T in SimGridDataID]?: SimGrid | null
  } = {}

  private readonly subfiles: {
    [T in SaveSubfileType]?: SaveSubfileMulti<SaveSubfileRecordType<T>> | null
  } = {}

  public constructor(file: FileHandle) {
    this.file = file
  }

  public isDirty(): boolean {
    return values(this.subfiles).some(subfile => subfile?.isDirty())
  }

  public async entries(): Promise<{ [entryId in TGI]?: DBPFEntry }> {
    this.contents ??= await loadDBPF(this.file, { exemplarProperties: {} })
    return this.contents.entries
  }

  public async grid(dataId: SimGridDataID): Promise<SimGrid | null> {
    if (this.grids[dataId] !== undefined) {
      return this.grids[dataId]
    }

    for (const type of SimGridTypes) {
      const subfile = await this.subfile(type)
      if (subfile) {
        for (const grid of subfile.data) {
          this.grids[grid.dataId] = grid
        }
      }
    }

    this.grids[dataId] ??= null
    return this.grids[dataId]
  }

  public async buildings(): Promise<SaveSubfileMulti<BuildingRecord> | null> {
    return this.subfile(SaveSubfileType.Buildings)
  }

  public async lots(): Promise<SaveSubfileMulti<LotRecord> | null> {
    return this.subfile(SaveSubfileType.Lots)
  }

  public async write(outFile: FileHandle): Promise<void> {
    const patches: { [tgi in TGI]: Buffer } = {}

    forEach(this.subfiles, subfile => {
      if (subfile?.isDirty()) {
        patches[subfile.tgi] = subfile.toBytes()
      }
    })

    await patchVariantFileEntries(this.file, outFile, patches, { exemplarProperties: {} })
  }

  protected async subfile<T extends SaveSubfileType>(
    type: T,
  ): Promise<SaveSubfileMulti<SaveSubfileRecordType<T>> | null> {
    if (this.subfiles[type] !== undefined) {
      return this.subfiles[type]
    }

    const entries = await this.entries()
    for (const entry of values(entries)) {
      const entryType: number = parseTGI(entry.id)[0]
      if (entryType === type) {
        const parser = SaveSubfileRecordParser[type]
        const subfile = await SaveSubfileMulti.from(this.file, entry, parser)
        this.subfiles[type] = subfile as (typeof this.subfiles)[T]
        return subfile
      }
    }

    this.subfiles[type] = null
    return null
  }
}
