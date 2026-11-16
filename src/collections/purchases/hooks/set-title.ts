import type { CollectionBeforeChangeHook } from 'payload'
import { relationId } from './relation-id'

/** Keeps `title` ("jane@gmail.com — Seminar Title") and `customerEmail` in sync for the admin list and search. */
export const setPurchaseTitle: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const customerId = relationId(data.customer ?? originalDoc?.customer)
  const seminarId = relationId(data.seminar ?? originalDoc?.seminar)

  const [customer, seminar] = await Promise.all([
    customerId
      ? req.payload
          .findByID({ collection: 'customers', id: customerId, depth: 0, overrideAccess: true, req })
          .catch(() => null)
      : null,
    seminarId
      ? req.payload
          .findByID({ collection: 'seminars', id: seminarId, depth: 0, overrideAccess: true, req })
          .catch(() => null)
      : null,
  ])

  data.customerEmail = customer?.email ?? null
  data.title = `${customer?.email ?? 'Unknown customer'} — ${seminar?.title ?? 'Unknown seminar'}`
  return data
}

/** Re-computes titles of all purchases for one customer or seminar after it is renamed. */
export const refreshPurchaseTitles = async (
  req: Parameters<CollectionBeforeChangeHook>[0]['req'],
  where: { customer: string } | { seminar: string },
) => {
  const field = 'customer' in where ? 'customer' : 'seminar'
  const id = 'customer' in where ? where.customer : where.seminar
  const purchases = await req.payload.find({
    collection: 'purchases',
    where: { [field]: { equals: id } },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  for (const purchase of purchases.docs) {
    // An empty update re-runs setPurchaseTitle with fresh customer/seminar data.
    await req.payload.update({
      collection: 'purchases',
      id: purchase.id,
      data: {},
      depth: 0,
      overrideAccess: true,
      req,
    })
  }
}
