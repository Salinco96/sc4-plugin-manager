import type { TaskInfo } from "@common/state"

import { createStore } from "./utils"

const initialState: {
  tasks: TaskInfo[]
} = {
  tasks: [],
}

export const status = createStore("tasks", initialState)
