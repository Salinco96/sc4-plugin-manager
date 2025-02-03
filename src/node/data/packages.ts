import {
  collect,
  difference,
  filterValues,
  forEach,
  generate,
  get,
  isEmpty,
  isEqual,
  isEqualDeep,
  isString,
  keys,
  mapDefined,
  mapValues,
  sort,
  sortBy,
  toLowerCase,
  union,
  unionBy,
  unique,
  values,
} from "@salinco/nice-utils"

import type { AssetID } from "@common/assets"
import type { AuthorID } from "@common/authors"
import type { BuildingID } from "@common/buildings"
import type { Categories } from "@common/categories"
import type { GroupID, TGI } from "@common/dbpf"
import type { ExemplarDataPatch } from "@common/exemplars"
import type { FamilyID } from "@common/families"
import type { LotID } from "@common/lots"
import type { Requirements } from "@common/options"
import { type PackageID, getOwnerId, isNew } from "@common/packages"
import type { PropID } from "@common/props"
import type { Feature, PackageInfo, PackageWarning } from "@common/types"
import { split } from "@common/utils/string"
import { type MaybeArray, parseStringArray } from "@common/utils/types"
import type {
  DependencyInfo,
  FileInfo,
  TextureID,
  VariantAssetInfo,
  VariantContentsInfo,
  VariantID,
  VariantInfo,
} from "@common/variants"
import { toPosix } from "@node/files"
import type { AssetData } from "./assets"
import { type BuildingData, loadBuildingInfo, writeBuildingInfo } from "./buildings"
import { writeCategories } from "./categories"
import { getPriority, loadCategories } from "./categories"
import { type FamilyData, loadFamilyInfo, writeFamilyInfo } from "./families"
import { type LotData, loadLotInfo, writeLotInfo } from "./lots"
import { type FloraData, loadFloraInfo, writeFloraInfo } from "./mmps"
import { type OptionData, loadOptionInfo, writeOptionInfo } from "./options"
import { loadModelId, writeModelId } from "./plugins"
import { type PropData, loadPropInfo, writePropInfo } from "./props"

export type VariantContentsData = {
  /**
   * Included building family exemplars, grouped by file and instance ID
   */
  buildingFamilies?: {
    [path in string]?: {
      [id in `${GroupID}-${FamilyID}`]?: FamilyData
    }
  }

  /**
   * Included building exemplars, grouped by file and instance ID
   */
  buildings?: {
    [path in string]?: {
      [id in `${GroupID}-${BuildingID}`]?: BuildingData
    }
  }

  /**
   * Included lot exemplars, grouped by file and instance ID
   */
  lots?: {
    [path in string]?: {
      [id in LotID]?: LotData
    }
  }

  /**
   * Included flora exemplars, grouped by file and instance ID
   */
  mmps?: {
    [path in string]?: {
      [id in `${GroupID}-${BuildingID}`]?: FloraData
    }
  }

  /**
   * Included S3D model IDs, grouped by file
   */
  models?: {
    [path in string]?: Array<GroupID | `${GroupID}-${string}`>
  }

  /**
   * Included prop family exemplars, grouped by file and instance ID
   */
  propFamilies?: {
    [path in string]?: {
      [id in `${GroupID}-${FamilyID}`]?: FamilyData
    }
  }

  /**
   * Included prop exemplars, grouped by file and instance ID
   */
  props?: {
    [path in string]?: {
      [id in `${GroupID}-${PropID}`]?: PropData
    }
  }

  /**
   * Included FSH texture IDs, grouped by file
   */
  textures?: {
    [path in string]?: TextureID[]
  }
}

export interface DependencyData {
  /**
   * Condition for the dependency to be included, if any
   */
  condition?: Requirements

  /**
   * Package ID
   */
  id: PackageID

  /**
   * Paths to include (glob patterns)
   *
   * This can be used if only a single file of a big package is needed.
   *
   * By default, the whole package is included.
   */
  include?: string[]

  /**
   * Whether to include this dependency's dependencies, recursively
   *
   * Defaults to `true` unless {@link include} is specified.
   */
  transitive?: boolean
}

/**
 * Alternative {@link DependencyData} format
 *
 * @example
 * dependencies:
 *   - memo/submenus:
 *       condition:
 *         submenus: true
 *       transitive: false
 */
export interface DependencyDataRecord {
  [id: PackageID]: Omit<DependencyData, "id">
}

/**
 * @example
 * include:
 *   - path: US/MGB Texture Pack.dat
 *     condition:
 *       textures: us
 *   - path: MGB Texture Pack.dat
 *     condition:
 *       textures: eu
 */
export interface FileData {
  /**
   * Mapping to a new path upon installation
   *
   * Only on remote packages.
   */
  as?: string

  /**
   * Conditions for this file to be included
   */
  condition?: Requirements

  /**
   *
   * Only on installed packages.
   */
  patches?: {
    [entryId in TGI]?: ExemplarDataPatch
  }

  /**
   * Relative path
   *
   * - For remote packages, this may be a glob pattern, including condition replacements
   * - For installed packages, this must be an exact path (POSIX preferred but not required)
   */
  path: string

  /**
   * If this file should have a higher priority than the rest of the package, overwrite here.
   *
   * - Priority of 900 or higher is treated as "override"
   */
  priority?: number
}

/**
 * Alternative {@link FileData} format
 *
 * @example
 * include:
 *   - US/MGB Texture Pack.dat:
 *       condition:
 *         textures: us
 *   - MGB Texture Pack.dat:
 *       condition:
 *         textures: eu
 */
export interface FileDataRecord {
  [path: string]: Omit<FileData, "path">
}

/**
 * Raw package data, as stored in YAML files
 *
 * Once published, this should be kept backward-compatible.
 */
export interface PackageData extends VariantData {
  /**
   * Included features, as an array of strings or a comma-separated string (will be trimmed and lowercased)
   *
   * - Contrary to other fields, this **cannot** be overridden by variants.
   * - Only one package may include a given feature, so this can be used for exclusivity.
   */
  features?: MaybeArray<string>

  /**
   * Package name
   */
  name?: string

  /**
   * Available variants
   */
  variants?: {
    [variantId in VariantID]?: VariantData
  }
}

export interface VariantAssetData extends AssetData {
  /**
   * List of cleanitol paths (glob patterns)
   *
   * - By default, all txt files with containing "cleanitol" are included.
   * - If specified, *only* the provided paths are included.
   */
  cleanitol?: MaybeArray<string>

  /**
   * List of documentation paths (glob patterns)
   *
   * - By default, all txt/pdf/html/css and image files are included.
   * - If specified, *only* the provided paths are included.
   */
  docs?: Array<FileData | FileDataRecord | string> | string

  /**
   * List of paths to exclude (glob patterns)
   */
  exclude?: MaybeArray<string>

  /**
   * List of paths to include (glob patterns, including condition replacements)
   *
   * - By default, all dat/dll/sc4desc/sc4lot/sc4model files are included.
   * - If specified, *only* the provided paths are included.
   */
  include?: Array<FileData | FileDataRecord | string> | string

  /**
   * Asset ID
   */
  id: AssetID
}

/**
 * Raw variant data, as stored in YAML files
 *
 * Once published, this should be kept backward-compatible.
 */
export interface VariantData extends VariantContentsData {
  /**
   * List of required assets (and additional details about included files)
   *
   * Only on remote packages.
   */
  assets?: Array<VariantAssetData | AssetID>

  /**
   * List of additional authors (array or comma-separated string, case-insensitive)
   *
   * - Owner of package is always implicitly tagged as first author (cannot be overridden)
   * - Package will appear in the package listing of all tagged authors
   * - Order matters (tags will be in the same order)
   * - Note that this is independent from {@link credits} and {@link thanks}
   */
  authors?: MaybeArray<string>

  /**
   * List of categories (array or comma-separated string, case-insensitive)
   *
   * - Some categories may implicitly add others
   * - Order matters (tags will be in the same order)
   */
  categories?: MaybeArray<string>

  /**
   * List of credits, where each line is either:
   * - An {@link AuthorID}
   * - An arbitrary text
   * - An object of format `authorId: "arbitrary text"`
   *
   * This does not affect filters or author listing - use {@link tags} instead/additionally.
   */
  credits?: Array<AuthorID | string | { [authorId in AuthorID]: string }>

  /**
   * Whether this is the variant selected by default (by default it is `default` - otherwise the first compatible one in ID alphabetical order)
   */
  default?: boolean

  /**
   * List of required dependencies
   *
   * - These packages **must not** contain `features` (use {@link requirements} instead)
   * - Dependency on a specific variant is **not** supported
   * - Partial dependencies are supported
   */
  dependencies?: Array<DependencyData | DependencyDataRecord | PackageID>

  /**
   * Whether this package or variant is deprecated or was superseded by a better alternative
   */
  deprecated?: boolean | PackageID | VariantID

  /**
   * Full description in Markdown format
   *
   * The following sections should not be included in the description:
   *   - greetings (the top of the description is most visible part so it should be informative)
   *   - {@link name} (redundant)
   *   - {@link credits}
   *   - {@link dependencies}
   *   - {@link optional} dependencies
   *   - {@link thanks}
   *   - listing or detailed stats of {@link lots}, {@link props}...
   *   - compatibility information redundant with {@link requirements}
   *   - installation/uninstallation instructions redundant with {@link warnings}
   *   - redirections to included {@link readme} file, {@link support} thread, or Git {@link repository}
   */
  description?: string

  /**
   * Whether this package or variant should be hidden in Manager (e.g. work in progress)
   */
  disabled?: boolean

  /**
   * Whether this package or variant is experimental (e.g. test version)
   */
  experimental?: boolean

  /**
   * List of installed files
   *
   * Only on installed/local packages.
   */
  files?: Array<FileData | FileDataRecord | string>

  /**
   * List of image URLs
   */
  images?: string[]

  /**
   * Date or ISO string at which this variant was last generated/updated by the Indexer (used by Indexer only)
   */
  lastGenerated?: Date | string

  /**
   * Date or ISO string at which this variant was last modified/uploaded, as specified on its download page
   */
  lastModified?: Date | string

  /**
   * Name of the .log file generated by this variant's DLL, if any
   */
  logs?: string

  /**
   * Pretty name for this variant
   */
  name?: string

  /**
   * List of optional dependencies
   *
   * - Contrary to {@link dependencies}, these packages may contain `features`
   */
  optional?: PackageID[]

  /**
   * List of options
   */
  options?: OptionData[]

  /**
   * Priority (number between 0 and 999), usually should let to be inferred from {@link categories}
   */
  priority?: number

  /**
   * Relative path to the main Readme file (the one that is shown in Readme tab)
   */
  readme?: MaybeArray<string>

  /**
   * Date or ISO string at which this variant was first added to the Manager database (used to mark "new" packages)
   */
  release?: Date | string

  /**
   * URL to this package's source code repository
   */
  repository?: string

  /**
   * Compatibility requirements for this variant
   *
   * The possible requirements are:
   * - Features (must be present or not, e.g. `cam` or `darknite`)
   * - Minimum game version (e.g. `minVersion: 638`)
   * - Global options
   */
  requirements?: Requirements

  /**
   * Shorter description, containing no line breaks or formatting, displayed instead of {@link description} when space is limited (e.g. package listing)
   */
  summary?: string

  /**
   * URL to a plugin/support thread
   */
  support?: string

  /**
   * List of credits, where each line is either:
   * - An {@link AuthorID}
   * - An arbitrary text
   * - An object of format `authorId: "arbitrary text"`
   */
  thanks?: Array<AuthorID | string | { [authorId in AuthorID]: string }>

  /**
   * URL to a thumbnail
   */
  thumbnail?: string

  /**
   * URL to this package's main download page
   */
  url?: string

  /**
   * Valid semver version (x.x.x)
   */
  version?: string

  /**
   * Warnings
   */
  warnings?: PackageWarning[]
}

/**
 * Loads a package configuration.
 */
export function loadPackageInfo(
  packageId: PackageID,
  packageData: PackageData,
  categories: Categories,
): PackageInfo | undefined {
  const packageInfo: PackageInfo = {
    id: packageId,
    name: packageData.name ?? packageId,
    status: {},
    variants: {},
  }

  if (packageData.features?.length) {
    packageInfo.features = parseStringArray(packageData.features).map(toLowerCase) as Feature[] // todo
  }

  if (packageData.variants) {
    for (const variantId of keys(packageData.variants)) {
      try {
        const variantInfo = loadVariantInfo(packageId, variantId, packageData, categories)
        packageInfo.variants[variantId] = variantInfo
      } catch (error) {
        console.error(`Error loading variant '${packageId}#${variantId}'`, error)
      }
    }
  }

  // Return the package only if some variants have been successfully loaded
  if (!isEmpty(packageInfo.variants)) {
    return packageInfo
  }
}

export function loadVariantInfo(
  packageId: PackageID,
  variantId: VariantID,
  packageData: PackageData,
  categories: Categories,
): VariantInfo {
  const variantData = packageData.variants?.[variantId] ?? {}

  const ownerId = getOwnerId(packageId)

  const packageAuthors = loadVariantAuthors(packageData.authors ?? [], ownerId)
  const variantAuthors = loadVariantAuthors(variantData.authors ?? [], ownerId)
  const mergedAuthors = union(packageAuthors, variantAuthors)

  const packageCategories = loadCategories(packageData.categories ?? [], categories)
  const variantCategories = loadCategories(variantData.categories ?? [], categories)
  const mergedCategories = union(packageCategories, variantCategories)

  const assets = unionBy(
    variantData.assets?.map(loadVariantAssetInfo) ?? [],
    packageData.assets?.map(loadVariantAssetInfo) ?? [],
    asset => asset.id,
  )

  const dependencies = unionBy(
    variantData.dependencies?.flatMap(loadDependencyInfo) ?? [],
    packageData.dependencies?.flatMap(loadDependencyInfo) ?? [],
    dependency => dependency.id,
  )

  const optionalDependencies = union(variantData.optional ?? [], packageData.optional ?? [])

  const images = union(variantData.images ?? [], packageData.images ?? [])

  const contents = loadVariantContentsInfo(
    {
      buildingFamilies: {
        ...packageData.buildingFamilies,
        ...mapValues(variantData.buildingFamilies ?? {}, (families, file) => ({
          ...packageData.buildingFamilies?.[file],
          ...families,
        })),
      },
      buildings: {
        ...packageData.buildings,
        ...mapValues(variantData.buildings ?? {}, (buildings, file) => ({
          ...packageData.buildings?.[file],
          ...buildings,
        })),
      },
      lots: {
        ...packageData.lots,
        ...mapValues(variantData.lots ?? {}, (lots, file) => ({
          ...packageData.lots?.[file],
          ...lots,
        })),
      },
      mmps: {
        ...packageData.mmps,
        ...mapValues(variantData.mmps ?? {}, (mmps, file) => ({
          ...packageData.mmps?.[file],
          ...mmps,
        })),
      },
      models: {
        ...packageData.models,
        ...mapValues(variantData.models ?? {}, (models, file) =>
          union(packageData.models?.[file] ?? [], models),
        ),
      },
      propFamilies: {
        ...packageData.propFamilies,
        ...mapValues(variantData.propFamilies ?? {}, (families, file) => ({
          ...packageData.propFamilies?.[file],
          ...families,
        })),
      },
      props: {
        ...packageData.props,
        ...mapValues(variantData.props ?? {}, (props, file) => ({
          ...packageData.props?.[file],
          ...props,
        })),
      },
      textures: {
        ...packageData.textures,
        ...mapValues(variantData.textures ?? {}, (textures, file) =>
          union(packageData.textures?.[file] ?? [], textures),
        ),
      },
    },
    categories,
  )

  const options = unionBy(
    mapDefined(variantData.options ?? [], loadOptionInfo),
    mapDefined(packageData.options ?? [], loadOptionInfo),
    option => option.id,
  )

  const credits = unionBy(
    loadCredits(variantData.credits ?? []),
    loadCredits(packageData.credits ?? []),
    credit => credit.id ?? credit.text,
  )

  const thanks = unionBy(
    loadCredits(variantData.thanks ?? []),
    loadCredits(packageData.thanks ?? []),
    thank => thank.id ?? thank.text,
  )

  const requirements = { ...packageData.requirements, ...variantData.requirements }

  const warnings = union(variantData.warnings ?? [], packageData.warnings ?? [])

  const lastGenerated = variantData.lastGenerated ?? packageData.lastGenerated
  const lastModified = variantData.lastModified ?? packageData.lastModified
  const readme = variantData.readme ?? packageData.readme
  const release = variantData.release ?? packageData.release

  const variantInfo: VariantInfo = {
    ...contents,
    assets,
    authors: mergedAuthors,
    categories: mergedCategories,
    credits,
    default: variantData.default,
    dependencies,
    deprecated: variantData.deprecated ?? packageData.deprecated,
    description: variantData.description ?? packageData.description,
    disabled: variantData.disabled ?? packageData.disabled,
    experimental: variantData.experimental ?? packageData.experimental,
    files: variantData.files?.flatMap(loadFileInfo),
    id: variantId,
    images,
    lastGenerated: lastGenerated ? new Date(lastGenerated) : undefined,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    logs: variantData.logs ?? packageData.logs,
    name: variantData.name,
    optional: optionalDependencies,
    options,
    priority:
      variantData.priority ?? packageData.priority ?? getPriority(mergedCategories, categories),
    readme: isString(readme) ? [readme] : readme,
    release: release ? new Date(release) : undefined,
    repository: variantData.repository ?? packageData.repository,
    requirements,
    summary: variantData.summary ?? packageData.summary,
    support: variantData.support ?? packageData.support,
    thanks,
    thumbnail: variantData.thumbnail ?? packageData.thumbnail,
    url: variantData.url ?? packageData.url,
    version: variantData.version ?? packageData.version ?? "0.0.0",
    warnings,
  }

  variantInfo.new = isNew(variantInfo)

  return variantInfo
}

export function writePackageInfo(
  packageInfo: PackageInfo,
  local: boolean,
  categories: Categories,
): PackageData {
  const variants = values(packageInfo.variants).filter(variant => !local || !!variant.installed)
  const ownerId = getOwnerId(packageInfo.id)

  const [firstVariant, ...others] = variants as [VariantInfo?, ...VariantInfo[]]

  function equalsDeep<T>(value: T): (other: T) => boolean {
    return (other: T) => isEqualDeep(value, other)
  }

  const base: Partial<VariantInfo> = {
    authors: firstVariant?.authors?.filter(
      authorId => authorId !== ownerId && others.every(other => other.authors?.includes(authorId)),
    ),
    buildingFamilies:
      variants.length < 2
        ? undefined
        : firstVariant?.buildingFamilies?.filter(family =>
            others.every(other => other.buildingFamilies?.some(equalsDeep(family))),
          ),
    buildings:
      variants.length < 2
        ? undefined
        : firstVariant?.buildings?.filter(building =>
            others.every(other => other.buildings?.some(equalsDeep(building))),
          ),
    categories: firstVariant?.categories?.filter(categoryId =>
      others.every(other => other.categories?.includes(categoryId)),
    ),
    credits: firstVariant?.credits?.filter(credit =>
      others.every(other => other.credits?.some(equalsDeep(credit))),
    ),
    dependencies: firstVariant?.dependencies?.filter(dependency =>
      others.every(other => other.dependencies?.some(equalsDeep(dependency))),
    ),
    deprecated: variants?.every(variant => variant.deprecated)
      ? firstVariant?.deprecated
      : undefined,
    description: others?.every(other => other.description === firstVariant?.description)
      ? firstVariant?.description
      : undefined,
    disabled: variants?.every(variant => variant.disabled),
    experimental: variants?.every(variant => variant.experimental),
    images: firstVariant?.images?.filter(image =>
      others.every(other => other.images?.includes(image)),
    ),
    logs: others?.every(other => other.logs === firstVariant?.logs)
      ? firstVariant?.logs
      : undefined,
    lots:
      variants.length < 2
        ? undefined
        : firstVariant?.lots?.filter(lot =>
            others.every(other => other.lots?.some(equalsDeep(lot))),
          ),
    mmps:
      variants.length < 2
        ? undefined
        : firstVariant?.mmps?.filter(mmp =>
            others.every(other => other.mmps?.some(equalsDeep(mmp))),
          ),
    models:
      variants.length < 2
        ? undefined
        : filterValues(firstVariant?.models ?? {}, (models, file) =>
            others.every(other => isEqual(models, other.models?.[file])),
          ),
    optional: firstVariant?.optional?.filter(dependencyId =>
      others.every(other => other.optional?.includes(dependencyId)),
    ),
    options: firstVariant?.options?.filter(option =>
      others.every(other => other.options?.some(equalsDeep(option))),
    ),
    propFamilies:
      variants.length < 2
        ? undefined
        : firstVariant?.propFamilies?.filter(family =>
            others.every(other => other.propFamilies?.some(equalsDeep(family))),
          ),
    props:
      variants.length < 2
        ? undefined
        : firstVariant?.props?.filter(prop =>
            others.every(other => other.props?.some(equalsDeep(prop))),
          ),
    readme: firstVariant?.readme?.filter(readme =>
      others.every(other => other.readme?.includes(readme)),
    ),
    repository: others?.every(other => other.repository === firstVariant?.repository)
      ? firstVariant?.repository
      : undefined,
    requirements: filterValues(firstVariant?.requirements ?? {}, (value, requirement) =>
      others.every(other => other.requirements?.[requirement] === value),
    ),
    summary: others?.every(other => other.summary === firstVariant?.summary)
      ? firstVariant?.summary
      : undefined,
    support: others?.every(other => other.support === firstVariant?.support)
      ? firstVariant?.support
      : undefined,
    textures:
      variants.length < 2
        ? undefined
        : filterValues(firstVariant?.textures ?? {}, (textures, file) =>
            others.every(other => isEqual(textures, other.textures?.[file])),
          ),
    thanks: firstVariant?.thanks?.filter(thank =>
      others.every(other => other.thanks?.some(equalsDeep(thank))),
    ),
    thumbnail: others?.every(other => other.thumbnail === firstVariant?.thumbnail)
      ? firstVariant?.thumbnail
      : undefined,
    url: others?.every(other => other.url === firstVariant?.url) ? firstVariant?.url : undefined,
    warnings: firstVariant?.warnings?.filter(warning =>
      others.every(other => other.warnings?.some(equalsDeep(warning))),
    ),
  }

  const data: PackageData = {
    ...writeVariantInfo(base, categories),
    features: packageInfo.features?.length ? packageInfo.features : undefined,
    name: packageInfo.name,
    variants: generate(variants, variant => {
      return [
        variant.id,
        writeVariantInfo(
          {
            ...variant,
            assets: local ? undefined : variant.assets,
            authors: variant.authors?.filter(
              authorId => authorId !== ownerId && !base.authors?.includes(authorId),
            ),
            buildingFamilies: variant.buildingFamilies?.filter(
              family => !base.buildingFamilies?.some(equalsDeep(family)),
            ),
            buildings: variant.buildings?.filter(
              building => !base.buildings?.some(equalsDeep(building)),
            ),
            categories: difference(variant.categories, base.categories ?? []),
            credits: variant.credits?.filter(credit => !base.credits?.some(equalsDeep(credit))),
            default: variant.default,
            dependencies: variant.dependencies?.filter(
              dependency => !base.dependencies?.some(equalsDeep(dependency)),
            ),
            deprecated: variant.deprecated !== base.deprecated ? variant.deprecated : undefined,
            description: variant.description !== base.description ? variant.description : undefined,
            disabled: variant.disabled !== base.disabled ? variant.disabled : undefined,
            experimental:
              variant.experimental !== base.experimental ? variant.experimental : undefined,
            files: local ? variant.files : undefined,
            images: difference(variant.images ?? [], base.images ?? []),
            lastGenerated: local ? undefined : variant.lastGenerated,
            lastModified: variant.lastModified,
            logs: variant.logs !== base.logs ? variant.logs : undefined,
            lots: variant.lots?.filter(lot => !base.lots?.some(equalsDeep(lot))),
            mmps: variant.mmps?.filter(mmp => !base.mmps?.some(equalsDeep(mmp))),
            models: filterValues(
              variant.models ?? {},
              (models, file) => !isEqual(models, base.models?.[file]),
            ),
            name: variant.name,
            optional: difference(variant.optional ?? [], base.optional ?? []),
            options: variant.options?.filter(option => !base.options?.some(equalsDeep(option))),
            propFamilies: variant.propFamilies?.filter(
              family => !base.propFamilies?.some(equalsDeep(family)),
            ),
            props: variant.props?.filter(prop => !base.props?.some(equalsDeep(prop))),
            readme: difference(variant.readme ?? [], base.readme ?? []),
            repository: variant.repository !== base.repository ? variant.repository : undefined,
            requirements: filterValues(
              variant.requirements ?? {},
              (value, requirement) => base.requirements?.[requirement] !== value,
            ),
            summary: variant.summary !== base.summary ? variant.summary : undefined,
            support: variant.support !== base.support ? variant.support : undefined,
            textures: filterValues(
              variant.textures ?? {},
              (textures, file) => !isEqual(textures, base.textures?.[file]),
            ),
            thanks: variant.thanks?.filter(thank => !base.thanks?.some(equalsDeep(thank))),
            thumbnail: variant.thumbnail !== base.thumbnail ? variant.thumbnail : undefined,
            url: variant.url !== base.url ? variant.url : undefined,
            warnings: variant.warnings?.filter(
              warning => !base.warnings?.some(equalsDeep(warning)),
            ),
          },
          categories,
        ),
      ]
    }),
  }

  return data
}

export function loadCredits(
  credits: Array<AuthorID | string | { [authorId in AuthorID]: string }>,
): { id?: AuthorID; text?: string }[] {
  return credits.flatMap<{ id?: AuthorID; text?: string }>(credit => {
    if (isString(credit)) {
      if (credit.match(/^\S+$/)) {
        return [{ id: credit.toLowerCase() as AuthorID }]
      }

      return [{ text: credit }]
    }

    return collect(credit, (text, id) => ({ id: id.toLowerCase() as AuthorID, text }))
  })
}

function loadDependencyInfo(
  data: DependencyData | DependencyDataRecord | PackageID,
): DependencyInfo[] {
  if (isString(data)) {
    return [
      {
        id: data,
        transitive: true,
      },
    ]
  }

  if ("id" in data) {
    return [
      {
        ...data,
        id: data.id,
        include: data.include?.map(toPosix),
        transitive: data.transitive ?? !data.include,
      },
    ]
  }

  return collect(data, (data, id) => loadDependencyInfo({ ...data, id })).flat()
}

function loadFileInfo(data: FileData | FileDataRecord | string): FileInfo[] {
  if (isString(data)) {
    return [{ path: toPosix(data) }]
  }

  if (isString(data.path)) {
    return [{ ...data, path: toPosix(data.path) }]
  }

  return collect(data as FileDataRecord, (file, path) => ({ ...file, path: toPosix(path) }))
}

function loadVariantAssetInfo(data: VariantAssetData | AssetID): VariantAssetInfo {
  if (isString(data)) {
    return { id: data }
  }

  return {
    cleanitol: isString(data.cleanitol) ? [toPosix(data.cleanitol)] : data.cleanitol?.map(toPosix),
    docs: isString(data.docs) ? loadFileInfo(data.docs) : data.docs?.flatMap(loadFileInfo),
    exclude: isString(data.exclude) ? [toPosix(data.exclude)] : data.exclude?.map(toPosix),
    id: data.id,
    include: isString(data.include)
      ? loadFileInfo(data.include)
      : data.include?.flatMap(loadFileInfo),
  }
}

function loadVariantAuthors(data: MaybeArray<string>, ownerId: AuthorID): AuthorID[] {
  return unique([ownerId, ...parseStringArray(data).map(toLowerCase)] as AuthorID[])
}

function writeCredits(
  credits: { id?: AuthorID; text?: string }[],
): Array<AuthorID | string | { [authorId in AuthorID]: string }> {
  return mapDefined(credits, credit => {
    if (credit.id && credit.text) {
      return { [credit.id]: credit.text }
    }

    return credit.id ?? credit.text
  })
}

function writeDependencyInfo({ id, ...info }: DependencyInfo): DependencyDataRecord | PackageID {
  if (info.condition || info.include || !info.transitive) {
    return {
      [id]: {
        ...info,
        transitive: info.transitive === !info.include ? undefined : info.transitive,
      },
    }
  }

  return id
}

function writeFileInfo({ path, ...info }: FileInfo): FileDataRecord | string {
  return isEmpty(info) ? path : { [path]: info }
}

function writeVariantAssetInfo(info: VariantAssetInfo): VariantAssetData | AssetID {
  return {
    ...info,
    cleanitol: info.cleanitol?.length === 1 ? info.cleanitol[0] : info.cleanitol,
    docs: info.docs?.map(writeFileInfo),
    include:
      info.include?.length === 1 && info.include[0].path === ""
        ? info.include[0].path
        : info.include?.map(writeFileInfo),
  }
}

function writeVariantInfo(info: Partial<VariantInfo>, categories: Categories): VariantData {
  return {
    ...writeVariantContentsInfo(info, categories),
    assets: info.assets?.length ? info.assets?.map(writeVariantAssetInfo) : undefined,
    authors: info.authors?.length ? sort(info.authors).join(",") : undefined,
    categories: info.categories?.length ? writeCategories(info.categories, categories) : undefined,
    credits: info.credits?.length ? writeCredits(info.credits) : undefined,
    default: info.default || undefined,
    dependencies: info.dependencies?.length
      ? sortBy(info.dependencies, get("id")).map(writeDependencyInfo)
      : undefined,
    deprecated: info.deprecated || undefined,
    description: info.description || undefined,
    disabled: info.disabled || undefined,
    experimental: info.experimental || undefined,
    files: info.files?.map(writeFileInfo),
    images: info.images?.length ? info.images : undefined,
    lastGenerated: info.lastGenerated,
    lastModified: info.lastModified,
    logs: info.logs,
    name: info.name,
    optional: info.optional?.length ? info.optional : undefined,
    options: info.options?.length ? info.options.map(writeOptionInfo) : undefined,
    readme: info.readme?.length
      ? info.readme.length === 1
        ? info.readme[0]
        : info.readme
      : undefined,
    release: info.release,
    repository: info.repository,
    requirements: info.requirements && !isEmpty(info.requirements) ? info.requirements : undefined,
    summary: info.summary,
    support: info.support,
    thanks: info.thanks?.length ? writeCredits(info.thanks) : undefined,
    thumbnail: info.thumbnail,
    url: info.url,
    version: info.version,
    warnings: info.warnings?.length ? info.warnings : undefined,
  }
}

export function loadVariantContentsInfo(
  data: VariantContentsData,
  categories: Categories,
): VariantContentsInfo {
  return {
    buildingFamilies:
      data.buildingFamilies &&
      collect(data.buildingFamilies, (families, file) =>
        collect(families, (data, id) => {
          const [groupId, instanceId] = split(id, "-")
          return loadFamilyInfo(file, groupId, instanceId, data)
        }),
      ).flat(),
    buildings:
      data.buildings &&
      collect(data.buildings, (buildings, file) =>
        collect(buildings, (data, id) => {
          const [groupId, instanceId] = split(id, "-")
          return loadBuildingInfo(file, groupId, instanceId, data, categories)
        }),
      ).flat(),
    lots:
      data.lots &&
      collect(data.lots, (lots, file) =>
        collect(lots, (data, id) => {
          return loadLotInfo(file, id, data)
        }),
      ).flat(),
    mmps:
      data.mmps &&
      collect(data.mmps, (mmps, file) =>
        collect(mmps, (data, id) => {
          const [groupId, instanceId] = split(id, "-")
          return loadFloraInfo(file, groupId, instanceId, data)
        }),
      ).flat(),
    models: data.models && mapValues(data.models, models => models.map(loadModelId)),
    propFamilies:
      data.propFamilies &&
      collect(data.propFamilies, (families, file) =>
        collect(families, (data, id) => {
          const [groupId, instanceId] = split(id, "-")
          return loadFamilyInfo(file, groupId, instanceId, data)
        }),
      ).flat(),
    props:
      data.props &&
      collect(data.props, (props, file) =>
        collect(props, (data, id) => {
          const [groupId, instanceId] = split(id, "-")
          return loadPropInfo(file, groupId, instanceId, data)
        }),
      ).flat(),
    textures: data.textures,
  }
}

export function writeVariantContentsInfo(
  contents: VariantContentsInfo,
  categories: Categories,
): VariantContentsData {
  const data: VariantContentsData = {}

  if (contents.buildingFamilies) {
    for (const buildingFamily of contents.buildingFamilies) {
      const { file, group, id } = buildingFamily
      if (file && group) {
        data.buildingFamilies ??= {}
        data.buildingFamilies[file] ??= {}
        data.buildingFamilies[file][`${group}-${id}`] ??= writeFamilyInfo(buildingFamily)
      }
    }
  }

  if (contents.buildings) {
    for (const building of contents.buildings) {
      const { file, group, id } = building

      data.buildings ??= {}
      data.buildings[file] ??= {}
      data.buildings[file][`${group}-${id}`] ??= writeBuildingInfo(building, categories)
    }
  }

  if (contents.lots) {
    for (const lot of contents.lots) {
      const { file, id } = lot

      data.lots ??= {}
      data.lots[file] ??= {}
      data.lots[file][id] ??= writeLotInfo(lot)
    }
  }

  if (contents.mmps) {
    for (const mmp of contents.mmps) {
      const { file, group, id } = mmp

      data.mmps ??= {}
      data.mmps[file] ??= {}
      data.mmps[file][`${group}-${id}`] ??= writeFloraInfo(mmp)
    }
  }

  if (contents.models) {
    forEach(contents.models, (models, file) => {
      data.models ??= {}
      data.models[file] = sort(models.map(writeModelId))
    })
  }

  if (contents.propFamilies) {
    for (const propFamily of contents.propFamilies) {
      const { file, group, id } = propFamily
      if (file && group) {
        data.propFamilies ??= {}
        data.propFamilies[file] ??= {}
        data.propFamilies[file][`${group}-${id}`] ??= writeFamilyInfo(propFamily)
      }
    }
  }

  if (contents.props) {
    for (const prop of contents.props) {
      const { file, group, id } = prop

      data.props ??= {}
      data.props[file] ??= {}
      data.props[file][`${group}-${id}`] ??= writePropInfo(prop)
    }
  }

  if (contents.textures) {
    forEach(contents.textures, (textures, file) => {
      data.textures ??= {}
      data.textures[file] = sort(textures)
    })
  }

  return data
}
