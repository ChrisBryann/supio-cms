import { getFieldsToSign, jwtSign, type PayloadRequest } from 'payload'
import { generatePayloadCookie } from 'payload/shared'
import type { Customer } from '@/payload-types'

/**
 * Starts a normal Payload session for a customer: the same signed JWT and the same
 * `${cookiePrefix}-token` cookie a password login would produce, using Payload's own helpers.
 * Returns the Set-Cookie header value.
 */
export const createCustomerSessionCookie = async (
  req: PayloadRequest,
  customer: Customer,
): Promise<string> => {
  const collectionConfig = req.payload.collections.customers.config

  const fieldsToSign = getFieldsToSign({
    collectionConfig,
    email: customer.email,
    user: { ...customer, collection: 'customers' },
  })

  const { token } = await jwtSign({
    fieldsToSign,
    secret: req.payload.secret,
    tokenExpiration: collectionConfig.auth.tokenExpiration,
  })

  return generatePayloadCookie({
    returnCookieAsObject: false,
    collectionAuthConfig: collectionConfig.auth,
    cookiePrefix: req.payload.config.cookiePrefix,
    token,
  })
}
