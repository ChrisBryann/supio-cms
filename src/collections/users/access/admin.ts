import type { Access } from 'payload'
import { checkRole } from './check-role'

export const admin: Access = ({ req: { user } }) => {
  if (user) {
    // checks if user is admin
    if (checkRole(['admin'], user)) {
      return true
    }
  }

  return false
}
