/** Server-only environment helpers. Never import this from client components. */

export const isProduction = process.env.NODE_ENV === 'production'

/**
 * Turns an env value into a clean origin like "https://cms.yoursite.com".
 * Tolerates a missing scheme (https://, or http:// for localhost), surrounding quotes/spaces and a
 * trailing slash. Anything that still isn't a valid http(s) URL fails loudly at startup with the
 * variable's name, instead of a vague "Invalid URL" in the admin panel.
 */
export const toOrigin = (name: string, raw: string): string => {
  let value = raw.trim().replace(/^["']|["']$/g, '')
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(value)
    value = `${isLocal ? 'http' : 'https'}://${value}`
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a full URL like https://cms.yoursite.com (got "${raw}")`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${name} must start with https:// or http:// (got "${raw}")`)
  }
  return url.origin
}

const frontendRaw = () => process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL

/** The public website, e.g. https://yoursite.com. `NEXT_PUBLIC_FRONTEND_URL` is the legacy name. */
export const getFrontendUrl = (): string => {
  const url = frontendRaw()
  if (!url) throw new Error('FRONTEND_URL is not set')
  return toOrigin('FRONTEND_URL', url)
}

/** This backend's public URL, e.g. https://cms.yoursite.com (used to build OAuth callback URLs). */
export const getServerUrl = (): string => {
  if (process.env.SERVER_URL) return toOrigin('SERVER_URL', process.env.SERVER_URL)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    const host =
      process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
        ? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
        : process.env.NEXT_PUBLIC_VERCEL_URL
    if (host) return toOrigin('NEXT_PUBLIC_VERCEL_URL', host)
  }
  return 'http://localhost:3000'
}

/** Local development served through an https tunnel such as ngrok (SERVER_URL is https). */
export const isDevHttpsTunnel = (): boolean => !isProduction && getServerUrl().startsWith('https://')

/** Request headers the frontend may send cross-origin, on top of Payload's defaults (incl. Authorization). */
export const extraCorsHeaders = ['ngrok-skip-browser-warning']

/** Browser origins allowed to call this API with credentials (CORS + CSRF). */
export const getAllowedOrigins = (): string[] => {
  const origins = new Set<string>()
  origins.add(getServerUrl())
  const frontend = frontendRaw()
  if (frontend) origins.add(toOrigin('FRONTEND_URL', frontend))
  if (!isProduction) {
    origins.add('http://localhost:3000')
    origins.add('http://localhost:3001')
  }
  return [...origins]
}
