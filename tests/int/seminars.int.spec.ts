// @vitest-environment node
/**
 * Paid seminar access: integration tests.
 *
 * Runs the real Payload REST routing (handleEndpoints) against a real Postgres database.
 * SAFETY: the suite only runs when TEST_DATABASE_URI is set, and it uses that database
 * (never DATABASE_URI), because Payload pushes its schema into it and the tests create records.
 *
 *   TEST_DATABASE_URI=postgres://postgres@localhost:54329/supio_test pnpm test:int
 *
 * Google/Yahoo are not contacted: openid-client's discovery + token exchange are mocked.
 * The "bad state" test uses openid-client's REAL authorizationCodeGrant state check.
 */
import { generateKeyPairSync } from 'crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, SanitizedConfig } from 'payload'

const TEST_DB = process.env.TEST_DATABASE_URI

// ---- environment for the app under test (set before the config is imported) ----
if (TEST_DB) {
  process.env.DATABASE_URI = TEST_DB
  process.env.PAYLOAD_SECRET ||= 'test-secret-for-integration-tests-only'
  process.env.FRONTEND_URL = 'http://localhost:3001'
  process.env.SERVER_URL = 'http://localhost:3000'
  process.env.GOOGLE_CLIENT_ID = 'google-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'
  process.env.YAHOO_CLIENT_ID = 'yahoo-client-id'
  process.env.YAHOO_CLIENT_SECRET = 'yahoo-client-secret'
  process.env.RESEND_API_KEY ||= 're_test_dummy'
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  process.env.MUX_SIGNING_KEY_ID = 'test-signing-key-id'
  process.env.MUX_SIGNING_KEY_PRIVATE = Buffer.from(
    privateKey.export({ type: 'pkcs1', format: 'pem' }) as string,
  ).toString('base64')
}

// ---- fake Google / Yahoo ----
type FakeClaims = Record<string, unknown> & { sub: string }
const oidcState = vi.hoisted(() => ({ nextClaims: null as null | Record<string, unknown> }))

vi.mock('openid-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openid-client')>()
  const metadataFor = (issuer: string) => ({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks`,
    userinfo_endpoint: `${issuer}/userinfo`,
  })
  return {
    ...actual,
    discovery: vi.fn(async (server: URL, clientId: string, _m: unknown, auth: unknown) =>
      new actual.Configuration(metadataFor(server.href.replace(/\/$/, '')), clientId, undefined, auth as never),
    ),
    enableNonRepudiationChecks: vi.fn(),
    // Default fake: apply the same state check as the real library, then "return" an ID token.
    authorizationCodeGrant: vi.fn(async (_config: unknown, currentUrl: URL, checks: { expectedState?: string }) => {
      if (currentUrl.searchParams.get('state') !== checks.expectedState) throw new Error('state mismatch')
      if (currentUrl.searchParams.get('error')) throw new Error('authorization error')
      const claims = oidcState.nextClaims
      if (!claims) throw new Error('no fake claims configured')
      return { access_token: 'fake-access-token', claims: () => claims }
    }),
    fetchUserInfo: vi.fn(async () => ({})),
  }
})

const decodeJwt = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>

describe.skipIf(!TEST_DB)('paid seminar access', () => {
  let payload: Payload
  let config: SanitizedConfig
  let cookiePrefix: string
  const run = Date.now().toString(36)
  const email = (name: string) => `${name}-${run}@example.com`

  // ---------- helpers ----------
  const api = async (
    path: string,
    opts: { method?: string; token?: string; cookie?: string; body?: unknown; origin?: string } = {},
  ) => {
    const { handleEndpoints } = await import('payload')
    const headers = new Headers()
    if (opts.token) headers.set('Authorization', `JWT ${opts.token}`)
    if (opts.cookie) headers.set('Cookie', opts.cookie)
    if (opts.origin) headers.set('Origin', opts.origin)
    if (opts.body !== undefined) headers.set('Content-Type', 'application/json')
    return handleEndpoints({
      config,
      request: new Request(`http://localhost:3000${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      }),
    })
  }

  const tokenFor = async (collection: 'users' | 'customers', doc: { id: string; email: string }) => {
    const { getFieldsToSign, jwtSign } = await import('payload')
    const collectionConfig = payload.collections[collection].config
    const { token } = await jwtSign({
      fieldsToSign: getFieldsToSign({ collectionConfig, email: doc.email, user: { ...doc, collection } as never }),
      secret: payload.secret,
      tokenExpiration: 3600,
    })
    return token
  }

  const setCookies = (res: Response) => res.headers.getSetCookie()
  const cookieValue = (res: Response, name: string) =>
    setCookies(res).find((c) => c.startsWith(`${name}=`))?.split(';')[0]

  const createCustomer = (name: string) =>
    payload.create({ collection: 'customers', data: { email: email(name) }, overrideAccess: true })

  // ---------- fixtures ----------
  let adminToken: string
  let seminarA: { id: string; slug: string }
  let seminarB: { id: string; slug: string }
  let unpublished: { id: string; slug: string }
  let buyer: { id: string; email: string }
  let buyerToken: string
  let stranger: { id: string; email: string }
  let strangerToken: string
  let buyerPurchaseA: { id: string }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    config = await (await import('@/payload.config')).default
    payload = await getPayload({ config })
    cookiePrefix = payload.config.cookiePrefix

    // Admin-panel user created directly in the DB (skips the "send reset password email" hook).
    const admin = await payload.db.create({
      collection: 'users',
      data: { email: email('admin'), first_name: 'Test', last_name: 'Admin', roles: ['admin', 'viewer'] },
    })
    adminToken = await tokenFor('users', { ...admin, id: String(admin.id), email: admin.email as string })

    const mk = (slug: string, published: boolean) =>
      payload.create({
        collection: 'seminars',
        data: {
          title: `Seminar ${slug}`,
          slug: `${slug}-${run}`,
          published,
          muxPlaybackId: `PLAYBACK_${slug.toUpperCase()}_${run}`,
          purchaseUrl: `https://pay.example.com/${slug}`,
          seminarDate: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    seminarA = await mk('alpha', true)
    seminarB = await mk('beta', true)
    unpublished = await mk('draft', false)

    buyer = await createCustomer('buyer')
    stranger = await createCustomer('stranger')
    buyerToken = await tokenFor('customers', buyer)
    strangerToken = await tokenFor('customers', stranger)

    buyerPurchaseA = await payload.create({
      collection: 'purchases',
      data: { customer: buyer.id, seminar: seminarA.id, status: 'active', paymentReference: 'ORDER-1', notes: 'internal note' },
      overrideAccess: true,
    })
  }, 120_000)

  beforeEach(async () => {
    const { resetRateLimits } = await import('@/lib/rate-limit')
    resetRateLimits()
    oidcState.nextClaims = null
  })

  afterAll(async () => {
    if (!payload) return
    await payload.delete({ collection: 'purchases', where: { customerEmail: { like: run } }, overrideAccess: true })
    await payload.delete({ collection: 'customers', where: { email: { like: run } }, overrideAccess: true })
    await payload.delete({ collection: 'seminars', where: { slug: { like: run } }, overrideAccess: true })
    await payload.db.deleteMany({ collection: 'users', where: { email: { like: run } } })
  })

  // ======================= play endpoint =======================
  describe('GET /api/seminars/:slug/play', () => {
    it('not signed in → 401 unauthenticated', async () => {
      const res = await api(`/api/seminars/${seminarA.slug}/play`)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthenticated' })
    })

    it('signed-in customer who has not bought it → 403 with purchaseUrl', async () => {
      const res = await api(`/api/seminars/${seminarA.slug}/play`, { token: strangerToken })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'not_purchased', purchaseUrl: 'https://pay.example.com/alpha' })
    })

    it('active purchase → 200 with playbackId, three signed tokens and watermark', async () => {
      const res = await api(`/api/seminars/${seminarA.slug}/play`, { token: buyerToken })
      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toBe('no-store')
      const body = await res.json()
      expect(body.playbackId).toBe(`PLAYBACK_ALPHA_${run}`)
      expect(body.expiresIn).toBe(600)

      const now = Math.floor(Date.now() / 1000)
      for (const [key, aud] of [['playback', 'v'], ['thumbnail', 't'], ['storyboard', 's']] as const) {
        const claims = decodeJwt(body.tokens[key])
        expect(claims.sub).toBe(body.playbackId)
        expect(claims.aud).toBe(aud)
        expect(claims.kid).toBe('test-signing-key-id')
        expect(Number(claims.exp) - now).toBeGreaterThan(590)
        expect(Number(claims.exp) - now).toBeLessThanOrEqual(600)
      }

      expect(body.watermark).toMatchObject({
        email: buyer.email,
        code: expect.stringMatching(/^SP-[2-9A-HJKMNP-TV-Z]{8}$/),
        notice: ['DO NOT SHARE', 'DILARANG UNTUK DISTRIBUSI ULANG', 'ASSET OF PT. SUPIO COSMETICS INDONESIA'],
      })
      expect(new Date(body.watermark.issuedAt).getTime()).toBeGreaterThan(Date.now() - 60_000)
    })

    it('revoked purchase → 403', async () => {
      const customer = await createCustomer('revoked')
      await payload.create({
        collection: 'purchases',
        data: { customer: customer.id, seminar: seminarA.id, status: 'revoked' },
        overrideAccess: true,
      })
      const res = await api(`/api/seminars/${seminarA.slug}/play`, { token: await tokenFor('customers', customer) })
      expect(res.status).toBe(403)
      expect((await res.json()).error).toBe('not_purchased')
    })

    it('revoking an active purchase removes access immediately', async () => {
      const customer = await createCustomer('refund')
      const token = await tokenFor('customers', customer)
      const purchase = await payload.create({
        collection: 'purchases',
        data: { customer: customer.id, seminar: seminarA.id, status: 'active' },
        overrideAccess: true,
      })
      expect((await api(`/api/seminars/${seminarA.slug}/play`, { token })).status).toBe(200)
      await payload.update({ collection: 'purchases', id: purchase.id, data: { status: 'revoked' }, overrideAccess: true })
      expect((await api(`/api/seminars/${seminarA.slug}/play`, { token })).status).toBe(403)
    })

    it('buying seminar A does not unlock seminar B', async () => {
      const res = await api(`/api/seminars/${seminarB.slug}/play`, { token: buyerToken })
      expect(res.status).toBe(403)
    })

    it('an admin-panel user is treated as not a customer → 401', async () => {
      const res = await api(`/api/seminars/${seminarA.slug}/play`, { token: adminToken })
      expect(res.status).toBe(401)
    })

    it('unknown or unpublished seminar → 404', async () => {
      expect((await api(`/api/seminars/does-not-exist-${run}/play`, { token: buyerToken })).status).toBe(404)
      await payload.create({
        collection: 'purchases',
        data: { customer: buyer.id, seminar: unpublished.id, status: 'active' },
        overrideAccess: true,
      })
      expect((await api(`/api/seminars/${unpublished.slug}/play`, { token: buyerToken })).status).toBe(404)
    })

    it('rate limits at 30 requests per minute per customer', async () => {
      for (let i = 0; i < 30; i++) {
        expect((await api(`/api/seminars/${seminarA.slug}/play`, { token: buyerToken })).status).toBe(200)
      }
      const res = await api(`/api/seminars/${seminarA.slug}/play`, { token: buyerToken })
      expect(res.status).toBe(429)
      expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
    })
  })

  // ======================= muxPlaybackId never leaks =======================
  describe('muxPlaybackId is never exposed to the public or customers', () => {
    for (const who of ['public', 'customer'] as const) {
      it(`${who}: GET /api/seminars and by slug omit muxPlaybackId and unpublished seminars`, async () => {
        const token = who === 'customer' ? buyerToken : undefined
        const list = await api(`/api/seminars?limit=0&depth=1`, { token })
        expect(list.status).toBe(200)
        const text = await list.clone().text()
        expect(text).not.toContain('muxPlaybackId')
        expect(text).not.toContain('PLAYBACK_')
        const { docs } = await list.json()
        const slugs = docs.map((d: { slug: string }) => d.slug)
        expect(slugs).toContain(seminarA.slug)
        expect(slugs).not.toContain(unpublished.slug)
        expect(docs[0]).not.toHaveProperty('purchases')

        const one = await api(`/api/seminars?where[slug][equals]=${seminarA.slug}&depth=1`, { token })
        const oneText = await one.text()
        expect(oneText).not.toContain('PLAYBACK_')
        expect(JSON.parse(oneText).docs).toHaveLength(1)

        const byId = await api(`/api/seminars/${seminarA.id}`, { token })
        expect(await byId.text()).not.toContain('PLAYBACK_')
      })

      it(`${who}: cannot filter or probe by muxPlaybackId`, async () => {
        const token = who === 'customer' ? buyerToken : undefined
        const res = await api(`/api/seminars?where[muxPlaybackId][equals]=PLAYBACK_ALPHA_${run}`, { token })
        expect(res.status).toBeGreaterThanOrEqual(400)
        expect(await res.text()).not.toContain(seminarA.slug)
      })

      it(`${who}: GraphQL does not return muxPlaybackId`, async () => {
        const { GRAPHQL_POST } = await import('@payloadcms/next/routes')
        const headers = new Headers({ 'Content-Type': 'application/json' })
        if (who === 'customer') headers.set('Authorization', `JWT ${buyerToken}`)
        const res = await GRAPHQL_POST(Promise.resolve(config))(
          new Request('http://localhost:3000/api/graphql', {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: '{ Seminars(limit: 100) { docs { slug muxPlaybackId } } }' }),
          }),
        )
        const body = await res.json()
        const docs = body.data?.Seminars?.docs ?? []
        expect(JSON.stringify(body)).not.toContain('PLAYBACK_')
        for (const d of docs) expect(d.muxPlaybackId ?? null).toBeNull()
      })
    }

    it('staff can still read muxPlaybackId', async () => {
      const res = await api(`/api/seminars/${seminarA.id}`, { token: adminToken })
      expect((await res.json()).muxPlaybackId).toBe(`PLAYBACK_ALPHA_${run}`)
    })
  })

  // ======================= purchases =======================
  describe('purchases', () => {
    it("a customer can't read another customer's purchases", async () => {
      const own = await api('/api/purchases?limit=0', { token: buyerToken })
      const ownDocs = (await own.json()).docs as { customer: string | { id: string } }[]
      expect(ownDocs.length).toBeGreaterThan(0)
      for (const p of ownDocs) expect(typeof p.customer === 'object' ? p.customer.id : p.customer).toBe(buyer.id)

      const theirs = await api('/api/purchases?limit=0', { token: strangerToken })
      expect((await theirs.json()).docs).toHaveLength(0)

      const direct = await api(`/api/purchases/${buyerPurchaseA.id}`, { token: strangerToken })
      expect([403, 404]).toContain(direct.status)

      const anon = await api('/api/purchases')
      expect(anon.status).toBe(403)
    })

    it('a customer never sees internal notes', async () => {
      const res = await api(`/api/purchases/${buyerPurchaseA.id}`, { token: buyerToken })
      expect(res.status).toBe(200)
      expect(await res.json()).not.toHaveProperty('notes')
    })

    it('customers cannot create or change purchases', async () => {
      const create = await api('/api/purchases', {
        method: 'POST',
        token: strangerToken,
        body: { customer: stranger.id, seminar: seminarB.id },
      })
      expect(create.status).toBe(403)
      const update = await api(`/api/purchases/${buyerPurchaseA.id}`, {
        method: 'PATCH',
        token: buyerToken,
        body: { status: 'active', seminar: seminarB.id },
      })
      expect(update.status).toBe(403)
    })

    it('creating a duplicate active purchase fails with a clear message', async () => {
      const res = await api('/api/purchases', {
        method: 'POST',
        token: adminToken,
        body: { customer: buyer.id, seminar: seminarA.id, status: 'active' },
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(JSON.stringify(body)).toContain('already has an active purchase for this seminar')
    })

    it('a new active purchase is allowed once the old one is revoked', async () => {
      const customer = await createCustomer('rebuy')
      const first = await payload.create({
        collection: 'purchases',
        data: { customer: customer.id, seminar: seminarB.id, status: 'active' },
        overrideAccess: true,
      })
      await payload.update({ collection: 'purchases', id: first.id, data: { status: 'revoked' }, overrideAccess: true })
      const second = await payload.create({
        collection: 'purchases',
        data: { customer: customer.id, seminar: seminarB.id, status: 'active' },
        overrideAccess: true,
      })
      expect(second.status).toBe('active')
    })

    it('the database index also blocks a duplicate that skips the hook', async () => {
      await expect(
        payload.db.create({
          collection: 'purchases',
          data: { customer: buyer.id, seminar: seminarA.id, status: 'active' },
        }),
      ).rejects.toThrow()
    })

    it('gets a readable title and customer email', async () => {
      const p = await payload.findByID({ collection: 'purchases', id: buyerPurchaseA.id, overrideAccess: true })
      expect(p.title).toBe(`${buyer.email} — Seminar alpha`)
      expect(p.customerEmail).toBe(buyer.email)
    })
  })

  // ======================= customers =======================
  describe('customers', () => {
    it('GET /api/customers/me/seminars lists only active, published purchases', async () => {
      const res = await api('/api/customers/me/seminars', { token: buyerToken })
      expect(res.status).toBe(200)
      const list = await res.json()
      expect(list.map((s: { slug: string }) => s.slug)).toEqual([seminarA.slug])
      expect(Object.keys(list[0]).sort()).toEqual(['duration', 'id', 'slug', 'speaker', 'thumbnail', 'title'])
      expect(JSON.stringify(list)).not.toContain('PLAYBACK_')
    })

    it('GET /api/customers/me/seminars → 401 when not signed in or signed in as admin', async () => {
      expect((await api('/api/customers/me/seminars')).status).toBe(401)
      expect((await api('/api/customers/me/seminars', { token: adminToken })).status).toBe(401)
    })

    it('GET /api/customers/me returns the customer without the token or account IDs', async () => {
      const body = await (await api('/api/customers/me', { token: buyerToken })).json()
      expect(body.user.email).toBe(buyer.email)
      expect(body.collection).toBe('customers')
      expect(body.message).toBe('Account')
      expect(typeof body.exp).toBe('number')
      expect(body.user.watermarkCode).toMatch(/^SP-/)
      expect(body).not.toHaveProperty('token')
      expect(body.user).not.toHaveProperty('googleSub')
      expect(body.user).not.toHaveProperty('purchases')
      const anon = await api('/api/customers/me')
      expect(anon.status).toBe(200)
      expect((await anon.json()).user).toBeNull()
      // Payload looks the admin's ID up among customers and returns 404: never a customer.
      const asAdmin = await api('/api/customers/me', { token: adminToken })
      expect(asAdmin.status).toBe(404)
      expect(JSON.stringify(await asAdmin.json())).not.toContain('"email"')
    })

    it('a customer can change their own name, but not their email or googleSub', async () => {
      const res = await api(`/api/customers/${buyer.id}`, {
        method: 'PATCH',
        token: buyerToken,
        body: { name: 'New Name', email: `hacker-${run}@example.com`, googleSub: 'forged', watermarkCode: 'SP-FORGED' },
      })
      expect(res.status).toBe(200)
      expect((await res.json()).message).toBe('Updated successfully.')
      const doc = await payload.findByID({ collection: 'customers', id: buyer.id, overrideAccess: true })
      expect(doc.name).toBe('New Name')
      expect(doc.email).toBe(buyer.email)
      expect(doc.googleSub ?? null).toBeNull()
      expect(doc.watermarkCode).not.toBe('SP-FORGED')
    })

    it("a customer can't read or update another customer", async () => {
      const read = await api(`/api/customers/${buyer.id}`, { token: strangerToken })
      expect([403, 404]).toContain(read.status)
      const update = await api(`/api/customers/${buyer.id}`, { method: 'PATCH', token: strangerToken, body: { name: 'x' } })
      expect([403, 404]).toContain(update.status)
      const list = await (await api('/api/customers?limit=0', { token: strangerToken })).json()
      expect(list.docs.map((d: { id: string }) => d.id)).toEqual([stranger.id])
    })

    it('stores email lowercase', async () => {
      const c = await payload.create({
        collection: 'customers',
        data: { email: `  MiXeD-${run}@Example.COM ` },
        overrideAccess: true,
      })
      expect(c.email).toBe(`mixed-${run}@example.com`)
    })

    it('password login, registration and password reset are impossible for customers', async () => {
      const login = await api('/api/customers/login', { method: 'POST', body: { email: buyer.email, password: 'anything' } })
      expect(login.status).toBe(403)
      expect(cookieValue(login, `${cookiePrefix}-token`)).toBeUndefined()
      const forgot = await api('/api/customers/forgot-password', { method: 'POST', body: { email: buyer.email } })
      expect(forgot.status).toBe(403)
      const register = await api('/api/customers', { method: 'POST', body: { email: `self-${run}@example.com`, password: 'x' } })
      expect(register.status).toBe(403)
    })

    it('a customer session cannot access the admin panel; an admin session can', async () => {
      const asCustomer = await (await api('/api/access', { token: buyerToken })).json()
      expect(asCustomer.canAccessAdmin).toBeFalsy()
      const asAdmin = await (await api('/api/access', { token: adminToken })).json()
      expect(asAdmin.canAccessAdmin).toBe(true)
    })

    it('a customer cannot create blogs (existing collection hardening)', async () => {
      const res = await api('/api/blogs', { method: 'POST', token: buyerToken, body: { title: 'x' } })
      expect(res.status).toBe(403)
    })

    it('CORS allows FRONTEND_URL with credentials, not other origins', async () => {
      const ok = await api('/api/customers/me', { token: buyerToken, origin: 'http://localhost:3001' })
      expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:3001')
      expect(ok.headers.get('access-control-allow-credentials')).toBe('true')
      const bad = await api('/api/customers/me', { origin: 'https://evil.example' })
      expect(bad.headers.get('access-control-allow-origin')).toBeNull()
      // Authorization (token forwarding) and the ngrok dev header are allowed cross-origin.
      const allowed = ok.headers.get('access-control-allow-headers') ?? ''
      expect(allowed).toContain('Authorization')
      expect(allowed).toContain('ngrok-skip-browser-warning')
    })

    it('a session cookie sent from a disallowed origin is ignored (CSRF)', async () => {
      const cookie = `${cookiePrefix}-token=${buyerToken}`
      const ok = await (await api('/api/customers/me', { cookie, origin: 'http://localhost:3001' })).json()
      expect(ok.user?.email).toBe(buyer.email)
      const evil = await (await api('/api/customers/me', { cookie, origin: 'https://evil.example' })).json()
      expect(evil.user).toBeNull()
    })
  })

  // ======================= Google / Yahoo sign-in =======================
  describe('OAuth sign-in', () => {
    /** Runs start → (fake provider) → callback. Returns the final callback response. */
    const signIn = async (
      provider: 'google' | 'yahoo',
      claims: FakeClaims | null,
      opts: { next?: string; tamperState?: boolean; dropCookie?: boolean } = {},
    ) => {
      const start = await api(
        `/api/customers/oauth/${provider}${opts.next !== undefined ? `?next=${encodeURIComponent(opts.next)}` : ''}`,
      )
      expect(start.status).toBe(302)
      const authUrl = new URL(start.headers.get('location')!)
      const flowCookie = cookieValue(start, `${cookiePrefix}-oauth-${provider}`)!
      const state = opts.tamperState ? 'attacker-state' : authUrl.searchParams.get('state')!
      oidcState.nextClaims = claims
      const res = await api(
        `/api/customers/oauth/${provider}/callback?code=fake-code&state=${encodeURIComponent(state)}`,
        { cookie: opts.dropCookie ? undefined : flowCookie },
      )
      return { start, authUrl, res }
    }

    const location = (res: Response) => res.headers.get('location')

    it('start: redirects to Google with openid email profile, PKCE S256 and state, in an httpOnly cookie', async () => {
      const { start, authUrl } = await signIn('google', null, { next: '/seminars/abc' })
      expect(authUrl.origin + authUrl.pathname).toBe('https://accounts.google.com/authorize')
      expect(authUrl.searchParams.get('scope')).toBe('openid email profile')
      expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
      expect(authUrl.searchParams.get('code_challenge')).toBeTruthy()
      expect(authUrl.searchParams.get('state')).toBeTruthy()
      expect(authUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/customers/oauth/google/callback')
      const flow = setCookies(start).find((c) => c.startsWith(`${cookiePrefix}-oauth-google=`))!
      expect(flow).toMatch(/HttpOnly/i)
      expect(flow).toMatch(/SameSite=Lax/i)
      expect(flow).toMatch(/Path=\/api\/customers\/oauth/)
    })

    it('a customer created by email is linked on first sign-in, gets a session and sees their seminars', async () => {
      const customer = await createCustomer('google-first')
      await payload.create({ collection: 'purchases', data: { customer: customer.id, seminar: seminarB.id, status: 'active' }, overrideAccess: true })

      const { res } = await signIn(
        'google',
        { sub: `g-${run}-1`, email: customer.email.toUpperCase(), email_verified: true, name: 'Jane', picture: 'https://img/x.png' },
        { next: '/seminars/beta' },
      )
      expect(res.status).toBe(302)
      expect(location(res)).toBe('http://localhost:3001/seminars/beta')
      expect(location(res)).not.toMatch(/token|code=/)

      const linked = await payload.findByID({ collection: 'customers', id: customer.id, overrideAccess: true })
      expect(linked.googleSub).toBe(`g-${run}-1`)
      expect(linked.name).toBe('Jane')
      expect(linked.avatarUrl).toBe('https://img/x.png')

      const session = setCookies(res).find((c) => c.startsWith(`${cookiePrefix}-token=`))!
      expect(session).toMatch(/HttpOnly/i)
      expect(session).toMatch(/SameSite=Lax/i)
      const mine = await api('/api/customers/me/seminars', { cookie: session.split(';')[0] })
      expect((await mine.json()).map((s: { slug: string }) => s.slug)).toEqual([seminarB.slug])

      // second sign-in finds them by googleSub, even if the Google email changed
      const again = await signIn('google', { sub: `g-${run}-1`, email: 'changed@gmail.com', email_verified: true })
      expect(location(again.res)).toBe('http://localhost:3001/my-seminars')
    })

    it('an email that is not a customer is refused (not_a_customer) and creates nothing', async () => {
      const before = await payload.count({ collection: 'customers', overrideAccess: true })
      const { res } = await signIn('google', { sub: `g-${run}-x`, email: email('nobody'), email_verified: true })
      expect(location(res)).toBe('http://localhost:3001/login?error=not_a_customer')
      expect(setCookies(res).some((c) => c.startsWith(`${cookiePrefix}-token=`))).toBe(false)
      const after = await payload.count({ collection: 'customers', overrideAccess: true })
      expect(after.totalDocs).toBe(before.totalDocs)
    })

    it('an unverified Google email is rejected', async () => {
      const customer = await createCustomer('unverified')
      const { res } = await signIn('google', { sub: `g-${run}-u`, email: customer.email, email_verified: false })
      expect(location(res)).toBe('http://localhost:3001/login?error=unverified')
      const missingClaim = await signIn('google', { sub: `g-${run}-u2`, email: customer.email })
      expect(location(missingClaim.res)).toBe('http://localhost:3001/login?error=unverified')
      const doc = await payload.findByID({ collection: 'customers', id: customer.id, overrideAccess: true })
      expect(doc.googleSub ?? null).toBeNull()
    })

    it('a bad state is rejected (real openid-client state check)', async () => {
      const oidc = await import('openid-client')
      const actual = await vi.importActual<typeof import('openid-client')>('openid-client')
      vi.mocked(oidc.authorizationCodeGrant).mockImplementationOnce(actual.authorizationCodeGrant)
      const customer = await createCustomer('badstate')
      const { res } = await signIn('google', { sub: `g-${run}-s`, email: customer.email, email_verified: true }, { tamperState: true })
      expect(location(res)).toBe('http://localhost:3001/login?error=google_failed')
      expect(setCookies(res).some((c) => c.startsWith(`${cookiePrefix}-token=`))).toBe(false)
    })

    it('a missing or forged flow cookie is rejected', async () => {
      const customer = await createCustomer('nocookie')
      const { res } = await signIn('google', { sub: `g-${run}-c`, email: customer.email, email_verified: true }, { dropCookie: true })
      expect(location(res)).toBe('http://localhost:3001/login?error=google_failed')

      const forged = await api('/api/customers/oauth/google/callback?code=x&state=s', {
        cookie: `${cookiePrefix}-oauth-google=${Buffer.from(JSON.stringify({ state: 's', codeVerifier: 'v', nonce: 'n', next: '/' })).toString('base64url')}.badsignature`,
      })
      expect(location(forged)).toBe('http://localhost:3001/login?error=google_failed')
    })

    it('external next URLs are replaced with /my-seminars', async () => {
      const customer = await createCustomer('nextcheck')
      for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '']) {
        const { res } = await signIn('google', { sub: `g-${run}-n`, email: customer.email, email_verified: true }, { next })
        expect(location(res)).toBe('http://localhost:3001/my-seminars')
      }
    })

    it('a different Google account for an already-linked email is refused (account_mismatch)', async () => {
      const customer = await createCustomer('mismatch')
      await signIn('google', { sub: `g-${run}-owner`, email: customer.email, email_verified: true })
      const { res } = await signIn('google', { sub: `g-${run}-other`, email: customer.email, email_verified: true })
      expect(location(res)).toBe('http://localhost:3001/login?error=account_mismatch')
      const doc = await payload.findByID({ collection: 'customers', id: customer.id, overrideAccess: true })
      expect(doc.googleSub).toBe(`g-${run}-owner`)
    })

    it('Yahoo: links yahooSub; trusts a Yahoo-owned address when email_verified is missing', async () => {
      const yahooEmail = `yahoo-${run}@yahoo.co.id`
      const customer = await payload.create({ collection: 'customers', data: { email: yahooEmail }, overrideAccess: true })
      const { authUrl, res } = await signIn('yahoo', { sub: `y-${run}-1`, email: yahooEmail })
      expect(authUrl.origin).toBe('https://api.login.yahoo.com')
      expect(location(res)).toBe('http://localhost:3001/my-seminars')
      const doc = await payload.findByID({ collection: 'customers', id: customer.id, overrideAccess: true })
      expect(doc.yahooSub).toBe(`y-${run}-1`)
      expect(doc.googleSub ?? null).toBeNull()
    })

    it('Yahoo: a non-Yahoo address without email_verified is rejected as unverified', async () => {
      const customer = await createCustomer('yahoo-gmail')
      const { res } = await signIn('yahoo', { sub: `y-${run}-2`, email: customer.email })
      expect(location(res)).toBe('http://localhost:3001/login?error=unverified')
    })

    it('unknown provider → 404', async () => {
      expect((await api('/api/customers/oauth/facebook')).status).toBe(404)
    })

    it('logout clears the session cookie', async () => {
      const res = await api('/api/customers/logout', { method: 'POST', token: buyerToken })
      expect(res.status).toBe(200)
      expect(await res.clone().json()).toEqual({ message: 'Logout successful.' })
      const anon = await api('/api/customers/logout', { method: 'POST' })
      expect(anon.status).toBe(400)
      const asAdmin = await api('/api/customers/logout', { method: 'POST', token: adminToken })
      expect(asAdmin.status).toBe(403)
      const cleared = setCookies(res).find((c) => c.startsWith(`${cookiePrefix}-token=`))!
      expect(cleared).toMatch(/Expires=/)
      expect(new Date(/Expires=([^;]+)/.exec(cleared)![1]).getTime()).toBeLessThan(Date.now())
    })
  })
})
