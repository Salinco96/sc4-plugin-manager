import { Box, Divider } from "@mui/material"

import { PackageList, PackageListFilters } from "@renderer/components/PackageList"

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
