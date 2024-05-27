/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MAIN_VITE_GAME_DIR?: string
  readonly MAIN_VITE_ROOT_DIR?: string
  readonly VITE_LOG_LEVEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
