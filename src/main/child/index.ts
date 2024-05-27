import fs from "fs"
import path from "path"

import { clone, fastForward } from "isomorphic-git"
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
      const dir = path.join(process.cwd(), "Database")

      if (fs.existsSync(dir)) {
        await fastForward({
          dir,
          http,
          fs,
          singleBranch: true,
        })
      } else {
        await clone({
          depth: 1,
          dir,
          http,
          fs,
          noTags: true,
          singleBranch: true,
          url: "https://github.com/memo33/sc4pac", // TODO: Configurable origin
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
