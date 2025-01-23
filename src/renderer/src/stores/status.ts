import type { ApplicationStatus } from "@common/state"
import { createStore } from "./utils"

const initialStatus: ApplicationStatus = {
  downloads: {},
  linker: null,
  loader: null,
}

export const status = createStore("status", initialStatus)
