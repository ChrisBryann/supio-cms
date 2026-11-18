import type { Access, CollectionConfig, FieldAccess } from 'payload'
import { isStaff, staffAdmin, staffEditor } from '@/access/roles'
import { refreshPurchaseTitles } from '../purchases/hooks/set-title'
import { playSeminar } from '@/endpoints/play-seminar'
import { slugField } from '@/fields/slug'
import { revalidateFrontend } from '@/lib/revalidate-frontend'

/** Staff see everything (incl. drafts); customers and the public see published seminars only. */
const readSeminars: Access = ({ req: { user } }) => {
  if (isStaff(user)) return true
  return { published: { equals: true } }
}

/** muxPlaybackId is never sent to customers or the public (REST, GraphQL, where-queries). */
const staffOnlyField: FieldAccess = ({ req: { user } }) => isStaff(user)

export const Seminars: CollectionConfig = {
  slug: 'seminars',
  labels: { singular: 'Seminar', plural: 'Seminars' },
  defaultSort: '-seminarDate',
  admin: {
    useAsTitle: 'title',
    group: 'Seminars',
    defaultColumns: ['title', 'speaker', 'seminarDate', 'priceLabel', 'published'],
    listSearchableFields: ['title', 'slug', 'speaker'],
    hideAPIURL: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production',
  },
  access: {
    create: staffEditor,
    read: readSeminars,
    update: staffEditor,
    delete: staffAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
    },
    slugField({
      description:
        'Used in the website URL, e.g. /seminars/my-seminar. Leave empty to generate it from the title.',
    }),
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Only published seminars appear on the website.',
      },
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      type: 'row',
      fields: [
        { name: 'speaker', type: 'text' },
        {
          name: 'seminarDate',
          label: 'Seminar date',
          type: 'date',
          admin: {
            description: 'When the seminar was held.',
            date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
          },
        },
        {
          name: 'duration',
          type: 'text',
          admin: { placeholder: '2h 15m' },
        },
      ],
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      filterOptions: {
        mimeType: { contains: 'image' },
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'priceLabel',
          label: 'Price label',
          type: 'text',
          admin: { placeholder: 'Rp 250.000', description: 'Display only.' },
        },
        {
          name: 'purchaseUrl',
          label: 'Purchase URL',
          type: 'text',
          admin: { description: 'Link to the external payment page for this seminar.' },
          validate: (value: string | null | undefined) => {
            if (!value) return true
            try {
              const url = new URL(value)
              return url.protocol === 'https:' || url.protocol === 'http:'
                ? true
                : 'Must be an http(s) link.'
            } catch {
              return 'Must be a full link, e.g. https://…'
            }
          },
        },
      ],
    },
    {
      name: 'muxPlaybackId',
      label: 'Mux playback ID',
      type: 'text',
      required: true,
      access: {
        read: staffOnlyField,
      },
      admin: {
        description:
          'From the Mux dashboard (asset → Playback IDs, policy "signed"). Never sent to customers.',
      },
    },
    {
      name: 'purchases',
      label: 'Bought by',
      type: 'join',
      collection: 'purchases',
      on: 'seminar',
      defaultSort: '-createdAt',
      admin: {
        defaultColumns: ['customer', 'status', 'paymentReference', 'createdAt'],
      },
      access: {
        read: staffOnlyField, // never expose buyers publicly
      },
    },
  ],
  endpoints: [{ path: '/:slug/play', method: 'get', handler: playSeminar }],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'update' && previousDoc?.title !== doc.title) {
          await refreshPurchaseTitles(req, { seminar: doc.id })
        }
        // The website only shows published seminars, so edits to an unpublished one don't matter.
        if (doc.published || previousDoc?.published) {
          await revalidateFrontend(req, ['seminars'])
        }
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (doc.published) await revalidateFrontend(req, ['seminars'])
      },
    ],
  },
}
