import { toHex } from "@salinco/nice-utils"

import { ExemplarPropertyID } from "@common/exemplars"
import type { PropData } from "@node/data/props"

import type { FamilyID } from "@common/families"
import { getModelId } from "src/scripts/dbpf/dbpf"
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
    data.family = toHex(familyId, 8) as FamilyID
  }

  // TODO: Other possibilities?
  const model =
    getTGI(exemplar, ExemplarPropertyID.ResourceKeyType0) ??
    getTGI(exemplar, ExemplarPropertyID.ResourceKeyType1)
  if (model) {
    data.model = getModelId(model)
  }

  return data
}
