import { checkRole } from '@/collections/users/access/check-role'
import type { Access } from 'payload'

export const author: Access = ({ req: { user } }) => {
  if (user) {
    // admin and editor have full access to view blogs
    if (checkRole(['admin', 'editor'], user)) {
      return true
    }
    // author can only CRUD their own blogs
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
  // else non users can only see published blogs
  return {
    and: [
      {
        _status: {
          equals: 'published',
        },
      },
    ],
  }
}
