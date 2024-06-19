import { exec } from "child_process"

import { Logger } from "@common/logs"

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

export async function run(
  exe: string,
  options: {
    args?: string[]
    exePath?(exe: string): Promise<string>
    logger?: Logger
  } = {},
): Promise<string> {
  const { args = [], exePath, logger = console } = options

  const parts = [exePath ? await exePath(exe) : exe, ...args]

  return new Promise((resolve, reject) => {
    exec(parts.map(s => `"${s.replaceAll('"', '\\"')}"`).join(" "), (error, stdout, stderr) => {
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
