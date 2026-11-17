import * as oidc from 'openid-client'
import type { PayloadHandler, PayloadRequest } from 'payload'
import type { Customer } from '@/payload-types'
import { getFrontendUrl, getServerUrl } from '@/lib/env'
import { clearFlowCookie, readFlowCookie, serializeFlowCookie } from './flow-cookie'
import { getOidcConfig, getProvider, SCOPES, type ProviderConfig } from './providers'
import { safeNext } from './safe-next'
import { createCustomerSessionCookie } from './session'

/** Every `?error=` value the callback can send back to `${FRONTEND_URL}/login`. */
export type LoginError =
  | 'unverified'
  | 'not_a_customer'
  | 'account_mismatch'
  | 'google_failed'
  | 'yahoo_failed'

const callbackUrl = (provider: ProviderConfig) =>
  `${getServerUrl()}/api/customers/oauth/${provider.name}/callback`

const redirect = (location: string, cookies: string[] = []) => {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

/**
 * Safe log details for an OAuth failure. For provider errors (e.g. Google's token endpoint) this includes
 * the OAuth `error` / `error_description` and HTTP status, never tokens, codes or secrets.
 */
const describeOAuthError = (err: unknown) => {
  if (!(err instanceof Error)) return { err: 'unknown' }
  const e = err as Error & { error?: unknown; error_description?: unknown; status?: unknown }
  return {
    err: `${err.name}: ${err.message}`,
    ...(typeof e.error === 'string' ? { oauthError: e.error } : {}),
    ...(typeof e.error_description === 'string' ? { oauthErrorDescription: e.error_description } : {}),
    ...(typeof e.status === 'number' ? { status: e.status } : {}),
  }
}

const loginErrorRedirect = (req: PayloadRequest, provider: ProviderConfig, error: LoginError) =>
  redirect(`${getFrontendUrl()}/login?error=${error}`, [clearFlowCookie(req, provider.name)])

/**
 * GET /api/customers/oauth/:provider?next=/seminars/some-slug
 * Redirects the browser to Google/Yahoo with state + PKCE (+ nonce) stored in a signed, httpOnly cookie.
 */
export const oauthStart: PayloadHandler = async (req) => {
  const provider = getProvider(req.routeParams?.provider)
  if (!provider) return Response.json({ error: 'not_found' }, { status: 404 })

  try {
    const config = await getOidcConfig(provider)
    const codeVerifier = oidc.randomPKCECodeVerifier()
    const state = oidc.randomState()
    const nonce = oidc.randomNonce()
    const next = safeNext(req.searchParams.get('next'))

    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl(provider),
      scope: SCOPES,
      code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
      ...(provider.name === 'google' ? { prompt: 'select_account' } : {}),
    })

    return redirect(url.href, [
      serializeFlowCookie(req, provider.name, { state, codeVerifier, nonce, next }),
    ])
  } catch (err) {
    req.payload.logger.error(describeOAuthError(err), `${provider.name} OAuth start failed`)
    return loginErrorRedirect(req, provider, `${provider.name}_failed`)
  }
}

/** Reads email / email_verified / name / picture from the ID token, falling back to UserInfo. */
const getProfile = async (
  config: oidc.Configuration,
  tokens: Awaited<ReturnType<typeof oidc.authorizationCodeGrant>>,
) => {
  const claims = tokens.claims()
  if (!claims?.sub) throw new Error('ID token missing')

  let profile: Record<string, unknown> = { ...claims }
  if (typeof profile.email !== 'string') {
    const userInfo = await oidc.fetchUserInfo(config, tokens.access_token, claims.sub)
    profile = { ...userInfo, ...claims }
  }

  return {
    sub: claims.sub,
    email: typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : null,
    emailVerified: profile.email_verified as boolean | string | undefined,
    name: typeof profile.name === 'string' ? profile.name : null,
    picture: typeof profile.picture === 'string' ? profile.picture : null,
  }
}

const isEmailVerified = (
  provider: ProviderConfig,
  email: string,
  claim: boolean | string | undefined,
): boolean => {
  if (claim === true || claim === 'true') return true
  if (claim === undefined) return provider.trustEmailWithoutVerifiedClaim(email)
  return false
}

/**
 * GET /api/customers/oauth/:provider/callback
 * Verifies state/PKCE/ID token, applies the allowlist (customers are only created by staff),
 * links googleSub/yahooSub on first sign-in, starts a Payload session and redirects to the frontend.
 * Tokens are never put in a URL and never logged.
 */
export const oauthCallback: PayloadHandler = async (req) => {
  const provider = getProvider(req.routeParams?.provider)
  if (!provider) return Response.json({ error: 'not_found' }, { status: 404 })

  const flow = readFlowCookie(req, provider.name)
  if (!flow) return loginErrorRedirect(req, provider, `${provider.name}_failed`)

  let profile: Awaited<ReturnType<typeof getProfile>>
  try {
    const config = await getOidcConfig(provider)

    // Rebuild the URL the provider redirected to, using our public origin (not an internal proxy host).
    const currentUrl = new URL(callbackUrl(provider))
    req.searchParams.forEach((value, key) => currentUrl.searchParams.append(key, value))

    // Checks: state (CSRF), PKCE verifier, nonce, and the ID token's iss / aud = our client ID /
    // exp / iat and signature (see getOidcConfig). Throws on any mismatch or on ?error=access_denied.
    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      expectedState: flow.state,
      pkceCodeVerifier: flow.codeVerifier,
      expectedNonce: flow.nonce,
      idTokenExpected: true,
    })
    profile = await getProfile(config, tokens)
  } catch (err) {
    req.payload.logger.warn(
      describeOAuthError(err),
      `${provider.name} OAuth callback rejected`,
    )
    return loginErrorRedirect(req, provider, `${provider.name}_failed`)
  }

  if (!profile.email || !isEmailVerified(provider, profile.email, profile.emailVerified)) {
    return loginErrorRedirect(req, provider, 'unverified')
  }

  try {
    const { payload } = req
    const subField = provider.subField

    // 1. Already linked to this Google/Yahoo account?
    let customer: Customer | undefined = (
      await payload.find({
        collection: 'customers',
        where: { [subField]: { equals: profile.sub } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
    ).docs[0]

    if (!customer) {
      // 2. A customer created by staff with this (verified) email?
      const byEmail = (
        await payload.find({
          collection: 'customers',
          where: { email: { equals: profile.email } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        })
      ).docs[0]

      // 3. Allowlist: never create a customer here.
      if (!byEmail) return loginErrorRedirect(req, provider, 'not_a_customer')

      // A different Google/Yahoo account is already linked to this email.
      if (byEmail[subField] && byEmail[subField] !== profile.sub) {
        return loginErrorRedirect(req, provider, 'account_mismatch')
      }

      // First sign-in: link the account.
      customer = await payload.update({
        collection: 'customers',
        id: byEmail.id,
        data: {
          [subField]: profile.sub,
          ...(profile.picture ? { avatarUrl: profile.picture } : {}),
          ...(!byEmail.name && profile.name ? { name: profile.name } : {}),
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
    }

    const sessionCookie = await createCustomerSessionCookie(req, customer)
    return redirect(`${getFrontendUrl()}${flow.next}`, [
      sessionCookie,
      clearFlowCookie(req, provider.name),
    ])
  } catch (err) {
    req.payload.logger.error(
      describeOAuthError(err),
      `${provider.name} OAuth sign-in failed`,
    )
    return loginErrorRedirect(req, provider, `${provider.name}_failed`)
  }
}
