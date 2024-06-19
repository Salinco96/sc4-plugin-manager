import { ReactNode } from "react"

import { initReactI18next } from "react-i18next"

import { i18n, i18nConfig } from "@common/i18n"

i18n.use(initReactI18next).init(i18nConfig)

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>
}
