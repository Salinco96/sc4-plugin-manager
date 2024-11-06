import path from "path"

import { i18n } from "@common/i18n"
import { FileOpenMode, copyTo, exists, openFile } from "@node/files"
import { PEFlag, getPEFlag, getPEHeader, setPEFlag, setPEHeader } from "@node/pe"
import { cmd } from "@node/processes"

import { FILENAMES, SC4_INSTALL_PATHS } from "./constants"
import { showConfirmation, showError, showFolderSelector, showSuccess } from "./dialog"

export async function checkInstallPath(
  installPath: string | undefined,
): Promise<string | undefined> {
  if (installPath) {
    if (await exists(getExePath(installPath))) {
      return installPath
    }
  }

  for (const suggestedPath of SC4_INSTALL_PATHS) {
    if (await exists(getExePath(suggestedPath))) {
      console.info(`Detected installation path ${suggestedPath}`)
      return suggestedPath
    }
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    installPath = await showFolderSelector(
      i18n.t("SelectGameInstallFolderModal:title"),
      installPath,
    )

    if (!installPath) {
      return
    }

    if (await exists(getExePath(installPath))) {
      return installPath
    }
  }
}

export async function check4GBPatch(
  installPath: string,
  options: {
    doNotAskAgain?: boolean
    isStartupCheck?: boolean
  } = {},
): Promise<{ applied: boolean; doNotAskAgain: boolean }> {
  console.info("Checking 4GB Patch...")

  const exePath = getExePath(installPath)

  return openFile(exePath, FileOpenMode.READWRITE, async file => {
    const header = await getPEHeader(file)
    const patched = getPEFlag(header, PEFlag.LARGE_ADDRESS_AWARE)

    if (patched) {
      console.info("4GB Patch is already applied")
      return { applied: true, doNotAskAgain: false }
    }

    if (options.doNotAskAgain) {
      return { applied: false, doNotAskAgain: true }
    }

    const { confirmed, doNotAskAgain } = await showConfirmation(
      i18n.t("Check4GBPatchModal:title"),
      i18n.t("Check4GBPatchModal:confirmation"),
      i18n.t("Check4GBPatchModal:description"),
      options.isStartupCheck,
    )

    if (confirmed) {
      try {
        // Create a backup
        await copyTo(exePath, exePath.replace(/\.exe$/, " (Backup).exe"))

        // Rewrite PE header
        setPEFlag(header, PEFlag.LARGE_ADDRESS_AWARE, true)
        await setPEHeader(file, header)
        await showSuccess(i18n.t("Check4GBPatchModal:title"), i18n.t("Check4GBPatchModal:success"))

        return { applied: true, doNotAskAgain }
      } catch (error) {
        console.error("Failed to apply the 4GB Patch", error)
        await showError(
          i18n.t("Check4GBPatchModal:title"),
          i18n.t("Check4GBPatchModal:failure"),
          (error as Error).message,
        )
      }
    }

    return { applied: false, doNotAskAgain }
  })
}

export function getExePath(installPath: string): string {
  return path.join(installPath, FILENAMES.sc4exe)
}

export async function getExeVersion(installPath: string): Promise<string> {
  const exePath = getExePath(installPath)

  const stdout = await cmd(
    `wmic datafile where "name='${exePath.replace(/[\\'"]/g, "\\$&")}'" get version`,
  )

  const match = stdout.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/)

  if (match) {
    return match[0]
  }

  throw Error(stdout)
}
