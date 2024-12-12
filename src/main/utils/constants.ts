export const DIRNAMES = {
  cleanitol: "~cleanitol",
  db: "Database",
  dbAssets: "assets",
  dbMemo: "src/yaml",
  dbPackages: "packages",
  dbTemplates: "Templates",
  docs: "~docs",
  downloads: "Downloads",
  logs: "Logs",
  packages: "Packages",
  patches: "~patches",
  plugins: "Plugins",
  pluginsBackup: "Plugins (Backup)",
  profiles: "Profiles",
  root: "Manager",
  temp: "~temp",
  tools: "Tools",
}

export const FILENAMES = {
  dbAuthors: "authors",
  dbCategories: "configs/categories",
  dbExemplarProperties: "configs/exemplar-properties",
  dbMaxisExemplars: "configs/maxis",
  dbProfileOptions: "configs/profile-options",
  appConfig: "config",
  logs: "main.log",
  packageConfig: "package",
  sc4exe: "Apps/SimCity 4.exe",
  settings: "settings",
}

export const TEMPLATE_PREFIX = "template:"

/** Usual installation paths for the base game (non-exhaustive) */
export const SC4_INSTALL_PATHS = [
  // TODO: Non-Steam version? Is "SimCity 4 Deluxe" name even reliable?
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\SimCity 4 Deluxe",
  "D:\\Program Files (x86)\\Steam\\steamapps\\common\\SimCity 4 Deluxe",
]
