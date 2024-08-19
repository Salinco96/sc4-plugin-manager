export const DIRNAMES = {
  cleanitol: "~cleanitol",
  db: "Database",
  dbAssets: "assets",
  dbMemo: "src/yaml",
  dbPackages: "packages",
  docs: "~docs",
  downloads: "Downloads",
  logs: "Logs",
  packages: "Packages",
  plugins: "Plugins",
  pluginsBackup: "Plugins (Backup)",
  profiles: "Profiles",
  root: "Manager",
  temp: "~temp",
  templates: "Templates",
  tools: "Tools",
}

export const FILENAMES = {
  appConfig: "config",
  logs: "main.log",
  dbOptions: "options",
  packageConfig: "package",
  sc4exe: "Apps/SimCity 4.exe",
  settings: "settings",
}

export const TEMPLATE_PREFIX = "template:"

/** Whitelisted cleanitol file extensions (all lowercase) */
export const CLEANITOL_EXTENSIONS = [".txt"]

/** Whitelisted documentation file extensions (all lowercase) */
export const DOC_EXTENSIONS = [
  ".bmp",
  ".css",
  ".doc",
  ".docx",
  ".gif",
  ".htm",
  ".html",
  ".jpeg",
  ".jpg",
  ".md",
  ".odt",
  ".pdf",
  ".png",
  ".rtf",
  ".svg",
  ".txt",
  ".xcf",
]

/** Whitelisted plugin file extensions (all lowercase) */
export const SC4_EXTENSIONS = [
  ".dat",
  ".dll",
  ".ini",
  // "._loosedesc",
  ".sc4desc",
  ".sc4lot",
  ".sc4model",
]

/** Usual installation paths for the base game (non-exhaustive) */
export const SC4_INSTALL_PATHS = [
  // TODO: Non-Steam version? Is "SimCity 4 Deluxe" name even reliable?
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\SimCity 4 Deluxe",
  "D:\\Program Files (x86)\\Steam\\steamapps\\common\\SimCity 4 Deluxe",
]
