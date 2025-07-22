import type { Access } from 'payload'
import { checkRole } from './check-role'

export const viewer: Access = ({ req: { user } }) => {
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

  return false
}
