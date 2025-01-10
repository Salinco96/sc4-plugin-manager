import { isArray, isNumber, isString } from "@salinco/nice-utils"

import { TGI } from "@common/dbpf"
import type { ExemplarPropertyID } from "@common/exemplars"

import { split } from "@common/utils/string"
import { bitMask } from "@common/utils/types"
import type { ModelID } from "@common/variants"
import type { Exemplar } from "./types"

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

export function getFamilyInstanceId(familyId: number): number {
  return bitMask(familyId + 0x10000000, 0xffffffff)
}

export function getModelId(tgi: TGI): ModelID {
  const [, groupId, instanceId] = split(tgi, "-")
  return `${groupId}-${instanceId.slice(0, 4)}0000` as ModelID // Ignore zoom/rotation
}
