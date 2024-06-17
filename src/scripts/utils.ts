import { HTMLElement, parse as parseHTML } from "node-html-parser"

export async function get(
  url: string,
  options: { cookies?: { [name: string]: string } } = {},
): Promise<Response> {
  const headers = new Headers()

  if (options.cookies) {
    headers.set(
      "Cookie",
      Object.entries(options.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    )
  }

  const response = await fetch(url, { headers })
  if (!response.ok) {
    const message = await response.text().catch(() => "unspecified")
    throw Error(`Failed to load ${url} - error code ${response.status} - ${message.slice(0, 1000)}`)
  }

  return response
}

export async function readHTML(response: Response): Promise<HTMLElement> {
  const body = await response.text()
  return parseHTML(body)
}

export async function getHTML(
  url: string,
  options: { cookies?: { [name: string]: string } } = {},
): Promise<HTMLElement> {
  return readHTML(await get(url, options))
}

export async function wait(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}
