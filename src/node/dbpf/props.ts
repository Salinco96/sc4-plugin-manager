import { toHex } from "@salinco/nice-utils"

import { ExemplarPropertyID } from "@common/exemplars"
import type { PropData } from "@common/props"

import type { Exemplar } from "./types"
import { get, getString, getTGI } from "./utils"

export function getPropData(exemplar: Exemplar): PropData {
  const data: PropData = {}

  const name = getString(exemplar, ExemplarPropertyID.ExemplarName)
  if (name?.length) {
    data.name = name
  }

  const familyId = get(exemplar, ExemplarPropertyID.PropFamily)
  if (familyId !== undefined) {
    data.family = toHex(familyId, 8)
  }

  // TODO: Other possibilities?
  const model =
    getTGI(exemplar, ExemplarPropertyID.ResourceKeyType0) ??
    getTGI(exemplar, ExemplarPropertyID.ResourceKeyType1)
  if (model) {
    data.model = model
  }

  return data
}
