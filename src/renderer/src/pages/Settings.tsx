import { useStore } from "@renderer/utils/store"

function Settings(): JSX.Element {
  const settings = useStore(store => store.settings)

  return (
    <pre style={{ width: "100%" }}>
      {JSON.stringify(settings, undefined, 2)}
      <br />
      DLL mods require{" "}
      <a
        href="https://visualstudio.microsoft.com/downloads/#microsoft-visual-c-redistributable-for-visual-studio-2022"
        rel="noreferrer"
        target="_blank"
      >
        Microsoft Visual C++ Redistributable for Visual Studio
      </a>
      <br />
      Download link:{" "}
      <a href="https://aka.ms/vs/17/release/vc_redist.x86.exe" rel="noreferrer" target="_blank">
        https://aka.ms/vs/17/release/vc_redist.x86.exe
      </a>
    </pre>
  )
}

export default Settings
