import { checkRole } from '@/collections/users/access/check-role'
import type { Access } from 'payload'

export const admin: Access = ({ req: { user } }) => {
  if (user) {
    // admin only have full access to delete products
    if (checkRole(['admin'], user)) {
      return true
    }
  }
  // viewer/editor users and non users will not have access to delete products
  return false
}
