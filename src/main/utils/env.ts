declare global {
  interface ImportMetaEnv {
    readonly MAIN_VITE_DATA_BRANCH?: string
    readonly MAIN_VITE_DATA_REPOSITORY?: string
    readonly MAIN_VITE_GAME_DIR?: string
    readonly MAIN_VITE_ROOT_DIR?: string
    readonly VITE_LOG_LEVEL?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export const env = {
  DATA_BRANCH: import.meta.env.MAIN_VITE_DATA_BRANCH,
  DATA_REPOSITORY: import.meta.env.MAIN_VITE_DATA_REPOSITORY,
  GAME_DIR: import.meta.env.MAIN_VITE_GAME_DIR,
  ROOT_DIR: import.meta.env.MAIN_VITE_ROOT_DIR,
  LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL,
}

export function isDev(): boolean {
  return import.meta.env.DEV
}
