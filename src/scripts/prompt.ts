import type { CollectionID } from "@common/collections"
import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { input, select } from "@inquirer/prompts"

export async function promptAuthorName(hint?: string): Promise<string> {
  return await input({
    default: hint,
    message: "Author name:",
  })
}

export async function promptCategoryLabel(): Promise<string> {
  return await input({
    message: "Category label:",
  })
}

export async function promptCollectionId(hint: string): Promise<CollectionID> {
  const collectionId = await input({
    default: hint,
    message: "Collection ID:",
    validate: value => {
      if (!/^[a-z0-9-]+[/][a-z0-9-]+$/.test(value)) {
        return "Invalid collection ID"
      }

      return true
    },
  })

  return collectionId as CollectionID
}

export async function promptPackageId(hint: PackageID): Promise<PackageID> {
  const packageId = await input({
    default: hint,
    message: "Package ID:",
    validate: value => {
      if (!/^[a-z0-9-]+[/][a-z0-9-]+$/.test(value)) {
        return "Invalid package ID"
      }

      return true
    },
  })

  return packageId as PackageID
}

export async function promptUrl(label: string, initial?: string): Promise<string> {
  return await input({
    default: initial,
    message: `${label}:`,
    validate: value => {
      if (!/^https:[/][/][-.\w]+[.][a-z]+[/][-.\w/%{}]+$/.test(value)) {
        return "Invalid URL"
      }

      return true
    },
  })
}

export async function promptVariantId(hint: VariantID, filename?: string): Promise<VariantID> {
  const variantId = await input({
    default: hint,
    message: `Variant ID${filename ? ` (${filename})` : ""}:`,
    validate: value => {
      if (!/^[a-z0-9-]+(,[a-z0-9-]+)*$/.test(value)) {
        return "Invalid variant ID"
      }

      return true
    },
  })

  return variantId as VariantID
}

export async function promptYesNo(message: string, initial?: boolean): Promise<boolean> {
  return await select({
    choices: [
      { name: "Yes", value: true },
      { name: "No", value: false },
    ],
    default: initial ?? false,
    message,
  })
}
