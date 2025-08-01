import type { Access, Where } from 'payload'
import { checkRole } from './check-role'

export const viewer: Access = ({ req: { user, host } }) => {
  if (user) {
    // checks if user is admin or editor
    if (checkRole(['admin', 'editor'], user)) {
      return true
    }
    // otherwise give user access to stuff that has user.id so they can check their own profile
    // this is for viewer only
    return {
      id: {
        equals: user.id,
      },
    }
  }
  // requests from the frontend can only see the first and last names of the user (using afterRead hook), else public users cannot see
  return host.includes(process.env.NEXT_PUBLIC_FRONTEND_URL!)
}
