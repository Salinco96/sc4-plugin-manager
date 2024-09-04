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

const DEFAULT_DATA_REPOSITORY_NAME = "sc4-plugin-manager-data"
const DEFAULT_DATA_REPOSITORY_URL = `https://github.com/Salinco96/${DEFAULT_DATA_REPOSITORY_NAME}`
const DEFAULT_DATA_REPOSITORY = isDev() ? DEFAULT_DATA_REPOSITORY_NAME : DEFAULT_DATA_REPOSITORY_URL

export const env = {
  DATA_BRANCH: import.meta.env.MAIN_VITE_DATA_BRANCH,
  DATA_REPOSITORY: import.meta.env.MAIN_VITE_DATA_REPOSITORY || DEFAULT_DATA_REPOSITORY,
  GAME_DIR: import.meta.env.MAIN_VITE_GAME_DIR,
  ROOT_DIR: import.meta.env.MAIN_VITE_ROOT_DIR,
  LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL,
}

export function isDev(): boolean {
  return import.meta.env.DEV
}

/** Fail in development (log otherwise) so we can notice issues more easily */
export function failInDev(message: string): undefined {
  if (isDev()) {
    throw Error(message)
  } else {
    console.warn(message)
  }
}
