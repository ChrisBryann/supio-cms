import { checkRole } from '@/collections/users/access/check-role'
import type { Access } from 'payload'

export const author: Access = ({ req: { user } }) => {
  if (user) {
    // admin and editor have full access to view blogs
    if (checkRole(['admin', 'editor'], user)) {
      return true
    }
    // author can read their own draft/published blogs and ALL other published blogs
    return {
      or: [
        {
          author: {
            equals: user.id,
          },
        },
        {
          _status: {
            equals: 'published',
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
