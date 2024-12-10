import type { Logger } from "@common/logs"

export async function get(
  url: string,
  options: {
    cookies?(origin: string): { [name in string]?: string } | undefined
    fetch?(url: string, options?: RequestInit): Promise<Response>
    headers?: { [name: string]: string }
    logger?: Logger
  } = {},
): Promise<Response> {
  const { fetch: _fetch = fetch, logger = console } = options

  const { origin } = new URL(url)

  const headers = new Headers(options.headers)

  const cookies = options.cookies?.(origin)
  if (cookies && Object.keys(cookies).length) {
    headers.set("Cookie", getCookieHeader(cookies))
  }

  const response = await _fetch(url, { credentials: "include", headers })
  const contentType = response.headers.get("Content-Type")

  // TODO: Detect Simtropolis daily limit and request for login

  if (!response.ok) {
    if (contentType === "application/json") {
      logger.warn(JSON.parse(await response.json()))
    }

    throw Error(`Unexpected response code ${response.status}`)
  }

  if (!response.body) {
    throw Error("Empty body")
  }

  return response
}

export function getCookieHeader(
  cookies: {
    [name in string]?: string
  },
): string {
  return Object.entries(cookies)
    .filter(([, value]) => !!value)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
}
