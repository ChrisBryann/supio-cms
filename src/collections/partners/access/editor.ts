import { checkRole } from '@/collections/users/access/check-role'
import { Access } from 'payload'

export const editor: Access = ({ req: { user } }) => {
  if (user) {
    // admin and editor have access to create/edit partners
    if (checkRole(['admin', 'editor'], user)) {
      return true
    }
  }
  // else, viewers and non-users don't have access to create/edit
  return false
}
