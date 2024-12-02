import type { TGI } from "./dbpf"

export interface PropFamilyData {
  /** Path to the prop family file */
  file: string
  /** Prop family ID */
  id: string
  /** Prop family name */
  name?: string
}

export interface PropData {
  /** Prop family ID */
  family?: string
  /** Path to the file containing the prop exemplar */
  file: string
  /** Prop Instance ID */
  id: string
  /** URL or relative path within ~docs */
  images?: string[]
  /** Prop model TGI */
  model?: TGI
  /** Internal prop name */
  name?: string
}

export interface PropInfo extends Omit<PropData, "model"> {}
