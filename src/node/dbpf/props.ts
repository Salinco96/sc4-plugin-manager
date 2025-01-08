import { toHex } from "@salinco/nice-utils"

import { TGI, parseTGI } from "@common/dbpf"
import { ExemplarPropertyID } from "@common/exemplars"

import type { FamilyID } from "@common/families"
import type { PropID, PropInfo } from "@common/props"
import type { Exemplar } from "./types"
import { getArray, getModelId, getString, getTGI } from "./utils"

export function getPropInfo(exemplar: Exemplar): PropInfo {
  const data: PropInfo = {
    file: exemplar.file,
    id: toHex(parseTGI(exemplar.id)[2], 8) as PropID,
  }

  const name = getString(exemplar, ExemplarPropertyID.ExemplarName)
  if (name?.length) {
    data.name = name
  }

  const familyIds = getArray(exemplar, ExemplarPropertyID.PropFamily)
  if (familyIds?.length) {
    data.families = familyIds.map(familyId => toHex(familyId, 8) as FamilyID)
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
