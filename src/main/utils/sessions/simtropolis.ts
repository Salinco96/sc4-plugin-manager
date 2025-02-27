import { collect, compact } from "@salinco/nice-utils"
import { net, type Cookie, type Session } from "electron/main"

import { getCookieHeader } from "@node/fetch"
import { isDev } from "@utils/env"

import { BaseWindow } from "../../BaseWindow"

export const SIMTROPOLIS_DOMAIN = "community.simtropolis.com"
export const SIMTROPOLIS_ORIGIN = `https://${SIMTROPOLIS_DOMAIN}`
export const DISCORD_ORIGIN = "https://discordapp.com"

const SIMTROPOLIS_AUTH_URLS = [
  `${DISCORD_ORIGIN}/api/oauth2/authorize`,
  `${SIMTROPOLIS_ORIGIN}/applications/discord/interface/oauth/auth.php`,
  `${SIMTROPOLIS_ORIGIN}/lostpassword/`,
  `${SIMTROPOLIS_ORIGIN}/register/`,
  `${SIMTROPOLIS_ORIGIN}/secure-login/index.php`,
  `${SIMTROPOLIS_ORIGIN}/sign-in/`,
]

export type SimtropolisSession = {
  deviceKey?: string // only present with "Remember Me"
  displayName?: string
  loginKey?: string // only present with "Remember Me"
  sessionId?: string // missing when entering the app after "Remember Me"
  userId: string
}

const DISPLAY_NAME_REGEX = /id="elUserLink"[^>]*>\s*([^<\s][^<]*?)\s*</i

const Cookies: {
  [key in keyof SimtropolisSession]: string
} = {
  deviceKey: "ips4_device_key",
  loginKey: "ips4_login_key",
  sessionId: "ips4_IPSSessionFront",
  userId: "ips4_member_id",
}

async function readSimtropolisSession(browserSession: Session): Promise<SimtropolisSession | null> {
  const cookies = await browserSession.cookies.get({ domain: SIMTROPOLIS_DOMAIN })

  const deviceKey = cookies.find(cookie => cookie.name === Cookies.deviceKey)?.value
  const loginKey = cookies.find(cookie => cookie.name === Cookies.loginKey)?.value
  const sessionId = cookies.find(cookie => cookie.name === Cookies.sessionId)?.value
  const userId = cookies.find(cookie => cookie.name === Cookies.userId)?.value

  return userId ? { deviceKey, loginKey, sessionId, userId } : null
}

export async function getSimtropolisSession(
  browserSession: Session,
): Promise<SimtropolisSession | null> {
  const persistedSession = await readSimtropolisSession(browserSession)

  if (persistedSession) {
    // Make a test request to ensure session is valid
    const headers = getSimtropolisSessionHeaders(persistedSession)
    const response = await net.fetch(SIMTROPOLIS_ORIGIN, { headers })
    const html = await response.text()

    // Read the session again because some cookies (usually sessionId) may have changed
    const updatedSession = await readSimtropolisSession(browserSession)
    // TODO: Check something more stable
    if (updatedSession && !html.includes("Sign In")) {
      updatedSession.displayName = html.match(DISPLAY_NAME_REGEX)?.[1]
      return updatedSession
    }
  }

  return null
}

export function getSimtropolisSessionCookies(session: SimtropolisSession): {
  [name in string]?: string
} {
  return compact(Object.fromEntries(collect(Cookies, (name, key) => [name, session[key]])))
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
  await simtropolisLogout(browserSession)

  return new Promise(resolve => {
    const window = new BaseWindow({
      height: 600,
      webPreferences: { session: browserSession },
      width: 800,
    })

    window.hide()

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

    if (isDev()) {
      window.webContents.openDevTools()
    }

    window.loadURL(SIMTROPOLIS_ORIGIN)

    window.webContents.on("did-finish-load", () => {
      window.webContents.executeJavaScript(
        `document.getElementsByClassName("authLogin")[0].click();`,
      )
      window.webContents.on("did-finish-load", () => {
        window.show()
      })
    })
  })
}

export async function simtropolisLogout(browserSession: Session): Promise<void> {
  await browserSession.clearData({ origins: [SIMTROPOLIS_ORIGIN] })
}
