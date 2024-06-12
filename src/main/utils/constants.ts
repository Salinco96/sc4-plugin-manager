export const DIRNAMES = {
  database: "Database",
  docs: "~docs",
  downloads: "Downloads",
  logs: "Logs",
  packages: "Packages",
  plugins: "Plugins",
  profiles: "Profiles",
  root: "Manager",
  temp: "~temp",
  tools: "Tools",
}

export const FILENAMES = {
  logs: "main.log",
  packageConfig: "package",
  sc4exe: "Apps/SimCity 4.exe",
  settings: "settings",
}

/** Whitelisted documentation file extensions */
export const DOCEXTENSIONS = [
  ".bmp",
  ".css",
  ".gif",
  ".htm",
  ".html",
  ".jpeg",
  ".jpg",
  ".md",
  ".png",
  ".svg",
  ".txt",
]

/** Whitelisted plugin file extensions */
export const SC4EXTENSIONS = [
  ".dat",
  ".dll",
  ".ini",
  ".SC4Desc",
  ".SC4Lot",
  ".SC4Model",
  // "._LooseDesc",
]

/** Usual installation paths for the base game (non-exhaustive) */
export const SC4INSTALLPATHS = [
  // TODO: Non-Steam version? Is "SimCity 4 Deluxe" name even reliable?
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\SimCity 4 Deluxe",
  "D:\\Program Files (x86)\\Steam\\steamapps\\common\\SimCity 4 Deluxe",
]
