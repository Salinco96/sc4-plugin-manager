import { Box, Divider } from "@mui/material"

import { PackageList } from "@renderer/components/PackageList"
import { PackageListFilters } from "@renderer/components/PackageListFilters"

function Packages(): JSX.Element {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PackageListFilters />
      <Divider />
      <PackageList />
    </Box>
  )
}

export default Packages
