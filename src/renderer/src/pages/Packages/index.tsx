import { Box, Divider } from "@mui/material"

import { PackageList } from "@components/PackageList/PackageList"
import { PackageListFilters } from "@components/PackageList/PackageListFilters"
import { store } from "@stores/main"

function Packages(): JSX.Element {
  const packageIds = store.useFilteredPackages()

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PackageListFilters />
      <Divider />
      <PackageList packageIds={packageIds} />
    </Box>
  )
}

export default Packages
