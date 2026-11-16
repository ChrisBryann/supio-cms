import * as oidc from 'openid-client'

export type ProviderName = 'google' | 'yahoo'

export type ProviderConfig = {
  name: ProviderName
  issuer: string
  clientId: string | undefined
  clientSecret: string | undefined
  /** Customers field that stores this provider's account ID (`sub`). */
  subField: 'googleSub' | 'yahooSub'
  /**
   * How the client ID + secret are sent to the token endpoint, per each provider's docs:
   * Google: in the form body (client_secret_post). Yahoo: Authorization: Basic header.
   */
  tokenEndpointAuth: 'post' | 'basic'
  /**
   * Used only when the provider omits `email_verified` (an explicit `false` is always rejected).
   * Google always sends it, so never trust a missing claim there.
   */
  trustEmailWithoutVerifiedClaim: (email: string) => boolean
}

// Yahoo is the authority for its own mailboxes: yahoo.com, yahoo.co.id, ymail.com, rocketmail.com, etc.
const YAHOO_OWNED_DOMAIN = /^(yahoo\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})|ymail\.com|rocketmail\.com)$/

export const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  google: {
    name: 'google',
    issuer: 'https://accounts.google.com',
    get clientId() {
      return process.env.GOOGLE_CLIENT_ID
    },
    get clientSecret() {
      return process.env.GOOGLE_CLIENT_SECRET
    },
    subField: 'googleSub',
    tokenEndpointAuth: 'post',
    trustEmailWithoutVerifiedClaim: () => false,
  },
  yahoo: {
    name: 'yahoo',
    issuer: 'https://api.login.yahoo.com',
    get clientId() {
      return process.env.YAHOO_CLIENT_ID
    },
    get clientSecret() {
      return process.env.YAHOO_CLIENT_SECRET
    },
    subField: 'yahooSub',
    tokenEndpointAuth: 'basic',
    trustEmailWithoutVerifiedClaim: (email) => YAHOO_OWNED_DOMAIN.test(email.split('@')[1] ?? ''),
  },
}

export const SCOPES = 'openid email profile'

export const getProvider = (name: unknown): ProviderConfig | null =>
  name === 'google' || name === 'yahoo' ? PROVIDERS[name] : null

// Cached per provider AND credentials, so editing the client ID/secret takes effect without a restart.
const discovered = new Map<string, Promise<oidc.Configuration>>()

/**
 * OIDC discovery (cached). `enableNonRepudiationChecks` makes openid-client verify
 * the ID token's JWS signature against the provider's JWKS, on top of its standard
 * iss / aud / exp / iat / nonce checks.
 */
export const getOidcConfig = (provider: ProviderConfig): Promise<oidc.Configuration> => {
  const clientId = provider.clientId?.trim()
  const clientSecret = provider.clientSecret?.trim()
  if (!clientId || !clientSecret) {
    return Promise.reject(new Error(`${provider.name} OAuth client is not configured`))
  }
  const key = `${provider.name}\u0000${clientId}\u0000${clientSecret}`
  let config = discovered.get(key)
  if (!config) {
    for (const k of discovered.keys()) if (k.startsWith(`${provider.name}\u0000`)) discovered.delete(k)
    config = oidc
      .discovery(
        new URL(provider.issuer),
        clientId,
        undefined,
        provider.tokenEndpointAuth === 'post'
          ? oidc.ClientSecretPost(clientSecret)
          : oidc.ClientSecretBasic(clientSecret),
      )
      .then((c) => {
        oidc.enableNonRepudiationChecks(c)
        return c
      })
      .catch((err) => {
        discovered.delete(key) // retry discovery next time
        throw err
      })
    discovered.set(key, config)
  }
  return config
}
