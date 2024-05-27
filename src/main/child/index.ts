import fs from "fs"
import path from "path"

import { clone, currentBranch, fastForward, getConfig } from "isomorphic-git"
import http from "isomorphic-git/http/node"

import { AbstractChildProcess } from "./AbstractChildProcess"

export default class ChildProcess extends AbstractChildProcess<
  unknown,
  { success?: boolean; error?: Error }
> {
  protected onMessage(data: unknown): void {
    console.log(`Message from parent: ${data}`)
  }

  protected async run(): Promise<void> {
    try {
      const dir = process.cwd()

      // TODO: Make these configurable?
      const origin = "https://github.com/memo33/sc4pac" // TODO: https://github.com/Salinco96/sc4-plugin-manager-data.git
      const remote = "origin"
      const branch = "main"

      let exists = false

      if (fs.existsSync(path.join(dir, ".git"))) {
        const oldOrigin = await getConfig({ dir, fs, path: `remote.${remote}.url` })
        const oldBranch = await currentBranch({ dir, fs, test: true })
        if (oldOrigin === origin && oldBranch === branch) {
          exists = true
        } else {
          // If we find anything else than expected origin/branch, nuke the repository
          // NOTE: fs.rmSync(dir, { force: true, recursive: true }) fails with EBUSY
          for (const name of fs.readdirSync(dir)) {
            fs.rmSync(path.join(dir, name), { force: true, recursive: true })
          }
        }
      }

      if (exists) {
        // TODO: Handle local changes (atm this will just fail)
        await fastForward({
          dir,
          fs,
          http,
          ref: branch,
          remote,
          singleBranch: true,
        })
      } else {
        await clone({
          depth: 1,
          dir,
          http,
          fs,
          noTags: true,
          ref: branch,
          remote,
          singleBranch: true,
          url: origin,
        })
      }

      this.send({
        success: true,
      })
    } catch (error) {
      this.send({
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Error",
          name: error instanceof Error ? error.name : "Error",
        },
      })
    }
  }
}

ChildProcess.execute()
