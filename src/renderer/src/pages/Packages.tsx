import Divider from "@mui/material/Divider"

import { PackageList } from "@renderer/components/PackageList"
import { PackageListFilters } from "@renderer/components/PackageListFilters"

function Packages(): JSX.Element {
  return (
    <>
      <PackageListFilters />
      <Divider />
      <PackageList />
    </>
  )
}

export default Packages
