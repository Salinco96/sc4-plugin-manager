import { toHex } from "@salinco/nice-utils"

import { TGI } from "@common/dbpf"
import { ExemplarPropertyID } from "@common/exemplars"
import type { PropData } from "@node/data/props"

import type { Exemplar } from "./types"
import { getArray, getModelId, getString, getTGI } from "./utils"

export function getPropData(exemplar: Exemplar): PropData {
  const data: PropData = {}

  const name = getString(exemplar, ExemplarPropertyID.ExemplarName)
  if (name?.length) {
    data.name = name
  }

  const familyIds = getArray(exemplar, ExemplarPropertyID.PropFamily)
  if (familyIds?.length) {
    data.family = familyIds.map(familyId => toHex(familyId, 8)).join(",")
  }

  // TODO: Other possibilities?
  const model =
    getTGI(exemplar, ExemplarPropertyID.ResourceKeyType0) ??
    getTGI(exemplar, ExemplarPropertyID.ResourceKeyType1)
  if (model) {
    data.model = model === TGI(0, 0, 0) ? null : getModelId(model)
  }

  return data
}
