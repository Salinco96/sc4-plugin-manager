import type { ExemplarProperty, ExemplarPropertyValue } from "@common/exemplars"
import { FlexCol } from "@components/FlexBox"

import { ExemplarPropertyHelperText } from "./ExemplarPropertyHelperText"
import { ExemplarPropertyInputGroup } from "./ExemplarPropertyInputGroup"

export interface ExemplarPropertySingleProps {
  error: string | undefined
  onChange: (newValue: ExemplarPropertyValue | null) => void
  original: boolean | number | string | null | undefined
  name: string
  property: ExemplarProperty
  readonly: boolean
  value: boolean | number | string
}

export function ExemplarPropertySingle({
  error,
  name,
  onChange,
  original,
  property,
  readonly,
  value,
}: ExemplarPropertySingleProps): JSX.Element {
  return (
    <FlexCol my={2}>
      {
        <ExemplarPropertyInputGroup<[number] | [string] | [boolean]>
          canRemove={false}
          errors={error}
          groupIndex={0}
          groupSize={1}
          isExpandable={false}
          isExpanded
          isFirstGroup
          isLastGroup
          name={name}
          onChange={newValues => onChange(newValues[0])}
          onRemove={() => onChange(null)}
          original={original === null || original === undefined ? original : [original]}
          property={property}
          readonly={readonly}
          showRightMargin={false}
          value={[value]}
        />
      }
      <ExemplarPropertyHelperText
        error={error}
        onChange={onChange}
        original={original}
        property={property}
        readonly={readonly}
      />
    </FlexCol>
  )
}
