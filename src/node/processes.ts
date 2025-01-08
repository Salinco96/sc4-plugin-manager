import { exec, execFile } from "node:child_process"

import path from "node:path"
import type { Logger } from "@common/logs"

export async function cmd(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (stderr) {
        console.warn(stderr)
      }

      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
  })
}

export async function runFile(
  exePath: string,
  options: {
    args?: string[]
    logger?: Logger
  } = {},
): Promise<string> {
  const { args = [], logger = console } = options

  return new Promise((resolve, reject) => {
    execFile(exePath, args, { cwd: path.dirname(exePath) }, (error, stdout, stderr) => {
      logger.debug(stdout)
      logger.warn(stderr)

      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
  })
}
