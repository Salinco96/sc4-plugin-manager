import { type ID, toHex } from "@salinco/nice-utils"
import { i18n } from "./i18n"

export type MenuID = ID<number, { type: "menu" }> | Menu | Submenu

export enum Menu {
  Flora = 0x4a22ea06,
  Residential = 0x29920899,
  Commercial = 0xa998af42,
  Industrial = 0xc998af00,
  Roads = 0x6999bf56,
  Highway = 0x00000031,
  Rail = 0x00000029,
  MiscTransit = 0x299237bf,
  Airports = 0xe99234b3,
  WaterTransit = 0xa99234a6,
  Power = 0x00000035,
  Water = 0x00000039,
  Garbage = 0x00000040,
  Police = 0x00000037,
  Fire = 0x00000038,
  Education = 0x00000042,
  Health = 0x89dd5405,
  Landmarks = 0x09930709,
  Rewards = 0x00000034,
  Parks = 0x00000003,
}

export enum Submenu {
  Residential_R$ = 0x93dadfe9,
  Residential_R$$ = 0x984e5034,
  Residential_R$$$ = 0x9f83f133,
  Commercial_CS$ = 0x11bf1ca9,
  Commercial_CS$$ = 0x24c43253,
  Commercial_CS$$$ = 0x9bdefe2b,
  Commercial_CO$$ = 0xa7ff7cf0,
  Commercial_CO$$$ = 0xe27b7ef6,
  Industrial_Agriculture = 0xc220b7d8,
  Industrial_Dirty = 0x62d82695,
  Industrial_Manufacture = 0x68b3e5fd,
  Industrial_HighTech = 0x954e20fe,
  Highway_Signage = 0x83e040bb,
  Rail_Passengers = 0x35380c75,
  Rail_Freight = 0x3557f0a1,
  Rail_Yards = 0x39ba25c7,
  Rail_Hybrid = 0x2b294cc2,
  Rail_Monorail = 0x3a1d9854,
  MiscTransit_Bus = 0x1fdde184,
  MiscTransit_Tram = 0x26b51b28,
  MiscTransit_ElRail = 0x244f77e1,
  MiscTransit_Subway = 0x231a97d3,
  MiscTransit_MultiModal = 0x322c7959,
  MiscTransit_Parkings = 0x217b6c35,
  WaterTransit_Seaports = 0x07047b22,
  WaterTransit_Canals = 0x03c6629c,
  WaterTransit_Seawalls = 0x1cd18678,
  WaterTransit_Waterfront = 0x84d42cd6,
  Power_Dirty = 0x4b465151,
  Power_Clean = 0xcde0316b,
  Power_Misc = 0xd013f32d,
  Police_Small = 0x65d88585,
  Police_Large = 0x7d6dc8bc,
  Police_Deluxe = 0x8157ca0e,
  Police_Military = 0x8ba49621,
  Education_Elementary = 0x9fe5c428,
  Education_HighSchool = 0xa08063d0,
  Education_College = 0xac706063,
  Education_Libraries = 0xaedd9faa,
  Health_Small = 0xb1f7ac5b,
  Health_Medium = 0xb7b594d6,
  Health_Large = 0xbc251b69,
  Landmarks_Government = 0x9faf7a3b,
  Landmarks_Religion = 0x26eb3057,
  Landmarks_Entertainment = 0xbe9fda0c,
  Parks_GreenSpaces = 0xbf776d40,
  Parks_Plazas = 0xeb75882c,
  Parks_Sports = 0xce21dbeb,
  Parks_Modular = 0xdeffd960,
  Parks_Embankments = 0xbb531946,
  Parks_Fillers = 0xf034265c,
}

export function getMenuLabel(id: MenuID): string {
  const menu = Menu[id]
  if (menu) {
    return i18n.t(menu as keyof typeof Menu, {
      ns: "Menu",
    })
  }

  const submenu = Submenu[id]
  if (submenu) {
    return i18n.t(submenu.replaceAll("_", "."), {
      defaultValue: submenu.replaceAll("_", " > "),
      ns: "Submenu",
    })
  }

  return `0x${toHex(id, 8)}`
}
