import {
  collect,
  difference,
  entries,
  filterValues,
  generate,
  get,
  groupBy,
  indexBy,
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
  values,
} from "@salinco/nice-utils"

import type { AssetID } from "@common/assets"
import type { AuthorID } from "@common/authors"
import type { BuildingID } from "@common/buildings"
import type { Categories } from "@common/categories"
import type { TGI } from "@common/dbpf"
import type { ExemplarDataPatch } from "@common/exemplars"
import type { FamilyID } from "@common/families"
import type { LotID } from "@common/lots"
import type { FloraID } from "@common/mmps"
import type { Requirements } from "@common/options"
import { type PackageID, getOwnerId, isNew } from "@common/packages"
import type { PropID } from "@common/props"
import type { Feature, PackageInfo, PackageWarning } from "@common/types"
import { type MaybeArray, parseStringArray } from "@common/utils/types"
import type {
  DependencyInfo,
  FileInfo,
  VariantAssetInfo,
  VariantID,
  VariantInfo,
} from "@common/variants"
import { toPosix } from "@node/files"

import type { AssetData } from "./assets"
import { loadAuthors } from "./authors"
import { type BuildingData, loadBuildingInfo, writeBuildingInfo } from "./buildings"
import { writeCategories } from "./categories"
import { getPriority, loadCategories } from "./categories"
import { type FamilyData, loadFamilyInfo, writeFamilyInfo } from "./families"
import { type LotData, loadLotInfo, writeLotInfo } from "./lots"
import { type FloraData, loadFloraInfo, writeFloraInfo } from "./mmps"
import { type OptionData, loadOptionInfo, writeOptionInfo } from "./options"
import { type PropData, loadPropInfo, writePropInfo } from "./props"

export interface ContentsData {
  /**
   * Included building family exemplars, grouped by file and instance ID
   */
  buildingFamilies?: {
    [path in string]?: {
      [familyId in FamilyID]?: FamilyData
    }
  }

  /**
   * Included building exemplars, grouped by file and instance ID
   */
  buildings?: {
    [path in string]?: {
      [instanceId in BuildingID]?: BuildingData
    }
  }

  /**
   * Included lot exemplars, grouped by file and instance ID
   */
  lots?: {
    [path in string]?: {
      [instanceId in LotID]?: LotData
    }
  }

  /**
   * Included flora exemplars, grouped by file and instance ID
   */
  mmps?: {
    [path in string]?: {
      [instanceId in FloraID]?: FloraData
    }
  }

  /**
   * Included S3D model IDs, grouped by file
   */
  models?: {
    [path in string]?: string[]
  }

  /**
   * Included prop family exemplars, grouped by file and instance ID
   */
  propFamilies?: {
    [path in string]?: {
      [familyId in FamilyID]?: FamilyData
    }
  }

  /**
   * Included prop exemplars, grouped by file and instance ID
   */
  props?: {
    [path in string]?: {
      [instanceId in PropID]?: PropData
    }
  }

  /**
   * Included FSH texture IDs, grouped by file
   */
  textures?: {
    [path in string]?: string[]
  }
}

export interface DependencyData {
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
  cleanitol?: string[]

  /**
   * List of documentation paths (glob patterns)
   *
   * - By default, all txt/pdf/html/css and image files are included.
   * - If specified, *only* the provided paths are included.
   */
  docs?: Array<FileData | FileDataRecord | string>

  /**
   * List of paths to exclude (glob patterns)
   */
  exclude?: string[]

  /**
   * List of paths to include (glob patterns, including condition replacements)
   *
   * - By default, all dat/dll/sc4desc/sc4lot/sc4model files are included.
   * - If specified, *only* the provided paths are included.
   */
  include?: Array<FileData | FileDataRecord | string>

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
export interface VariantData extends ContentsData {
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
   * List of required dependencies
   *
   * - These packages **must not** contain `features` (use {@link requirements} instead)
   * - Dependency on a specific variant is **not** supported
   * - Partial dependencies are supported
   */
  dependencies?: Array<DependencyData | PackageID>

  /**
   * Whether this package or variant is experimental (e.g. test version)
   */
  deprecated?: boolean | PackageID

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

  const packageAuthors = loadAuthors(packageData.authors ?? [], ownerId)
  const variantAuthors = loadAuthors(variantData.authors ?? [], ownerId)
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
    variantData.dependencies?.map(loadDependencyInfo) ?? [],
    packageData.dependencies?.map(loadDependencyInfo) ?? [],
    dependency => dependency.id,
  )

  const optionalDependencies = union(variantData.optional ?? [], packageData.optional ?? [])

  const images = union(variantData.images ?? [], packageData.images ?? [])

  const buildingFamilies = entries({
    ...packageData.buildingFamilies,
    ...mapValues(variantData.buildingFamilies ?? {}, (families, file) => ({
      ...packageData.buildingFamilies?.[file],
      ...families,
    })),
  }).flatMap(([file, instances]) =>
    collect(instances, (data, id) => loadFamilyInfo(file, id, data)),
  )

  const buildings = entries({
    ...packageData.buildings,
    ...mapValues(variantData.buildings ?? {}, (buildings, file) => ({
      ...packageData.buildings?.[file],
      ...buildings,
    })),
  }).flatMap(([file, instances]) =>
    collect(instances, (data, id) => loadBuildingInfo(file, id, data, categories)),
  )

  const lots = entries({
    ...packageData.lots,
    ...mapValues(variantData.lots ?? {}, (lots, file) => ({
      ...packageData.lots?.[file],
      ...lots,
    })),
  }).flatMap(([file, instances]) => collect(instances, (data, id) => loadLotInfo(file, id, data)))

  const mmps = entries({
    ...packageData.mmps,
    ...mapValues(variantData.mmps ?? {}, (mmps, file) => ({
      ...packageData.mmps?.[file],
      ...mmps,
    })),
  }).flatMap(([file, instances]) => collect(instances, (data, id) => loadFloraInfo(file, id, data)))

  const propFamilies = entries({
    ...packageData.propFamilies,
    ...mapValues(variantData.propFamilies ?? {}, (families, file) => ({
      ...packageData.propFamilies?.[file],
      ...families,
    })),
  }).flatMap(([file, instances]) =>
    collect(instances, (data, id) => loadFamilyInfo(file, id, data)),
  )

  const props = entries({
    ...packageData.props,
    ...mapValues(variantData.props ?? {}, (props, file) => ({
      ...packageData.props?.[file],
      ...props,
    })),
  }).flatMap(([file, instances]) => collect(instances, (data, id) => loadPropInfo(file, id, data)))

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

  const textures = { ...packageData.textures, ...variantData.textures }

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
    assets: assets.length ? assets : undefined,
    authors: mergedAuthors,
    buildingFamilies: buildingFamilies.length ? buildingFamilies : undefined,
    buildings: buildings.length ? buildings : undefined,
    categories: mergedCategories,
    credits: credits.length ? credits : undefined,
    dependencies: dependencies.length ? dependencies : undefined,
    deprecated: variantData.deprecated ?? packageData.deprecated,
    description: variantData.description ?? packageData.description,
    disabled: variantData.disabled ?? packageData.disabled,
    experimental: variantData.experimental ?? packageData.experimental,
    files: variantData.files?.flatMap(loadFileInfo),
    id: variantId,
    images: images.length ? images : undefined,
    lastGenerated: lastGenerated ? new Date(lastGenerated) : undefined,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    logs: variantData.logs ?? packageData.logs,
    lots: lots.length ? lots : undefined,
    mmps: mmps.length ? mmps : undefined,
    name: variantData.name,
    optional: optionalDependencies.length ? optionalDependencies : undefined,
    options: options.length ? options : undefined,
    priority: getPriority(mergedCategories, categories),
    propFamilies: propFamilies.length ? propFamilies : undefined,
    props: props.length ? props : undefined,
    readme: isString(readme) ? [readme] : readme,
    release: release ? new Date(release) : undefined,
    repository: variantData.repository ?? packageData.repository,
    requirements: !isEmpty(requirements) ? requirements : undefined,
    summary: variantData.summary ?? packageData.summary,
    support: variantData.support ?? packageData.support,
    textures: !isEmpty(textures) ? textures : undefined,
    thanks: thanks.length ? thanks : undefined,
    thumbnail: variantData.thumbnail ?? packageData.thumbnail,
    url: variantData.url ?? packageData.url,
    version: variantData.version ?? packageData.version ?? "0.0.0",
    warnings: warnings.length ? warnings : undefined,
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

function loadCredits(
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

function loadDependencyInfo(data: DependencyData | PackageID): DependencyInfo {
  if (isString(data)) {
    return { id: data, transitive: true }
  }

  return {
    ...data,
    include: data.include?.map(toPosix),
    transitive: data.transitive ?? !data.include,
  }
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
    cleanitol: data.cleanitol?.map(toPosix),
    docs: data.docs?.flatMap(loadFileInfo),
    exclude: data.exclude?.map(toPosix),
    id: data.id,
    include: data.include?.flatMap(loadFileInfo),
  }
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

function writeDependencyInfo(info: DependencyInfo): DependencyData | PackageID {
  if (info.include) {
    return { ...info, transitive: info.transitive || undefined }
  }

  if (!info.transitive) {
    return { ...info, transitive: false }
  }

  return info.id
}

function writeFileInfo({ path, ...info }: FileInfo): FileDataRecord | string {
  return isEmpty(info) ? path : { [path]: info }
}

function writeVariantAssetInfo(info: VariantAssetInfo): VariantAssetData | AssetID {
  return {
    ...info,
    docs: info.docs?.map(writeFileInfo),
    include: info.include?.map(writeFileInfo),
  }
}

function writeVariantInfo(info: Partial<VariantInfo>, categories: Categories): VariantData {
  return {
    assets: info.assets?.length ? info.assets?.map(writeVariantAssetInfo) : undefined,
    authors: info.authors?.length ? sort(info.authors) : undefined,
    buildingFamilies: info.buildingFamilies?.length
      ? mapValues(groupBy(info.buildingFamilies, get("file")), instances =>
          mapValues(indexBy(instances, get("id")), writeFamilyInfo),
        )
      : undefined,
    buildings: info.buildings?.length
      ? mapValues(groupBy(info.buildings, get("file")), instances =>
          mapValues(indexBy(instances, get("id")), instance =>
            writeBuildingInfo(instance, categories),
          ),
        )
      : undefined,
    categories: info.categories?.length ? writeCategories(info.categories, categories) : undefined,
    credits: info.credits?.length ? writeCredits(info.credits) : undefined,
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
    lots: info.lots?.length
      ? mapValues(groupBy(info.lots, get("file")), instances =>
          mapValues(indexBy(instances, get("id")), writeLotInfo),
        )
      : undefined,
    mmps: info.mmps?.length
      ? mapValues(groupBy(info.mmps, get("file")), instances =>
          mapValues(indexBy(instances, get("id")), writeFloraInfo),
        )
      : undefined,
    name: info.name,
    optional: info.optional?.length ? info.optional : undefined,
    options: info.options?.length ? info.options.map(writeOptionInfo) : undefined,
    propFamilies: info.propFamilies?.length
      ? mapValues(groupBy(info.propFamilies, get("file")), instances =>
          mapValues(indexBy(instances, get("id")), writeFamilyInfo),
        )
      : undefined,
    props: info.props?.length
      ? mapValues(groupBy(info.props, get("file")), instances =>
          mapValues(indexBy(instances, get("id")), writePropInfo),
        )
      : undefined,
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
    textures: info.textures && !isEmpty(info.textures) ? mapValues(info.textures, sort) : undefined,
    thanks: info.thanks?.length ? writeCredits(info.thanks) : undefined,
    thumbnail: info.thumbnail,
    url: info.url,
    version: info.version,
    warnings: info.warnings?.length ? info.warnings : undefined,
  }
}
