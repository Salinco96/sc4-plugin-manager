import { ExemplarPropertyID } from "@common/exemplars"
import type { FloraData } from "@node/data/mmps"
import { getModelId } from "src/scripts/dbpf/dbpf"
import type { Exemplar } from "./types"
import { getString, getTGI } from "./utils"

export function getFloraData(exemplar: Exemplar): FloraData {
  const data: FloraData = {}

  const name = getString(exemplar, ExemplarPropertyID.ExemplarName)
  if (name?.length) {
    data.name = name
  }

  // todo: UserVisibleNameKey
  const label = getString(exemplar, ExemplarPropertyID.ItemLabel)
  if (label?.length) {
    data.label = label
  }

  // todo: ItemDescriptionKey
  const description = getString(exemplar, ExemplarPropertyID.ItemDescription)
  if (description?.length) {
    data.description = description
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
