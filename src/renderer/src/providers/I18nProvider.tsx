import type { ReactNode } from "react"

import { initReactI18next } from "react-i18next"

import { i18n, initI18n } from "@common/i18n"

initI18n(i18n.use(initReactI18next))

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>
}
