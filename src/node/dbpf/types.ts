import type { DBPFDataType, DBPFEntry } from "@common/dbpf"
import type { ExemplarData } from "@common/exemplars"

export interface Exemplar extends DBPFEntry<DBPFDataType.EXMP> {
  data: ExemplarData
  file: string
}

export enum BudgetItemDepartment {
  Government = 0xea59717a,
  HealthCoverage = 0xaa538cb3,
  HealthStaff = 0x09188f42,
  Power = 0x8910bc8a,
}

export enum DemandID {
  R$ = 0x1810,
  R$$ = 0x1820,
  R$$$ = 0x1830,
  CO$$ = 0x3b20,
  CO$$$ = 0x3b30,
  IR = 0x4900,
  ID = 0x4a00,
  IM = 0x4b00,
  IHT = 0x4c00,
  Jobs$ = 0x2010,
  Jobs$$ = 0x2020,
  Jobs$$$ = 0x2030,
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
  BudgetItemDepartment = 0xea54d283,
  BudgetItemLine = 0xea54d284,
  BudgetItemPurpose = 0xea54d285,
  BudgetItemCost = 0xea54d286,
  BuildingFoundation = 0x88fcd877,
  BuildingSubmenus = 0xaa1dd399,
  BuildingValue = 0xe91a0b5f,
  BulldozeCost = 0x099afacd,
  CapacitySatisfied = 0x27812834,
  DemandCreated = 0x27812841,
  DemandSatisfied = 0x27812840,
  ExemplarType = 0x00000010,
  ExemplarName = 0x00000020,
  Flamability = 0x29244db5,
  GrowthStage = 0x27812837,
  HospitalPatientCapacity = 0x69220415,
  IsConditional = 0xea3209f8,
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
  PowerPlantType = 0x27812853,
  Purpose = 0x27812833,
  PurposeTypes = 0x88edc796,
  QueryExemplarGUID = 0x24a99f85,
  ResourceKeyType0 = 0x27812820,
  ResourceKeyType1 = 0x27812821,
  WaterConsumed = 0xc8ed2d84,
  WaterProduced = 0x88ed3303,
  Wealth = 0x27812832,
  WealthTypes = 0x88edc795,
  ZoneTypes = 0x88edc793,
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

export enum OccupantGroup {
  Residential = 0x1000,
  Commercial = 0x1001,
  Industrial = 0x1002,
  Transportation = 0x1003,
  Utility = 0x1004,
  Civic = 0x1005,
  Park = 0x1006,
  Fauna = 0x100a,
  Rail = 0x1300,
  Bus = 0x1301,
  Subway = 0x1302,
  LightRail = 0x1303,
  Ferry = 0x1304,
  PassengerRail = 0x1305,
  FreightRail = 0x1306,
  Monorail = 0x1307,
  CarFerry = 0x1308,
  PassengerFerry = 0x1309,
  MiscTransit = 0x130a,
  TollBooth = 0x130b,
  Power = 0x1400,
  Water = 0x1401,
  Garbage = 0x1402,
  Nuclear = 0x1403,
  Recycle = 0x1404,
  ToxicDump = 0x1405,
  Landfill = 0x1406,
  Police = 0x1500,
  Jail = 0x1501,
  Fire = 0x1502,
  School = 0x1503,
  College = 0x1504,
  Library = 0x1505,
  Museum = 0x1506,
  Health = 0x1507,
  Airport = 0x1508,
  Seaport = 0x1509,
  Landmark = 0x150a,
  Reward = 0x150b,
  PoliceLarge = 0x150d,
  PoliceSmall = 0x150e,
  SchoolElementary = 0x150f,
  SchoolHigh = 0x1510,
  Courthouse = 0x1511,
  Clinic = 0x1512,
  Hospital = 0x1513,
  SchoolPrivate = 0x1514,
  PoliceDeluxe = 0x1515,
  PoliceKiosk = 0x1516,
  WaterTransit = 0x1519,
  HealthLarge = 0x151a,
  SchoolOther = 0x151b,
  HealthOther = 0x151c,
  Cemetery = 0x1700,
  Zoo = 0x1702,
  TaxiMaker = 0x1903,
  AmbulanceMaker = 0x1904,
  Bureaucracy = 0x1905,
  Stadium = 0x1906,
  Worship = 0x1907,
  NightClub = 0x1908,
  Opera = 0x1909,
  TvStation = 0x1910,
  StockExchange = 0x1913,
  ConventionCrowd = 0x1921,
  StateFair = 0x1925,
  MayorHouse = 0x1938,
  Casino = 0x1940,
  Marina = 0x1941,
  R$ = 0x11010,
  R$$ = 0x11020,
  R$$$ = 0x11030,
  CS$ = 0x13110,
  CS$$ = 0x13120,
  CS$$$ = 0x13130,
  CO$$ = 0x13320,
  CO$$$ = 0x13330,
  Agriculture = 0x14100,
  IndustrialDirty = 0x14200,
  IndustrialManufacture = 0x14300,
  IndustrialHighTech = 0x14400,
  SgEntertainment = 0xb5c00157,
  SgWaterway = 0xb5c00185,
  BteEntertainment = 0xb5c00a0a,
  BteWaterfront = 0xb5c00dd6,
  BteInlandWaterway = 0xb5c00dd8,
  BteReligious = 0xb5c00ddf,
}

export enum PowerPlantType {
  Coal = 0x01,
  Hydrogen = 0x02,
  NaturalGas = 0x03,
  Nuclear = 0x05,
  Oil = 0x06,
  Solar = 0x07,
  Waste = 0x08,
  Wind = 0x09,
  Auxiliary = 0x0a,
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

export enum QueryExemplarGUID {
  RadioStation = 0x0a8b9c43,
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