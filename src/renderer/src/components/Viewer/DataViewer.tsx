import { DBPFEntryData } from "@common/dbpf"
import { ExemplarValueType } from "@common/exemplars"

import { ImageViewer } from "./ImageViewer"
import { TextViewer } from "./TextViewer"

export interface DataViewerProps {
  data: DBPFEntryData
  onClose: () => void
  open: boolean
}

export function DataViewer({ data, open, onClose }: DataViewerProps): JSX.Element | null {
  if ("base64" in data) {
    return (
      <ImageViewer
        images={[`data:image/${data.type};base64, ${data.base64}`]}
        onClose={onClose}
        open={open}
      />
    )
  }

  if ("text" in data) {
    return <TextViewer onClose={onClose} open={open} text={data.text} />
  }

  if ("properties" in data) {
    return (
      <TextViewer
        onClose={onClose}
        open={open}
        text={`- Parent Cohort ID: ${data.parentCohortId}
${data.properties.map(property =>
  property.info
    ? `- ${property.info.name} (0x${property.id.toString(16).padStart(8, "0")}): (${ExemplarValueType[property.type]}) ${JSON.stringify(property.value)}`
    : `- 0x${property.id.toString(16).padStart(8, "0")}: (${ExemplarValueType[property.type]}) ${JSON.stringify(property.value)}`,
).join(`
`)}`}
      />
    )
  }

  return null
}
