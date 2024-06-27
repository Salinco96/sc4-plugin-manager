import i18next, { Namespace, TFunction } from "i18next"

import en from "@config/i18n/en.json"

import { Feature } from "./types"
import { isNumber, isString } from "./utils/types"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "General"
    resources: typeof en
  }
}

export const i18n = i18next

export function initI18n(i18n: typeof i18next): void {
  i18n.init({
    defaultNS: "General",
    interpolation: {
      escapeValue: false,
      skipOnVariables: false,
    },
    lng: "en",
    resources: { en },
    returnEmptyString: true,
    returnObjects: true,
  })

  i18n.services.formatter?.addCached("bytes", lng => {
    const formatter = new Intl.NumberFormat(lng, {
      maximumFractionDigits: 2,
      notation: "compact",
      style: "unit",
      unit: "byte",
      unitDisplay: "narrow",
    })

    return value => {
      if (isString(value)) {
        return value
      }

      if (isNumber(value) && isFinite(value)) {
        return formatter.format(value)
      }

      return ""
    }
  })

  i18n.services.formatter?.add("join", (value, lng, { max, multiline, separator }) => {
    if (!Array.isArray(value)) {
      return ""
    }

    const labels = value.map(String)

    if (labels.length > max) {
      const count = labels.length - (max - 1)
      labels.splice(max - 1, count, i18n.t("others", { count, lng }))
    }

    if (multiline) {
      return labels.map(label => i18n.t("li", { label, lng })).join("\n")
    } else if (separator) {
      return labels.join(separator)
    } else {
      return new Intl.ListFormat(lng).format(labels)
    }
  })

  i18n.services.formatter?.add("paren", value => {
    if (isString(value)) {
      return value && i18n.t("paren", { value })
    }

    if (isNumber(value) && isFinite(value)) {
      return i18n.t("paren", { value })
    }

    return ""
  })

  i18n.services.formatter?.addCached("percent", lng => {
    const formatter = new Intl.NumberFormat(lng, {
      maximumFractionDigits: 0,
      notation: "compact",
      style: "percent",
    })

    return value => {
      if (isString(value)) {
        return value
      }

      if (isNumber(value) && isFinite(value)) {
        return formatter.format(value / 100)
      }

      return ""
    }
  })
}

export const t = i18n.t

export function getFeatureLabel(
  t: TFunction<Namespace>,
  feature: Feature,
  style: "full" | "short" | "long" = "long",
): string {
  return t(`${feature}.${style}`, { defaultValue: feature, ns: "Features" })
}
