import { createHmac, timingSafeEqual } from 'crypto'
import { generateCookie, parseCookies } from 'payload/shared'
import type { PayloadRequest } from 'payload'
import { isProduction } from '@/lib/env'
import type { ProviderName } from './providers'

/** What we remember between "start" and "callback". Lives in a short-lived httpOnly cookie. */
export type FlowState = {
  state: string
  codeVerifier: string
  nonce: string
  next: string
}

export const FLOW_TTL_SECONDS = 600 // 10 minutes to finish signing in
const COOKIE_PATH = '/api/customers/oauth'

const cookieName = (req: PayloadRequest, provider: ProviderName) =>
  `${req.payload.config.cookiePrefix}-oauth-${provider}`

// HMAC so the cookie can't be forged or edited (e.g. swapping in a different `next`).
const sign = (req: PayloadRequest, data: string) =>
  createHmac('sha256', req.payload.secret).update(data).digest('base64url')

export const serializeFlowCookie = (req: PayloadRequest, provider: ProviderName, flow: FlowState) => {
  const data = Buffer.from(JSON.stringify(flow)).toString('base64url')
  return generateCookie<false>({
    returnCookieAsObject: false,
    name: cookieName(req, provider),
    value: `${data}.${sign(req, data)}`,
    path: COOKIE_PATH,
    expires: new Date(Date.now() + FLOW_TTL_SECONDS * 1000),
    httpOnly: true,
    secure: isProduction,
    // Lax: the browser sends it on the top-level GET redirect back from Google/Yahoo.
    sameSite: 'Lax',
  })
}

export const clearFlowCookie = (req: PayloadRequest, provider: ProviderName) =>
  generateCookie<false>({
    returnCookieAsObject: false,
    name: cookieName(req, provider),
    value: '',
    path: COOKIE_PATH,
    expires: new Date(0),
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
  })

export const readFlowCookie = (req: PayloadRequest, provider: ProviderName): FlowState | null => {
  const raw = parseCookies(req.headers).get(cookieName(req, provider))
  if (!raw) return null
  const [data, mac] = raw.split('.')
  if (!data || !mac) return null

  const expected = Buffer.from(sign(req, data))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  try {
    const flow = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as FlowState
    if (!flow.state || !flow.codeVerifier || !flow.nonce || typeof flow.next !== 'string') return null
    return flow
  } catch {
    return null
  }
}
