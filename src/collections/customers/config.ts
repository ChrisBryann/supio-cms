import type { Access, CollectionConfig, FieldAccess } from 'payload'
import { hasStaffRole, isCustomer, isStaff, staffAdmin, staffEditor } from '@/access/roles'
import { generateWatermarkCode } from './hooks/watermark-code'
import { refreshPurchaseTitles } from '../purchases/hooks/set-title'
import { mySeminars } from '@/endpoints/my-seminars'
import { oauthCallback, oauthStart } from '@/endpoints/oauth/handlers'
import { isDevHttpsTunnel, isProduction } from '@/lib/env'

/** Staff can see everything; a customer can see only their own record; the public sees nothing. */
const readCustomers: Access = ({ req: { user } }) => {
  if (isStaff(user)) return true
  if (user && isCustomer(user)) return { id: { equals: user.id } }
  return false
}

/** Staff (admin/editor) can update anyone; a customer can update only their own record (and only `name`, see field access). */
const updateCustomers: Access = ({ req: { user } }) => {
  if (hasStaffRole(user, ['admin', 'editor'])) return true
  if (user && isCustomer(user)) return { id: { equals: user.id } }
  return false
}

const staffEditorField: FieldAccess = ({ req: { user } }) => hasStaffRole(user, ['admin', 'editor'])
const staffOnlyField: FieldAccess = ({ req: { user } }) => isStaff(user)
const nobody: FieldAccess = () => false // writable only by server code using overrideAccess

export const Customers: CollectionConfig = {
  slug: 'customers',
  labels: { singular: 'Customer', plural: 'Customers' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'watermarkCode', 'createdAt'],
    listSearchableFields: ['email', 'name', 'watermarkCode'],
    group: 'Seminars',
    description:
      'People who can sign in to the website with Google or Yahoo. Add a customer here with the email they paid with; sign-in never creates one.',
  },
  auth: {
    // No passwords: no login/forgot-password/reset/unlock/verify endpoints, no password fields.
    // Sessions are started only by our own OAuth callback (see src/endpoints/oauth).
    disableLocalStrategy: true,
    // Without the local strategy Payload has no `sessions` field, so stateless JWTs only.
    useSessions: false,
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
    depth: 0,
    // Keep the JWT out of JSON bodies (e.g. GET /me) so page JavaScript can never read it;
    // it lives only in the httpOnly cookie.
    removeTokenFromResponses: true,
    cookies: isProduction
      ? {
          // e.g. ".yoursite.com" so the cookie works for both yoursite.com and cms.yoursite.com
          domain: process.env.COOKIE_DOMAIN || undefined,
          secure: true,
          sameSite: 'Lax',
        }
      : isDevHttpsTunnel()
        ? {
            // Development through an https tunnel (e.g. ngrok, needed for Yahoo): the frontend on
            // http://localhost calls the tunnel domain cross-site, so the cookie must be None + Secure.
            secure: true,
            sameSite: 'None',
          }
        : {
            // localhost: no domain (cookies are shared across ports), plain http
            secure: false,
            sameSite: 'Lax',
          },
  },
  access: {
    // Customers can never open the Payload admin panel (admin.user is `users`; this is defence in depth).
    admin: () => false,
    create: staffEditor,
    read: readCustomers,
    update: updateCustomers,
    delete: staffAdmin,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'The Google or Yahoo email the customer paid with. Stored in lowercase.',
      },
      access: {
        update: staffEditorField, // customers can't change their email
      },
      hooks: {
        beforeValidate: [
          ({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
        ],
      },
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'watermarkCode',
      label: 'Watermark code',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Shown in the video watermark. Search this code to find who a leaked recording belongs to. Generated automatically.',
      },
      access: {
        create: nobody,
        update: nobody,
      },
      hooks: {
        beforeChange: [
          ({ value, operation }) =>
            operation === 'create' || !value ? generateWatermarkCode() : value,
        ],
      },
    },
    {
      name: 'avatarUrl',
      label: 'Avatar URL',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Set from the Google/Yahoo profile at sign-in.',
      },
      access: {
        create: nobody,
        update: nobody,
      },
    },
    {
      name: 'googleSub',
      label: 'Google account ID',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Saved automatically the first time this customer signs in with Google.',
      },
      access: {
        read: staffOnlyField,
        create: nobody,
        update: nobody,
      },
    },
    {
      name: 'yahooSub',
      label: 'Yahoo account ID',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Saved automatically the first time this customer signs in with Yahoo.',
      },
      access: {
        read: staffOnlyField,
        create: nobody,
        update: nobody,
      },
    },
    {
      name: 'purchases',
      label: 'Seminars bought',
      type: 'join',
      collection: 'purchases',
      on: 'customer',
      defaultSort: '-createdAt',
      admin: {
        defaultColumns: ['seminar', 'status', 'paymentReference', 'createdAt'],
      },
      access: {
        read: staffOnlyField, // customers use GET /api/customers/me/seminars instead
      },
    },
  ],
  endpoints: [
    { path: '/me/seminars', method: 'get', handler: mySeminars },
    { path: '/oauth/:provider', method: 'get', handler: oauthStart },
    { path: '/oauth/:provider/callback', method: 'get', handler: oauthCallback },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'update' && previousDoc?.email !== doc.email) {
          await refreshPurchaseTitles(req, { customer: doc.id })
        }
        return doc
      },
    ],
  },
}
