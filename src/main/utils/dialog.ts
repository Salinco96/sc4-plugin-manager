import { type MessageBoxOptions, type OpenDialogOptions, dialog } from "electron/main"

import { i18n } from "@common/i18n"

import { Application } from "../Application"

/**
 * Shows a system confirmation dialog.
 * @param title dialog title
 * @param message dialog body
 * @param detail extra body (optional)
 * @param doNotAskAgain whether to show a "Do not ask again" checkbox (defaults to false)
 * @param type dialog type (defaults to "question")
 * @returns whether the action was confirmed, and whether "Do not ask again" was checked
 */
export async function showConfirmation(
  title: string,
  message: string,
  detail?: string,
  doNotAskAgain = false,
  type: "error" | "question" | "warning" = "question",
  yesLabel: string = i18n.t("yes"),
  noLabel: string = i18n.t("no"),
): Promise<{ confirmed: boolean; doNotAskAgain: boolean }> {
  const options: MessageBoxOptions = {
    buttons: [yesLabel, noLabel],
    cancelId: 1,
    checkboxChecked: false,
    checkboxLabel: doNotAskAgain ? i18n.t("doNotAskAgain") : undefined,
    defaultId: 0,
    detail,
    message,
    noLink: true,
    title,
    type,
  }

  const result = Application.mainWindow
    ? await dialog.showMessageBox(Application.mainWindow, options)
    : await dialog.showMessageBox(options)

  return { confirmed: result.response === 0, doNotAskAgain: result.checkboxChecked }
}

export enum ConflictConfirmationResponse {
  CANCEL = "cancel",
  CONFIRM = "confirm",
  IGNORE = "ignore",
}

export async function showConflictConfirmation({
  cancelLabel = i18n.t("cancel"),
  confirmLabel = i18n.t("confirm"),
  description,
  ignoreLabel = i18n.t("ignore"),
  message,
  title,
  type = "warning",
}: {
  cancelLabel?: string
  confirmLabel?: string
  description?: string
  ignoreLabel?: string
  message: string
  title: string
  type?: "question" | "warning"
}): Promise<ConflictConfirmationResponse> {
  const buttons = [
    { label: confirmLabel, value: ConflictConfirmationResponse.CONFIRM },
    { label: ignoreLabel, value: ConflictConfirmationResponse.IGNORE },
    { label: cancelLabel, value: ConflictConfirmationResponse.CANCEL },
  ]

  const options: MessageBoxOptions = {
    buttons: buttons.map(button => button.label),
    cancelId: 2,
    defaultId: 0,
    detail: description,
    message,
    noLink: true,
    title,
    type,
  }

  const result = Application.mainWindow
    ? await dialog.showMessageBox(Application.mainWindow, options)
    : await dialog.showMessageBox(options)

  return buttons[result.response].value
}

/**
 * Shows a system error dialog.
 * @param title dialog title
 * @param message dialog body
 * @param detail extra body (optional)
 */
export async function showError(title: string, message: string, detail?: string): Promise<void> {
  const options: MessageBoxOptions = {
    detail,
    message,
    title,
    type: "error",
  }

  if (Application.mainWindow) {
    await dialog.showMessageBox(Application.mainWindow, options)
  } else {
    await dialog.showMessageBox(options)
  }
}

/**
 * Shows a system success dialog.
 * @param title dialog title
 * @param message dialog body
 * @param detail extra body (optional)
 */
export async function showSuccess(title: string, message: string, detail?: string): Promise<void> {
  const options: MessageBoxOptions = {
    detail,
    message,
    title,
    type: "info",
  }

  if (Application.mainWindow) {
    await dialog.showMessageBox(Application.mainWindow, options)
  } else {
    await dialog.showMessageBox(options)
  }
}

/**
 * Shows a system warning dialog.
 * @param title dialog title
 * @param message dialog body
 * @param detail extra body (optional)
 */
export async function showWarning(title: string, message: string, detail?: string): Promise<void> {
  const options: MessageBoxOptions = {
    detail,
    message,
    title,
    type: "warning",
  }

  if (Application.mainWindow) {
    await dialog.showMessageBox(Application.mainWindow, options)
  } else {
    await dialog.showMessageBox(options)
  }
}

/**
 * Shows a system folder selector.
 * @param title dialog title
 * @param defaultPath default absolute path (optional)
 * @returns the absolute path to the selected folder, or undefined if the dialog was closed without selection.
 */
export async function showFolderSelector(
  title: string,
  defaultPath?: string,
): Promise<string | undefined> {
  const options: OpenDialogOptions = {
    defaultPath,
    properties: ["openDirectory"],
    title,
  }

  const result = Application.mainWindow
    ? await dialog.showOpenDialog(Application.mainWindow, options)
    : await dialog.showOpenDialog(options)

  return result.filePaths[0]
}
