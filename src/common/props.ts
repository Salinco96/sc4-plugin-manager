import type { TGI } from "./dbpf"

export interface FamilyData {
  /** Prop family name */
  name?: string
}

export interface FamilyInfo extends FamilyData {
  /** Path to the prop family file */
  file: string
  /** Prop family ID */
  id: string
}

export interface PropData {
  /** Prop family ID */
  family?: string
  /** URL or relative path within ~docs */
  images?: string[]
  /** Prop model TGI */
  model?: TGI
  /** Internal prop name */
  name?: string
}

export interface PropInfo extends Omit<PropData, "model"> {
  /** Path to the file containing the prop exemplar */
  file: string
  /** Prop Instance ID */
  id: string
}
