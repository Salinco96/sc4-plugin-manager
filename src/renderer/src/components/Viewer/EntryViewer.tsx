import { DBPFDataType, type DBPFEntry } from "@common/dbpf"
import type { ExemplarDataPatch } from "@common/exemplars"

import { ExemplarViewer } from "./ExemplarViewer/ExemplarViewer"
import { ImageViewer } from "./ImageViewer"
import { TextViewer } from "./TextViewer"

export type EntryViewerProps = {
  entry: DBPFEntry
  isLocal: boolean
  onClose: () => void
  onPatch: (data: ExemplarDataPatch | null) => void
  open: boolean
  readonly?: boolean
}

export function EntryViewer({
  entry,
  isLocal,
  onClose,
  onPatch,
  open,
  readonly,
}: EntryViewerProps): JSX.Element | null {
  if (!entry.data) {
    return null
  }

  switch (entry.type) {
    case DBPFDataType.EXMP: {
      return (
        <ExemplarViewer
          data={entry.data}
          id={entry.id}
          isLocal={isLocal}
          onClose={onClose}
          onPatch={onPatch}
          open={open}
          original={entry.original}
          readonly //={readonly}
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
