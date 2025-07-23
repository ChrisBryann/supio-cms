import { checkRole } from '@/collections/users/access/check-role'
import type { Access } from 'payload'

export const editor: Access = ({ req: { user } }) => {
  if (user) {
    // admin and editor have full access to create/edit products
    if (checkRole(['admin', 'editor'], user)) {
      return true
    }
  }
  // viewer users and non users will not have access to create/edit products
  return false
}
