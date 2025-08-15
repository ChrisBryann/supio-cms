import { ImageFolderClassifier } from '@/hooks/image-folder-classifier'
import { CollectionConfig } from 'payload'
import { editor } from './access/editor'
import { viewer } from './access/viewer'
import { admin } from './access/admin'

export const Partners: CollectionConfig = {
  slug: 'partners',
  access: {
    create: editor,
    read: viewer,
    update: editor,
    delete: admin,
  },
  admin: {
    useAsTitle: 'name',
    hideAPIURL: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production',
    meta: {
      description: 'Partners collection',
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'partner_image',
      label: 'Partner Image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'location',
      type: 'text',
      required: true,
    },
  ],
  hooks: {
    afterChange: [ImageFolderClassifier('partner')],
  },
}
