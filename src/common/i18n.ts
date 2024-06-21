import i18next from "i18next"

import en from "@config/i18n/en.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "General"
    resources: typeof en
  }
}

export const i18n = i18next

export function initI18n(i18n: typeof i18next): void {
  i18n.init({
    debug: true,
    defaultNS: "General",
    interpolation: { escapeValue: false },
    lng: "en",
    resources: { en },
    returnEmptyString: true,
    returnObjects: true,
  })

  i18n.services.formatter?.add("bytes", (value, lng, { paren }) => {
    if (typeof value === "string") {
      return value
    }

    if (typeof value !== "number" || !isFinite(value)) {
      return ""
    }

    const formatted = value.toLocaleString(lng, {
      maximumFractionDigits: 2,
      notation: "compact",
      style: "unit",
      unit: "byte",
      unitDisplay: "narrow",
    })

    return paren ? i18n.t("paren", { value: formatted }) : formatted
  })

  i18n.services.formatter?.add(
    "join",
    (value, lng, { format, key, multiline, ns, separator, ...rest }) => {
      if (!Array.isArray(value)) {
        return ""
      }

      const labels = value.map(item => {
        if (key) {
          if (typeof item === "object") {
            return i18n.t(key, { lng, ns, ...rest, ...item })
          } else {
            return i18n.t(key, { lng, ns, ...rest, value: item })
          }
        }

        if (format) {
          return i18n.format(item, format, lng, rest)
        }

        return String(item)
      })

      if (multiline) {
        return labels.map(label => i18n.t("li", { label, lng, ns: "General", ...rest })).join("\n")
      } else if (separator) {
        return labels.join(separator)
      } else {
        return new Intl.ListFormat(lng, { type: "unit" }).format(labels)
      }
    },
  )

  i18n.services.formatter?.add("name", value => String(value?.name ?? value))

  i18n.services.formatter?.add("percent", (value, lng, { paren }) => {
    if (typeof value === "string") {
      return value
    }

    if (typeof value !== "number" || !isFinite(value)) {
      return ""
    }

    const formatted = value.toLocaleString(lng, {
      maximumFractionDigits: 0,
      notation: "compact",
      style: "percent",
    })

    return paren ? i18n.t("paren", { value: formatted }) : formatted
  })

  i18n.services.formatter?.add("pluralize", (value, lng, { interpolationkey, key, ...options }) => {
    const count = typeof value === "number" ? value : value?.length ?? 0
    return i18n.t(key, { lng, ...options, count }) as string
  })
}

export const t = i18n.t

export function toList(items: string[], compact?: boolean): string {
  return compact ? items.join(t("sep")) : items.map(label => t("li", { label })).join("\n")
}
