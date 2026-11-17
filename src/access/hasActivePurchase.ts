import type { Payload, Where } from 'payload'

/**
 * The single definition of an active purchase. Everything that checks seminar access
 * (hasActivePurchase, GET /api/customers/me/seminars) builds on this query.
 * Purchases never expire; access ends only when the purchase is revoked (or deleted).
 */
export const activePurchaseWhere = (customerId: string, seminarId?: string): Where => ({
  and: [
    { customer: { equals: customerId } },
    ...(seminarId ? [{ seminar: { equals: seminarId } }] : []),
    { status: { equals: 'active' } },
  ],
})

/** "May this customer watch this seminar?": true only with an active purchase for that pair. */
export const hasActivePurchase = async (
  payload: Payload,
  customerId: string,
  seminarId: string,
): Promise<boolean> => {
  if (!customerId || !seminarId) return false

  const { totalDocs } = await payload.count({
    collection: 'purchases',
    where: activePurchaseWhere(customerId, seminarId),
    overrideAccess: true,
  })

  return totalDocs > 0
}
