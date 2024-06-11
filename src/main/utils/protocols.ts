import { net, protocol } from "electron/main"
import path from "path"
import { pathToFileURL } from "url"

import { isChild } from "./files"

export enum Protocol {
  /* Custom protocol to load package docs in sandboxed iframe */
  DOCS = "docs",
}

export function registerDocsProtocol(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: Protocol.DOCS,
      privileges: {
        bypassCSP: true,
      },
    },
  ])
}

export function handleDocsProtocol(rootPath: string, extensions: string[]): void {
  protocol.handle(Protocol.DOCS, req => {
    const relativePath = decodeURI(new URL(req.url).pathname)
    const fullPath = path.resolve(rootPath, relativePath)

    if (!isChild(fullPath, rootPath)) {
      return new Response("bad", { status: 400 })
    }

    if (!extensions.includes(path.extname(fullPath).toLowerCase())) {
      return new Response("bad", { status: 400 })
    }

    return net.fetch(pathToFileURL(fullPath).toString())
  })
}
