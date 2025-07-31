import type { CollectionConfig } from 'payload'
import { protectRoles } from './hooks/protect-roles'
import { editor } from './access/editor'
import { viewer } from './access/viewer'
import { admin } from './access/admin'
import { checkRole } from './access/check-role'
import type { User } from '@/payload-types'
import { SendResetPassswordEmail } from './hooks/send-reset-password'
import { anyone } from './access/anyone'

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
      secure: process.env.NEXT_PUBLIC_VERCEL_ENV !== 'development',
      domain: process.env.NEXT_PUBLIC_VERCEL_URL
        ? process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
          ? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
          : process.env.NEXT_PUBLIC_VERCEL_URL
        : 'localhost',
    },
    useSessions: false,
  },
  fields: [
    // Email added by default
    {
      name: 'email',
      type: 'email',
      required: true,
      access: {
        read: ({ req: { user } }) => !!user, // only for authenticated users
      },
    },
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
        read: ({ req: { user } }) => !!user, // only for authenticated users
        update: ({ req: { user } }) => checkRole(['admin'], user as User),
      },
    },
  ],
  hooks: {
    afterOperation: [SendResetPassswordEmail],
    afterRead: [
      ({ req: { user }, doc }) => {
        if (!user) {
          // if user is not authenticated, only return first_name, last_name
          const { updatedAt, createdAt, ...rest } = doc
          return rest
        }
        return doc
      },
    ],
  },
}
