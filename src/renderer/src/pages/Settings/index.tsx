import {
  FormControl,
  FormControlLabel,
  FormGroup,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material"

import { FlexBox } from "@components/FlexBox"
import { Text } from "@components/Text"
import { useStore, useStoreActions } from "@utils/store"

function Settings(): JSX.Element {
  const settings = useStore(store => store.settings)
  const actions = useStoreActions()

  return (
    <FlexBox direction="column" height="100%" gap={2} p={2}>
      <FormControl component="fieldset">
        <FormGroup>
          <FlexBox alignItems="center" height={38} gap={2}>
            <Typography sx={{ flex: 1 }}>Installation path</Typography>
            {settings?.install?.path ? (
              <Tooltip arrow placement="left" title="Open in Explorer">
                <Text
                  color="primary"
                  maxLines={1}
                  onClick={() => actions.openInstallationDirectory()}
                  sx={{ cursor: "pointer" }}
                >
                  {settings.install.path}
                </Text>
              </Tooltip>
            ) : (
              "..."
            )}
          </FlexBox>
          <FlexBox alignItems="center" height={38} gap={2}>
            <Typography sx={{ flex: 1 }}>Executable version</Typography>
            {settings?.install?.version ? (
              <Tooltip arrow placement="left" title="Open in Explorer">
                <Text
                  color="primary"
                  maxLines={1}
                  onClick={() => actions.openExecutableDirectory()}
                  sx={{ cursor: "pointer" }}
                >
                  {settings.install.version}
                </Text>
              </Tooltip>
            ) : (
              "..."
            )}
          </FlexBox>
          <FormControlLabel
            checked={!!settings?.install?.patched}
            control={<Switch color="primary" />}
            disabled={!settings?.install || !!settings?.install?.patched}
            label="4GB Patch"
            labelPlacement="start"
            onChange={async event => {
              const value = (event.target as HTMLInputElement).checked
              if (value) {
                await actions.check4GBPatch()
              }
            }}
            slotProps={{ typography: { sx: { flex: 1 } } }}
            sx={{ marginLeft: 0 }}
            title={settings?.install?.patched ? "The 4GB Patch has been applied." : undefined}
          />
        </FormGroup>
      </FormControl>
    </FlexBox>
  )

  // return (
  //   <pre style={{ width: "100%" }}>
  //     {JSON.stringify(settings, undefined, 2)}
  //     <br />
  //     DLL mods require{" "}
  //     <a
  //       href="https://visualstudio.microsoft.com/downloads/#microsoft-visual-c-redistributable-for-visual-studio-2022"
  //       rel="noreferrer"
  //       target="_blank"
  //     >
  //       Microsoft Visual C++ Redistributable for Visual Studio
  //     </a>
  //     <br />
  //     Download link:{" "}
  //     <a href="https://aka.ms/vs/17/release/vc_redist.x86.exe" rel="noreferrer" target="_blank">
  //       https://aka.ms/vs/17/release/vc_redist.x86.exe
  //     </a>
  //   </pre>
  // )
}

export default Settings
