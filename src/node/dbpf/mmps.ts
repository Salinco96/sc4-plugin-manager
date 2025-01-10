import { DBPFDataType, type DBPFFile, type GroupID, type TypeID } from "@common/dbpf"
import { ExemplarPropertyID } from "@common/exemplars"

import type { FloraID, FloraInfo } from "@common/mmps"
import { split } from "@common/utils/string"
import type { Exemplar } from "./types"
import { getModelId, getString, getTGI } from "./utils"

export function getFloraInfo(exemplar: Exemplar, file: DBPFFile): FloraInfo {
  const [, group, id] = split(exemplar.id, "-") as [TypeID, GroupID, FloraID]

  const data: FloraInfo = {
    file: exemplar.file,
    group,
    id,
  }

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
    data.model = model.endsWith("00000000") ? null : getModelId(model)
  }

  return data
}
