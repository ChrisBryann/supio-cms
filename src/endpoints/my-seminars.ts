import type { PayloadHandler } from 'payload'
import { isCustomer } from '@/access/roles'
import { activePurchaseWhere } from '@/access/hasActivePurchase'
import type { Media } from '@/payload-types'

/**
 * GET /api/customers/me/seminars
 * The published seminars the signed-in customer has an ACTIVE purchase for.
 * Uses the same active-purchase rule as hasActivePurchase, applied as one query.
 */
export const mySeminars: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user || !isCustomer(user)) {
    return Response.json({ error: 'unauthenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  const purchases = await payload.find({
    collection: 'purchases',
    where: activePurchaseWhere(user.id),
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })

  const seminarIds = [
    ...new Set(
      purchases.docs.map((p) => (typeof p.seminar === 'object' ? p.seminar.id : p.seminar)),
    ),
  ]

  if (seminarIds.length === 0) {
    return Response.json([], { headers: { 'Cache-Control': 'no-store' } })
  }

  // overrideAccess: false + user, so the normal "published only" read rule applies
  // and muxPlaybackId is stripped; `select` keeps the payload small.
  const seminars = await payload.find({
    collection: 'seminars',
    where: { id: { in: seminarIds } },
    select: { slug: true, title: true, speaker: true, thumbnail: true, duration: true },
    depth: 1,
    limit: 0,
    pagination: false,
    sort: '-seminarDate',
    overrideAccess: false,
    user,
    req,
  })

  const result = seminars.docs.map((s) => {
    const thumb = s.thumbnail && typeof s.thumbnail === 'object' ? (s.thumbnail as Media) : null
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      speaker: s.speaker ?? null,
      duration: s.duration ?? null,
      thumbnail: thumb
        ? { url: thumb.url ?? null, alt: thumb.alt ?? '', width: thumb.width ?? null, height: thumb.height ?? null }
        : null,
    }
  })

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
