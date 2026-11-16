import { ValidationError, type CollectionBeforeChangeHook } from 'payload'
import { relationId } from './relation-id'

/**
 * Stop two ACTIVE purchases for the same customer + seminar.
 * (A database partial unique index enforces the same rule against races; see the migration.)
 */
export const preventDuplicateActivePurchase: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const status = data.status ?? originalDoc?.status ?? 'active'
  if (status !== 'active') return data

  const customerId = relationId(data.customer ?? originalDoc?.customer)
  const seminarId = relationId(data.seminar ?? originalDoc?.seminar)
  if (!customerId || !seminarId) return data

  const existing = await req.payload.find({
    collection: 'purchases',
    where: {
      and: [
        { customer: { equals: customerId } },
        { seminar: { equals: seminarId } },
        { status: { equals: 'active' } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (existing.totalDocs > 0) {
    throw new ValidationError({
      collection: 'purchases',
      errors: [
        {
          path: 'seminar',
          message:
            'This customer already has an active purchase for this seminar. Open the existing purchase instead of creating another one.',
        },
      ],
      req,
    })
  }

  return data
}
