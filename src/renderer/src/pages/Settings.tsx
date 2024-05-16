import { useStore } from "@renderer/utils/store"

function Settings(): JSX.Element {
  const settings = useStore(store => store.settings)

  return <pre style={{ width: "100%" }}>{JSON.stringify(settings, undefined, 2)}</pre>
}

export default Settings
