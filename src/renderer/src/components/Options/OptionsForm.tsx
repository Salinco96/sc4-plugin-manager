import { useMemo, useState } from "react"

import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  capitalize,
  useTheme,
} from "@mui/material"

import { OptionInfo, OptionValue, Options, Requirements } from "@common/options"

import { OptionsFormSection } from "./OptionsFormSection"
import { NOSECTION, getSections } from "./utils"

export function OptionsForm({
  options,
  ...props
}: {
  checkCondition: (conditions: Requirements | undefined) => boolean
  disabled?: boolean
  onChange: (option: OptionInfo, value: OptionValue) => void
  options: OptionInfo[]
  values: Options
}): JSX.Element {
  const sections = useMemo(() => getSections(options), [options])
  const theme = useTheme()

  const sectionIds = Object.keys(sections).filter(sectionId => sectionId !== NOSECTION)

  const [expanded, setExpanded] = useState<string | undefined>(sectionIds[0])

  return (
    <FormControl component="fieldset" fullWidth sx={{ gap: 2, mt: 1 }}>
      {sections[NOSECTION] && <OptionsFormSection {...props} options={sections[NOSECTION]} />}
      <FormControl component="fieldset" fullWidth>
        {sectionIds.map(sectionId => (
          <Accordion
            disableGutters
            elevation={0}
            expanded={expanded === sectionId}
            key={sectionId}
            onChange={() => setExpanded(expanded === sectionId ? undefined : sectionId)}
            sx={{
              border: `1px solid ${theme.palette.divider}`,
              "&:not(:last-child)": { borderBottom: 0 },
              "&::before": { display: "none" },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              {capitalize(sectionId)}
            </AccordionSummary>
            <AccordionDetails>
              <OptionsFormSection {...props} options={sections[sectionId]} />
            </AccordionDetails>
          </Accordion>
        ))}
      </FormControl>
    </FormControl>
  )
}
