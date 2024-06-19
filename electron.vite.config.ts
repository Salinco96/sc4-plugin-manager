import { resolve } from "path"

import react from "@vitejs/plugin-react"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@common": resolve("src/common"),
        "@node": resolve("src/node"),
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
        "@components": resolve("src/renderer/src/components"),
        "@pages": resolve("src/renderer/src/pages"),
        "@providers": resolve("src/renderer/src/providers"),
        "@utils": resolve("src/renderer/src/utils"),
      },
    },
    plugins: [react()],
  },
})
