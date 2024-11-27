const numberFormat = Intl.NumberFormat("en-US", { notation: "standard" })

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function formatSimoleans(value: number): string {
  return `${numberFormat.format(value)} §`
}
