import type { DBPFInfo } from "@common/dbpf"
import { DBPFEntries } from "@components/File/DBPFEntries"
import { DBPFEntry } from "@components/File/DBPFEntry"
import { Loader } from "@components/Loader"
import { loadPluginFileEntry, patchPluginFileEntries } from "@stores/actions"

export function PluginsFileEntries({
  data,
  path,
  setFileData,
}: { data?: DBPFInfo; path: string; setFileData: (data: DBPFInfo) => void }) {
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
          loadEntry={async entryId => {
            const entry = await loadPluginFileEntry(path, entryId)
            setFileData({ ...data, entries: { ...data.entries, [entryId]: entry } })
          }}
          patchFile={async patches => {
            setFileData(await patchPluginFileEntries(path, patches))
          }}
          isLocal
        />
      )}
    />
  )
}
