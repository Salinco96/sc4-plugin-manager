import { useMemo } from "react"

import { ArrowBack as BackIcon, SearchOff as NoResultIcon } from "@mui/icons-material"
import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, IconButton, Tab, Tooltip, Typography } from "@mui/material"
import { values } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { AuthorID } from "@common/authors"
import { AuthorHeader } from "@components/AuthorHeader"
import { FlexBox } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { PackageList } from "@components/PackageList/PackageList"
import { useHistory } from "@utils/navigation"
import { useStore } from "@utils/store"

function AuthorViewInner({ authorId }: { authorId: AuthorID }): JSX.Element {
  const isLoading = useStore(store => !store.authors)
  const exists = useStore(store => !!store.authors?.[authorId])
  const packages = useStore(store => store.packages)

  const packageIds = useMemo(() => {
    return values(packages ?? {})
      .filter(({ variants }) => values(variants).some(variantInfo => variantInfo.credits[authorId]))
      .map(packageInfo => packageInfo.id)
  }, [authorId, packages])

  const { t } = useTranslation("AuthorView")

  if (isLoading) {
    return <Loader />
  }

  if (exists) {
    return (
      <>
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
      </>
    )
  }

  return (
    <FlexBox
      alignItems="center"
      direction="column"
      flex={1}
      fontSize={40}
      justifyContent="center"
      height="100%"
    >
      <NoResultIcon fontSize="inherit" />
      <Typography variant="subtitle1">{t("missing", { authorId })}</Typography>
    </FlexBox>
  )
}

function AuthorView({ authorId }: { authorId: AuthorID }): JSX.Element {
  const history = useHistory()

  const { t } = useTranslation("General")

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
      <AuthorViewInner authorId={authorId} />
    </FlexBox>
  )
}

export default AuthorView
