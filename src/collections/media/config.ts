import { APIError, type CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      label: 'Alt Image Text',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*'],
  },
  hooks: {
    afterError: [
      ({ req, error, result }) => {
        if ((error.cause as { code?: string })?.code === '25P02') {
          // this is a PostgreSQL 25P02 error: current transaction is aborted, commands ignored until end of transaction block
          return {
            response: {
              errors: [
                {
                  message: 'Image is still used in another collection ',
                },
              ],
            },
          }
        }
      },
    ],
  },
  folders: true,
}
