import { TGI } from "./dbpf"

export interface ExemplarData {
  isCohort: boolean
  parentCohortId: TGI
  properties: {
    [propertyId in number]?: ExemplarProperty
  }
}

export interface ExemplarDataPatch {
  parentCohortId?: TGI
  properties?: {
    [propertyId in string]?: ExemplarPropertyValue | null
  }
}

export interface ExemplarPropertyChoiceInfo {
  desc?: string
  label: string
  value: number
}

export interface ExemplarPropertyItemInfo {
  choices?: ExemplarPropertyChoiceInfo[]
  default?: boolean | number | string
  desc?: string
  max?: number
  min?: number
  name: string
  step?: number
  unit?: string
}

export interface ExemplarPropertyData {
  choices?: ExemplarPropertyChoiceInfo[]
  default?: boolean | number | string
  desc?: string
  display?: "hex" | "tgi"
  items?: ExemplarPropertyItemInfo[]
  max?: number
  maxLength?: number
  min?: number
  minLength?: number
  name: string
  repeat?: boolean
  size?: number
  step?: number
  strict?: boolean
  type?: keyof typeof ExemplarValueType
  unit?: string
}

export interface ExemplarPropertyInfo {
  choices?: ExemplarPropertyChoiceInfo[]
  default?: boolean | number | string
  desc?: string
  display?: "hex" | "tgi"
  id?: number
  items?: ExemplarPropertyItemInfo[]
  max?: number
  maxLength?: number
  min?: number
  minLength?: number
  name: string
  repeat?: boolean
  size?: number
  step?: number
  strict?: boolean
  type?: ExemplarValueType
  unit?: string
}

export type ExemplarProperty<T extends ExemplarValueType = ExemplarValueType> = {
  [S in T]: {
    id: number
    info?: ExemplarPropertyInfo
    type: S
    value: ExemplarPropertyValue<S>
  }
}[T]

export type ExemplarPropertyValue<
  T extends ExemplarValueType = ExemplarValueType,
  Multi extends boolean = boolean,
> = {
  [ExemplarValueType.UInt8]: Multi extends true ? number[] : number
  [ExemplarValueType.UInt16]: Multi extends true ? number[] : number
  [ExemplarValueType.UInt32]: Multi extends true ? number[] : number
  [ExemplarValueType.SInt32]: Multi extends true ? number[] : number
  [ExemplarValueType.SInt64]: Multi extends true ? number[] : number
  [ExemplarValueType.Float32]: Multi extends true ? number[] : number
  [ExemplarValueType.Bool]: Multi extends true ? never : boolean // todo: is multi bool allowed?
  [ExemplarValueType.String]: Multi extends true ? string : never
}[T]

export enum ExemplarValueType {
  UInt8 = 0x100,
  UInt16 = 0x200,
  UInt32 = 0x300,
  SInt32 = 0x700,
  SInt64 = 0x800,
  Float32 = 0x900,
  Bool = 0xb00,
  String = 0xc00,
}

export enum PropertyKeyType {
  Single = 0x00,
  Multi = 0x80,
}
