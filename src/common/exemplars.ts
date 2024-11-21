import type { TGI } from "./dbpf"

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
  display?: ExemplarDisplayType
  max?: number
  min?: number
  name: string
  step?: number
  strict?: boolean
  unique?: boolean
  unit?: string
}

export interface ExemplarPropertyData extends ExemplarPropertyItemInfo {
  items?: ExemplarPropertyItemInfo[]
  maxLength?: number
  minLength?: number
  repeat?: boolean
  size?: number
  type?: keyof typeof ExemplarValueType
}

export interface ExemplarPropertyInfo extends ExemplarPropertyItemInfo {
  choices?: ExemplarPropertyChoiceInfo[]
  id?: number
  items?: ExemplarPropertyItemInfo[]
  maxLength?: number
  minLength?: number
  repeat?: boolean
  size?: number
  type?: ExemplarValueType
}

export type ExemplarProperty<T extends ExemplarValueType = ExemplarValueType> = {
  [S in T]: {
    id: number
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

export enum ExemplarPropertyID {
  BudgetItemCost = 0xea54d286,
  BuildingFoundation = 0x88fcd877,
  BuildingValue = 0xe91a0b5f,
  BulldozeCost = 0x099afacd,
  CapacitySatisfied = 0x27812834,
  ExemplarType = 0x00000010,
  ExemplarName = 0x00000020,
  Flamability = 0x29244db5,
  GrowthStage = 0x27812837,
  ItemDescription = 0x8a2602a9,
  ItemIcon = 0x8a2602b8,
  ItemLabel = 0x899afbad,
  ItemOrder = 0x8a2602b9,
  LandmarkEffect = 0x87cd6399,
  LotConfigPropertyFirst = 0x88edc900,
  LotConfigPropertyLast = 0x88edcdff,
  LotResourceKey = 0xea260589,
  LotSize = 0x88edc790,
  MayorRatingEffect = 0xca5b9305,
  OccupantGroups = 0xaa1dd396,
  OccupantSize = 0x27812810,
  PlopCost = 0x49cac341,
  PollutionAtCenter = 0x27812851,
  PollutionRadius = 0x68ee9764,
  PowerConsumed = 0x27812854,
  PowerGenerated = 0x27812852,
  Purpose = 0x27812833,
  PurposeTypes = 0x88edc796,
  ResourceKeyType0 = 0x27812820,
  ResourceKeyType1 = 0x27812821,
  WaterConsumed = 0xc8ed2d84,
  WaterProduced = 0x88ed3303,
  Wealth = 0x27812832,
  WealthTypes = 0x88edc795,
  ZoneTypes = 0x88edc793,
}

export enum ExemplarType {
  Tuning = 0x01,
  Building = 0x02,
  RCI = 0x03,
  Developer = 0x04,
  Simulator = 0x05,
  Road = 0x06,
  Bridge = 0x07,
  Rail = 0x0a,
  Highway = 0x0b,
  PowerLine = 0x0c,
  Terrain = 0x0d,
  Ordinance = 0x0e,
  Flora = 0x0f,
  LotConfig = 0x10,
  Foundation = 0x11,
  Lighting = 0x13,
  LotRetainingWall = 0x15,
  Vehicle = 0x16,
  Pedestrian = 0x17,
  Aircraft = 0x18,
  Prop = 0x1e,
  Construction = 0x1f,
  AutomataTuning = 0x20,
  T21 = 0x21,
  Disaster = 0x22,
  DataView = 0x23,
  Crime = 0x24,
  Audio = 0x25,
  GodMode = 0x27,
  MayorMode = 0x28,
  TrendBar = 0x2a,
  GraphControl = 0x2b,
}

export enum ExemplarDisplayType {
  HEX = "hex",
  RGB = "rgb",
  RGBA = "rgba",
  TGI = "tgi",
}

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
