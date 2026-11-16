import type { User } from '@/payload-types'

type MaybeStaff = { collection?: string; roles?: User['roles'] } | null | undefined

export const checkRole = (allRoles: User['roles'] = [], user: MaybeStaff): boolean => {
  // Only admin-panel users (collection `users`) have roles. A logged-in customer must never pass.
  if (user && user.collection === 'users') {
    // check if the roles of users match what is in the system
    if (allRoles?.some((role) => user.roles?.some((individualRole) => individualRole === role)))
      return true
  }

  return false
}
