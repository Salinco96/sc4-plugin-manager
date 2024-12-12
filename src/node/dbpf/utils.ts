import { isArray, isNumber, isString, toHex } from "@salinco/nice-utils"

import { TGI, parseTGI } from "@common/dbpf"
import type { ExemplarPropertyID } from "@common/exemplars"

import type { Exemplar } from "./types"

export function bitMask(value: number, mask: number): number {
  return (value & mask) >>> 0
}

export function get(exemplar: Exemplar, id: ExemplarPropertyID, index = 0): number | undefined {
  const value = exemplar.data?.properties[id]?.value

  if (isArray(value)) {
    return value.at(index)
  }

  if (index === 0 && isNumber(value)) {
    return value
  }
}

export function getArray(exemplar: Exemplar, id: ExemplarPropertyID): number[] | undefined {
  const value = exemplar.data?.properties[id]?.value

  if (isArray(value)) {
    return value
  }

  if (isNumber(value)) {
    return [value]
  }
}

export function getBool(exemplar: Exemplar, id: ExemplarPropertyID): boolean | undefined {
  const value = exemplar.data?.properties[id]?.value

  if (isArray(value)) {
    return !!value.at(0)
  }

  if (value !== undefined) {
    return !!value
  }
}

export function getMap<T extends number>(
  exemplar: Exemplar,
  id: ExemplarPropertyID,
): { [key in T]?: number } | undefined {
  const value = exemplar.data?.properties[id]?.value

  if (isArray(value) && value.length) {
    const result: { [key in T]?: number } = {}

    for (let i = 0; i < value.length / 2; i++) {
      result[value[i * 2] as T] = value[i * 2 + 1] || 0
    }

    return result
  }
}

export function getTGI(exemplar: Exemplar, id: ExemplarPropertyID): TGI | undefined {
  const value = exemplar.data?.properties[id]?.value

  if (isArray(value) && value.length === 3) {
    return TGI(value[0], value[1], value[2])
  }
}

export function getString(exemplar: Exemplar, id: ExemplarPropertyID): string | undefined {
  const value = exemplar.data?.properties[id]?.value

  if (isString(value)) {
    return value
  }
}

export function getBaseTextureId(instanceId: number): string {
  return bitMask(instanceId, 0x0000f000) > 0x00003000 // Ignore wealth/rotation
    ? `${toHex(instanceId, 8).slice(0, -3)}000`
    : `${toHex(instanceId, 8).slice(0, -4)}0000`
}

export function getFamilyInstanceId(familyId: number): number {
  return bitMask(familyId + 0x10000000, 0xffffffff)
}

export function getModelId(tgi: TGI): string {
  const [, g, i] = parseTGI(tgi)
  return bitMask(i, 0xffff0000) === 0x00030000
    ? toHex(g, 8)
    : `${toHex(g, 8)}-${toHex(bitMask(i, 0xffff0000), 8).slice(0, 4)}` // Ignore zoom/rotation
}
