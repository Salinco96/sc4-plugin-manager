import type { DBPFDataType, DBPFEntry } from "@common/dbpf"
import type { ExemplarData } from "@common/exemplars"

export interface Exemplar extends DBPFEntry<DBPFDataType.EXMP> {
  data: ExemplarData
  file: string
}

export enum DeveloperID {
  R$ = 0x1010,
  R$$ = 0x1020,
  R$$$ = 0x1030,
  CS$ = 0x3110,
  CS$$ = 0x3120,
  CS$$$ = 0x3130,
  CO$$ = 0x3320,
  CO$$$ = 0x3330,
  IR = 0x4100,
  ID = 0x4200,
  IM = 0x4300,
  IHT = 0x4400,
}

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

export enum LotConfigPropertyType {
  Building = 0x00,
  Prop = 0x01,
  Texture = 0x02,
  Fence = 0x03,
  Flora = 0x04,
  WaterConstraintTile = 0x05,
  LandConstraintTile = 0x06,
  NetworkNode = 0x07,
}

export enum PurposeType {
  Residential = 0x01,
  CommercialServices = 0x02,
  CommercialOffices = 0x03,
  Agriculture = 0x05,
  IndustrialDirty = 0x06,
  IndustrialManufacture = 0x07,
  IndustrialHighTech = 0x08,
}

export enum SimulatorID {
  AURA = 0xaa023079,
  CRIME = 0xc8e8f6c5,
}

export enum WealthType {
  $ = 0x01,
  $$ = 0x02,
  $$$ = 0x03,
}

export enum ZoneType {
  ResidentialLow = 0x01,
  ResidentialMedium = 0x02,
  ResidentialHigh = 0x03,
  CommercialLow = 0x04,
  CommercialMedium = 0x05,
  CommercialHigh = 0x06,
  IndustrialLow = 0x07,
  IndustrialMedium = 0x08,
  IndustrialHigh = 0x09,
  Landmark = 0x0f,
}
