import { Box, Divider } from "@mui/material"

import { PackageList, PackageListFilters } from "@components/PackageList"
import { useFilteredPackages } from "@utils/packages"

function Packages(): JSX.Element {
  const packageIds = useFilteredPackages()

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PackageListFilters />
      <Divider />
      <PackageList packageIds={packageIds} />
    </Box>
  )
}

export default Packages
