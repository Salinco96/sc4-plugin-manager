import { Theme } from "@mui/material"

export function spacing(value: number): ({ theme }: { theme: Theme }) => string {
  return ({ theme }) => theme.spacing(value)
}
