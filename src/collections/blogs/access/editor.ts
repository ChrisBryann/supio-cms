import { checkRole } from '@/collections/users/access/check-role'
import type { Access } from 'payload'

export const editor: Access = ({ req: { user } }) => {
  if (user) {
    // admin and editor have full access to create/edit blogs
    if (checkRole(['admin', 'editor'], user)) {
      return true
    }
    // author can only create/edit their own blogs
    return {
      and: [
        {
          author: {
            equals: user.id,
          },
        },
      ],
    }
  }
  // non users will not have access to create/edit blogs
  return false
}
