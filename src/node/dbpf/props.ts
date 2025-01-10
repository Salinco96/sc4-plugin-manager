import { toHex } from "@salinco/nice-utils"

import type { GroupID, TypeID } from "@common/dbpf"
import { ExemplarPropertyID } from "@common/exemplars"

import type { FamilyID } from "@common/families"
import type { PropID, PropInfo } from "@common/props"
import { split } from "@common/utils/string"
import type { Exemplar } from "./types"
import { getArray, getModelId, getString, getTGI } from "./utils"

export function getPropInfo(exemplar: Exemplar): PropInfo {
  const [, group, id] = split(exemplar.id, "-") as [TypeID, GroupID, PropID]

  const data: PropInfo = {
    file: exemplar.file,
    group,
    id,
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
    data.model = model.endsWith("00000000") ? null : getModelId(model)
  }

  return data
}
