import { SearchOff as NoResultIcon } from "@mui/icons-material"
import { Box, Typography, styled } from "@mui/material"
import { useTranslation } from "react-i18next"

const Container = styled(Box)`
  align-items: center;
  display: flex;
  flex-direction: column;
  font-size: 40px;
  height: 100%;
  justify-content: center;
  width: "100%";
`

export function EmptyPackageList(): JSX.Element {
  const { t } = useTranslation("PackageList")

  return (
    <Container>
      <NoResultIcon fontSize="inherit" />
      <Typography variant="subtitle1">{t("emptyList")}</Typography>
    </Container>
  )
}
