import { checkRole } from '@/collections/users/access/check-role'
import { Access } from 'payload'

export const admin: Access = ({ req: { user } }) => {
  if (user) {
    // only admins have access to delete partners
    if (checkRole(['admin'], user)) {
      return true
    }
  }

  // other users and non-users don't have access to delete
  return false
}
