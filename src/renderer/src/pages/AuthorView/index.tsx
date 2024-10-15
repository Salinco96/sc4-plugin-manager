import { useMemo } from "react"

import { ArrowBack as BackIcon } from "@mui/icons-material"
import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, IconButton, Tab, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { AuthorID } from "@common/authors"
import { values } from "@common/utils/objects"
import { AuthorHeader } from "@components/AuthorHeader"
import { FlexBox } from "@components/FlexBox"
import { PackageList } from "@components/PackageList"
import { useHistory } from "@utils/navigation"
import { useStore } from "@utils/store"

function AuthorView({ authorId }: { authorId: AuthorID }): JSX.Element {
  const packages = useStore(store => store.packages)
  const history = useHistory()

  const packageIds = useMemo(() => {
    return values(packages ?? {})
      .filter(info => values(info.variants).some(variant => variant.authors.includes(authorId)))
      .map(info => info.id)
  }, [authorId, packages])

  const { t } = useTranslation("AuthorView")

  return (
    <FlexBox direction="column" height="100%" pt={1}>
      <Tooltip arrow placement="right" title="Go back">
        <IconButton
          aria-label={t("back", { ns: "General" })}
          color="inherit"
          onClick={() => history.back()}
          size="small"
          sx={{ alignSelf: "flex-start", marginLeft: 1 }}
        >
          <BackIcon />
        </IconButton>
      </Tooltip>
      <AuthorHeader authorId={authorId} />
      <TabContext value="packages">
        <Box borderBottom={1} borderColor="divider">
          <TabList>
            <Tab label={t("packages", { count: packageIds.length })} value="packages" />
          </TabList>
        </Box>
        <TabPanel sx={{ height: "100%", overflowY: "auto", padding: 0 }} value="packages">
          <PackageList packageIds={packageIds} />
        </TabPanel>
      </TabContext>
    </FlexBox>
  )
}

export default AuthorView
