import { DBPFDataType, DBPFEntry } from "@common/dbpf"
import { ExemplarDataPatch } from "@common/exemplars"

import { ExemplarViewer } from "./ExemplarViewer/ExemplarViewer"
import { ImageViewer } from "./ImageViewer"
import { TextViewer } from "./TextViewer"

export type DataViewerProps = {
  entry: DBPFEntry
  onClose: () => void
  onPatch: (data: ExemplarDataPatch | null) => void
  open: boolean
  readonly?: boolean
}

export function DataViewer({
  entry,
  onClose,
  onPatch,
  open,
  readonly,
}: DataViewerProps): JSX.Element | null {
  if (!entry.data) {
    return null
  }

  switch (entry.type) {
    case DBPFDataType.EXMP: {
      return (
        <ExemplarViewer
          data={entry.data}
          id={entry.id}
          onClose={onClose}
          onPatch={onPatch}
          open={open}
          original={entry.original}
          readonly={readonly}
        />
      )
    }

    case DBPFDataType.XML: {
      return <TextViewer onClose={onClose} open={open} text={entry.data.text} />
    }

    default: {
      const src = `data:image/${entry.type};base64, ${entry.data.base64}`
      return <ImageViewer images={[src]} onClose={onClose} open={open} />
    }
  }
}
