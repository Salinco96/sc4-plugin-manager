import { resolve } from "path"

import react from "@vitejs/plugin-react"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@common": resolve("src/common"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        "@common": resolve("src/common"),
        "@renderer": resolve("src/renderer/src"),
      },
    },
    plugins: [react()],
  },
})
