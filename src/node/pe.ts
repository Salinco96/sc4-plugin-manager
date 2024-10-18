import { FileHandle } from "fs/promises"

import { assert } from "@common/utils/types"

import { readBytes, writeBytes } from "./files"

/** PE flags */
export enum PEFlag {
  LARGE_ADDRESS_AWARE = 0x0020,
}

/** Size of MZ header in bytes */
export const MZ_HEADER_SIZE = 0x40

/** Offset to PE header offset within MZ header */
export const MZ_HEADER_PE_OFFSET = 0x3c

/** MZ signature (2 bytes) */
export const MZ_SIGNATURE = 0x5a4d

/** Size of PE header in bytes */
export const PE_HEADER_SIZE = 0x18

/** Offset to flags within PE header */
export const PE_HEADER_FLAGS_OFFSET = 0x16

/** PE signature (4 bytes) */
export const PE_SIGNATURE = 0x00004550

export function getFlag(bits: number, flag: number): boolean {
  return (bits & flag) === flag
}

export function setFlag(bits: number, flag: number, enabled: boolean): number {
  return enabled ? bits | flag : bits ^ (bits & flag)
}

export async function getPEHeaderOffset(file: FileHandle): Promise<number> {
  const header = await readBytes(file, MZ_HEADER_SIZE)
  assert(header.readUInt16LE(0) === MZ_SIGNATURE, "Invalid MZ header signature")
  return header.readInt32LE(MZ_HEADER_PE_OFFSET)
}

export async function getPEHeader(file: FileHandle): Promise<Buffer> {
  const offset = await getPEHeaderOffset(file)
  const header = await readBytes(file, PE_HEADER_SIZE, offset)
  assert(header.readUInt32LE(0) === PE_SIGNATURE, "Invalid PE header signature")
  return header
}

export async function setPEHeader(file: FileHandle, header: Buffer): Promise<void> {
  assert(header.length === PE_HEADER_SIZE, "Invalid PE header size")
  assert(header.readUInt32LE(0) === PE_SIGNATURE, "Invalid PE header signature")
  const offset = await getPEHeaderOffset(file)
  await writeBytes(file, header, offset)
}

export function getPEFlag(header: Buffer, flag: PEFlag): boolean {
  const flags = header.readUInt16LE(PE_HEADER_FLAGS_OFFSET)
  return getFlag(flags, flag)
}

export function setPEFlag(header: Buffer, flag: PEFlag, enabled: boolean): void {
  const oldFlags = header.readUInt16LE(PE_HEADER_FLAGS_OFFSET)
  const newFlags = setFlag(oldFlags, flag, enabled)
  header.writeUInt16LE(newFlags, PE_HEADER_FLAGS_OFFSET)
}
