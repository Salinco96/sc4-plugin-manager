import type { DBPFInfo } from "@common/dbpf"
import { DBPFEntries } from "@components/File/DBPFEntries"
import { DBPFEntry } from "@components/File/DBPFEntry"
import { Loader } from "@components/Loader"

export function PluginsFileEntries({ data }: { data?: DBPFInfo }) {
  if (!data) {
    return <Loader />
  }

  return (
    <DBPFEntries
      entries={data.entries}
      renderEntry={entry => (
        <DBPFEntry
          entry={entry}
          key={entry.id}
          loadEntry={() => Promise.resolve()}
          patchFile={() => Promise.resolve()}
          isLocal
        />
      )}
    />
  )
}
