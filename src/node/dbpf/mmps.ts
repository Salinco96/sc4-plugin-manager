import { DBPFDataType, TGI, type DBPFFile } from "@common/dbpf"
import { ExemplarPropertyID } from "@common/exemplars"
import type { FloraData } from "@node/data/mmps"

import type { Exemplar } from "./types"
import { getModelId, getString, getTGI } from "./utils"

export function getFloraData(exemplar: Exemplar, file: DBPFFile): FloraData {
  const data: FloraData = {}

  const name = getString(exemplar, ExemplarPropertyID.ExemplarName)
  if (name?.length) {
    data.name = name
  }

  const label = getString(exemplar, ExemplarPropertyID.ItemLabel)
  const labelTGI = getTGI(exemplar, ExemplarPropertyID.UserVisibleNameKey)
  const labelEntry = labelTGI ? file.entries[labelTGI] : undefined
  if (labelEntry?.type === DBPFDataType.LTEXT && labelEntry.data) {
    data.label = labelEntry.data.text
  } else if (label?.length) {
    data.label = label
  }

  const description = getString(exemplar, ExemplarPropertyID.ItemDescription)
  const descriptionTGI = getTGI(exemplar, ExemplarPropertyID.ItemDescriptionKey)
  const descriptionEntry = descriptionTGI ? file.entries[descriptionTGI] : undefined
  if (descriptionEntry?.type === DBPFDataType.LTEXT && descriptionEntry.data) {
    data.description = descriptionEntry.data.text
  } else if (description?.length) {
    data.description = description
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
