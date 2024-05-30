import { resolve } from "path"

import react from "@vitejs/plugin-react"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@common": resolve("src/common"),
        "@utils": resolve("src/main/utils"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html"),
          splash: resolve(__dirname, "src/renderer/splash.html"),
        },
      },
    },
    resolve: {
      alias: {
        "@common": resolve("src/common"),
        "@renderer": resolve("src/renderer/src"),
      },
    },
    plugins: [react()],
  },
})
