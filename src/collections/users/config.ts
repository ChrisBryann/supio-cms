import type { CollectionConfig } from 'payload'
import { protectRoles } from './hooks/protect-roles'
import { editor } from './access/editor'
import { viewer } from './access/viewer'
import { admin } from './access/admin'
import { checkRole } from './access/check-role'
import type { User } from '@/payload-types'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    create: editor,
    read: viewer,
    update: editor,
    delete: admin,
  },
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    cookies: {
      sameSite: 'Strict',
      secure: process.env.NODE_ENV !== 'development',
      // domain: process.env.NEXT_PUBLIC_VERCEL_URL || '',
    },
    // strategies: [
    //   {
    //     name: 'supabase',
    //     authenticate: async ({ headers, payload }) => {
    //       const token = headers.get('Authorization')?.split(' ')[1]
    //       if (!token) {
    //         return {
    //           user: null,
    //         }
    //       }
    //       try {
    //         const {
    //           data: { user: supabaseUser },
    //           error,
    //         } = await supabaseClient.auth.getUser(token)
    //         if (error || !supabaseUser) {
    //           return {
    //             user: null,
    //           }
    //         }

    //         const user = await payload.find({
    //           collection: 'users',
    //           where: {
    //             supabase_id: {
    //               equals: supabaseUser.id,
    //             },
    //           },
    //         })
    //         return user.totalDocs > 0
    //           ? {
    //               user: {
    //                 ...user.docs[0],
    //                 collection: 'users',
    //               },
    //             }
    //           : {
    //               user: null,
    //             }
    //       } catch (error) {
    //         console.log('Supabase Custom Strategy Error:', error)
    //         return {
    //           user: null,
    //         }
    //       }
    //     },
    //   },
    // ],
  },
  fields: [
    // Email added by default
    // Add more fields as needed
    {
      name: 'first_name',
      label: 'First Name',
      type: 'text',
      required: true,
    },
    {
      name: 'last_name',
      label: 'Last Name',
      type: 'text',
      required: true,
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      saveToJWT: true,
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'Editor',
          value: 'editor',
        },
        { label: 'Viewer', value: 'viewer' },
      ],
      hooks: {
        beforeChange: [protectRoles], // comment this protectRoles hook to prevent Admin role not being added when user is created
      },
      access: {
        update: ({ req: { user } }) => checkRole(['admin'], user as User),
      },
    },
  ],
}
