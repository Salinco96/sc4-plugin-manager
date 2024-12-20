import { Box, Divider } from "@mui/material"

import { PackageList } from "@components/PackageList/PackageList"
import { PackageListFilters } from "@components/PackageList/PackageListFilters"
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
