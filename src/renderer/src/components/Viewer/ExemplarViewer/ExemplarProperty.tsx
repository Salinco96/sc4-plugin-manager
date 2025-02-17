import { isArray, toHex } from "@salinco/nice-utils"

import type {
  ExemplarProperty as ExemplarPropertyType,
  ExemplarPropertyValue,
} from "@common/exemplars"

import { ExemplarPropertyArray } from "./ExemplarPropertyArray"
import { ExemplarPropertySingle } from "./ExemplarPropertySingle"
import type { PropertyErrors } from "./utils"

export interface ExemplarPropertyProps {
  errors: PropertyErrors | undefined
  onChange: (newValue: ExemplarPropertyValue | null) => void
  original: ExemplarPropertyValue | null | undefined
  property: ExemplarPropertyType
  readonly: boolean
}

export function ExemplarProperty({
  errors,
  onChange,
  original,
  property,
  readonly,
}: ExemplarPropertyProps): JSX.Element {
  const { id, value } = property

  const name = `0x${toHex(id, 8)}`

  if (isArray(value)) {
    return (
      <ExemplarPropertyArray
        errors={errors}
        name={name}
        onChange={onChange}
        original={isArray(original) || original === null ? original : undefined}
        property={property}
        readonly={readonly}
        value={value}
      />
    )
  }

  return (
    <ExemplarPropertySingle
      error={isArray(errors) ? errors.at(0) : errors}
      name={name}
      onChange={onChange}
      original={isArray(original) ? original.at(0) : original}
      property={property}
      readonly={readonly}
      value={value}
    />
  )
}
