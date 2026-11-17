import type { PayloadHandler } from 'payload'
import { isCustomer } from '@/access/roles'
import { hasActivePurchase } from '@/access/hasActivePurchase'
import { getPlaybackCredentials, PLAYBACK_TOKEN_TTL_SECONDS } from '@/lib/video'
import { rateLimit } from '@/lib/rate-limit'
import { WATERMARK_NOTICE } from '@/constants/watermark'
import type { Customer } from '@/payload-types'
import { getRequestIp } from './request-ip'

const NO_STORE = { 'Cache-Control': 'no-store' }

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...NO_STORE, ...headers } })

/**
 * GET /api/seminars/:slug/play
 * 401 not a signed-in customer (admin-panel users count as "not a customer")
 * 404 unknown or unpublished seminar
 * 403 no active purchase (includes revoked)
 * 429 too many requests
 * 200 { playbackId, tokens, expiresIn, watermark }
 */
export const playSeminar: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user || !isCustomer(user)) {
    return json({ error: 'unauthenticated' }, 401)
  }
  const customer = user as Customer & { collection: 'customers' }

  const slug = typeof req.routeParams?.slug === 'string' ? req.routeParams.slug : ''
  if (!slug) return json({ error: 'not_found' }, 404)

  // overrideAccess so we can read muxPlaybackId; the `published` filter is applied explicitly.
  const { docs } = await payload.find({
    collection: 'seminars',
    where: { and: [{ slug: { equals: slug } }, { published: { equals: true } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const seminar = docs[0]
  if (!seminar) return json({ error: 'not_found' }, 404)

  if (!(await hasActivePurchase(payload, customer.id, seminar.id))) {
    return json({ error: 'not_purchased', purchaseUrl: seminar.purchaseUrl ?? null }, 403)
  }

  const limited = rateLimit(`play:${customer.id}`, { limit: 30, windowMs: 60_000 })
  if (!limited.allowed) {
    return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(limited.retryAfterSeconds) })
  }

  try {
    const { playbackId, tokens } = await getPlaybackCredentials(seminar)
    return json(
      {
        playbackId,
        tokens,
        expiresIn: PLAYBACK_TOKEN_TTL_SECONDS,
        watermark: {
          email: customer.email,
          code: customer.watermarkCode ?? null,
          ip: getRequestIp(req),
          issuedAt: new Date().toISOString(),
          notice: WATERMARK_NOTICE,
        },
      },
      200,
    )
  } catch (err) {
    // Log only the error type/message: never tokens or keys.
    payload.logger.error(
      { err: err instanceof Error ? err.name : 'unknown', seminar: seminar.id },
      'Failed to issue playback credentials',
    )
    return json({ error: 'video_unavailable' }, 503)
  }
}
