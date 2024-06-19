import i18next, { InitOptions } from "i18next"

import en from "@config/i18n/en.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "General"
    resources: typeof en
  }
}

export const i18n = i18next

export const i18nConfig: InitOptions = {
  defaultNS: "General",
  lng: "en",
  resources: { en },
}

export const t = i18n.t
