import type { Access, PayloadRequest } from 'payload'

/**
 * Who is making the request?
 *
 * Payload uses ONE cookie / JWT format for every auth collection, so `req.user`
 * can be an admin-panel user (collection `users`) OR a customer (collection
 * `customers`). Always branch on `user.collection`; never treat "logged in"
 * as "trusted".
 */

type ReqUser = PayloadRequest['user']

export type StaffRole = 'admin' | 'editor' | 'viewer'

export const isStaff = (user: ReqUser): boolean => user?.collection === 'users'

export const isCustomer = (user: ReqUser): boolean => user?.collection === 'customers'

export const hasStaffRole = (user: ReqUser, roles: StaffRole[]): boolean => {
  if (!user || user.collection !== 'users') return false
  const userRoles = (user as { roles?: StaffRole[] | null }).roles ?? []
  return roles.some((role) => userRoles.includes(role))
}

/** Staff with the admin or editor role. Used for managing seminars, customers and purchases. */
export const staffEditor: Access = ({ req: { user } }) => hasStaffRole(user, ['admin', 'editor'])

/** Staff with the admin role. Used for deletes. */
export const staffAdmin: Access = ({ req: { user } }) => hasStaffRole(user, ['admin'])
