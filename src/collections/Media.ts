import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'collection',
      type: 'relationship',
      relationTo: ['products'],
      admin: {
        readOnly: true,
      },
    },
  ],
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*'],
  },
  folders: true,
}
