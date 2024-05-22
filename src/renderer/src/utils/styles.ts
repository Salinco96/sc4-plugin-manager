import { Theme } from "@mui/material/styles"

export function spacing(value: number): ({ theme }: { theme: Theme }) => string {
  return ({ theme }) => theme.spacing(value)
}
