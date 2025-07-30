import { checkRole } from '@/collections/users/access/check-role'
import type { Access, Where } from 'payload'

export const author: Access = ({ req: { user } }) => {
  if (user) {
    // admin and editor have full access to view blogs
    if (checkRole(['admin', 'editor'], user)) {
      return true
    }
    // author can read their own draft/published blogs and ALL other published blogs
    // FIXED: moved the where clause to a variable to explicitly cast the return type
    const authorWhere: Where = {
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
    return authorWhere
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
