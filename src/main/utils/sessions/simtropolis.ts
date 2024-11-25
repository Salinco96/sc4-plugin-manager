import { compact } from "@salinco/nice-utils"
import type { Cookie, Session } from "electron/main"

import { getCookieHeader } from "@node/fetch"

import { BaseWindow } from "../../BaseWindow"

export const SIMTROPOLIS_DOMAIN = "community.simtropolis.com"
export const SIMTROPOLIS_ORIGIN = `https://${SIMTROPOLIS_DOMAIN}`

// TODO: Make sure Discord auth works (it probably does not atm?)
const DISCORD_OAUTH2_URL = "https://discordapp.com/api/oauth2/authorize"

const SIMTROPOLIS_LOGIN_URL = `${SIMTROPOLIS_ORIGIN}/sign-in/`
const SIMTROPOLIS_LOST_PASSWORD_URL = `${SIMTROPOLIS_ORIGIN}/lostpassword/`
const SIMTROPOLIS_REGISTER_URL = `${SIMTROPOLIS_ORIGIN}/register/`

const SIMTROPOLIS_AUTH_URLS = [
  DISCORD_OAUTH2_URL,
  SIMTROPOLIS_LOGIN_URL,
  SIMTROPOLIS_LOST_PASSWORD_URL,
  SIMTROPOLIS_REGISTER_URL,
]

export type SimtropolisSession = {
  deviceKey?: string // only present with "Remember Me"
  loginKey?: string // only present with "Remember Me"
  sessionId?: string // missing when entering the app after "Remember Me"
  userId: string
}

const Cookies: {
  [key in keyof SimtropolisSession]: string
} = {
  deviceKey: "ips4_device_key",
  loginKey: "ips4_login_key",
  sessionId: "ips4_IPSSessionFront",
  userId: "ips4_member_id",
}

export async function getSimtropolisSession(
  browserSession: Session,
): Promise<SimtropolisSession | null> {
  const cookies = await browserSession.cookies.get({ domain: SIMTROPOLIS_DOMAIN })

  const deviceKey = cookies.find(cookie => cookie.name === Cookies.deviceKey)?.value
  const loginKey = cookies.find(cookie => cookie.name === Cookies.loginKey)?.value
  const sessionId = cookies.find(cookie => cookie.name === Cookies.sessionId)?.value
  const userId = cookies.find(cookie => cookie.name === Cookies.userId)?.value

  if (userId) {
    const simtropolisSession: SimtropolisSession = { deviceKey, loginKey, sessionId, userId }
    // Make a test request to ensure session is valid
    const headers = getSimtropolisSessionHeaders(simtropolisSession)
    const response = await fetch(SIMTROPOLIS_ORIGIN, { headers })
    const html = await response.text()
    // TODO: Check something more stable
    if (!html.includes("Sign In")) {
      return simtropolisSession
    }
  }

  return null
}

export function getSimtropolisSessionCookies(session: SimtropolisSession): {
  [name in string]?: string
} {
  return compact(
    Object.fromEntries(
      Object.entries(Cookies).map(([key, name]) => [
        name,
        session[key as keyof SimtropolisSession],
      ]),
    ),
  )
}

export function getSimtropolisSessionHeaders(session: SimtropolisSession): {
  Cookie: string
} {
  return {
    Cookie: getCookieHeader(getSimtropolisSessionCookies(session)),
  }
}

export async function simtropolisLogin(
  browserSession: Session,
): Promise<SimtropolisSession | null> {
  return new Promise(resolve => {
    const window = new BaseWindow({
      height: 600,
      webPreferences: { session: browserSession },
      width: 800,
    })

    const onCookieChanged = (_: unknown, cookie: Cookie, reason: string) => {
      // Close the window after login (once the userId cookie is set)
      if (cookie.name === Cookies.userId && reason === "explicit") {
        window.close()
      }
    }

    browserSession.cookies.on("changed", onCookieChanged)

    // When user clicks a link without target "_blank"
    window.webContents.on("will-navigate", (event, url) => {
      const { origin, pathname } = new URL(url)
      // Open non-auth URLS in browser instead (ignore query/hash)
      if (!SIMTROPOLIS_AUTH_URLS.includes(origin + pathname)) {
        event.preventDefault()
        window.openInBrowser(url)
      }
    })

    // When window is closed (by us after reading cookies or by the user)
    window.on("closed", () => {
      browserSession.cookies.off("changed", onCookieChanged)
      getSimtropolisSession(browserSession).then(resolve)
    })

    window.loadURL(SIMTROPOLIS_LOGIN_URL)
  })
}

export async function simtropolisLogout(browserSession: Session): Promise<void> {
  await browserSession.clearStorageData({ origin: SIMTROPOLIS_ORIGIN })
}
