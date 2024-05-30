import { Cookie, Session } from "electron/main"

import { BaseWindow } from "../../BaseWindow"

export const SIMTROPOLIS_DOMAIN = "community.simtropolis.com"
export const SIMTROPOLIS_ORIGIN = `https://${SIMTROPOLIS_DOMAIN}`

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
): Promise<SimtropolisSession | undefined> {
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
}

export function getSimtropolisSessionHeaders(session: SimtropolisSession): HeadersInit {
  return {
    Cookie: Object.entries(Cookies)
      .map(([key, name]) => [name, session[key as keyof SimtropolisSession]])
      .filter(([, value]) => !!value)
      .map(([name, value]) => `${name}=${value}`)
      .join(";"),
  }
}

export async function simtropolisLogin(
  browserSession: Session,
): Promise<SimtropolisSession | undefined> {
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

    window.webContents.on("will-navigate", (event, url) => {
      const { origin, pathname } = new URL(url)
      // Open non-auth URLS in browser instead (ignore query/hash)
      if (!SIMTROPOLIS_AUTH_URLS.includes(origin + pathname)) {
        event.preventDefault()
        window.openInBrowser(url)
      }
    })

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
