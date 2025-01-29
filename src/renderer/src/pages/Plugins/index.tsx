import { FlexCol } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { PluginsBreadcrumbs } from "@components/Plugins/PluginsBreadcrumbs"
import { PluginsFile } from "@components/Plugins/PluginsFile"
import { PluginsFolder } from "@components/Plugins/PluginsFolder"
import { store } from "@stores/main"

function Plugins({ path }: { path?: string }): JSX.Element {
  const plugins = store.usePlugins()

  return (
    <FlexCol fullHeight>
      {plugins ? (
        path && plugins[path] ? (
          <PluginsFile file={plugins[path]} path={path} />
        ) : (
          <PluginsFolder path={path} plugins={plugins} />
        )
      ) : (
        <>
          <PluginsBreadcrumbs path={path} />
          <Loader />
        </>
      )}
    </FlexCol>
  )
}

export default Plugins
