import { checkRole } from '@/collections/users/access/check-role'
import type { Access } from 'payload'

export const admin: Access = ({ req: { user } }) => {
  if (user) {
    // admin have full access to delete blogs
    if (checkRole(['admin'], user)) {
      return true
    }
    // author can only delete their own blogs
    if (checkRole(['viewer'], user)) {
      return {
        author: {
          equals: user.id,
        },
      }
    }
  }
  // non users / editors will not have access to delete blogs
  return false
}
